import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GridCell,
  PathPoint,
  RouteStop,
  StoreGridProps,
} from "../lib/types";
import { useI18n } from "../lib/i18n";
import "./showpiece.css";

/**
 * StoreGrid — the hero. Renders the store as a crisp, responsive square SVG
 * and animates a 🛒 cart walking the optimised route from entrance to
 * checkout. Each stop lights up (with a pulse) as the cart reaches it, in
 * pickup order; a synced ordered legend below mirrors the progress.
 *
 * Coordinates: x = column 0..width-1, y = row 0..height-1. Entrance is at
 * (0,8) and checkout at (8,8) — i.e. the bottom row when y grows downward,
 * so we render row 0 at the top with NO flip. Cells, path and marker all
 * share this mapping for consistency.
 */
export default function StoreGrid({ grid, plan, animate = true }: StoreGridProps) {
  const { t } = useI18n();
  const W = grid.width || 9;
  const H = grid.height || 9;
  const CELL = 10; // SVG user units per cell; viewBox is W*CELL square
  const GAP = 0.7;
  const VW = W * CELL;
  const VH = H * CELL;

  // center of a grid cell in SVG units
  const cx = (x: number) => x * CELL + CELL / 2;
  const cy = (y: number) => y * CELL + CELL / 2;

  // ---- derive which (x,y) are route stops, and endpoints ----
  const stops = useMemo(
    () => [...plan.stops].sort((a, b) => a.order - b.order),
    [plan.stops]
  );
  const stopKey = (x: number, y: number) => `${x},${y}`;
  const stopAt = useMemo(() => {
    const m = new Map<string, RouteStop>();
    for (const s of stops) m.set(stopKey(s.x, s.y), s);
    return m;
  }, [stops]);

  const path = plan.path && plan.path.length ? plan.path : fallbackPath(stops);

  // total polyline length (in SVG units) for dash-based draw + marker timing
  const segLens = useMemo(() => lengths(path, cx, cy), [path]);
  const totalLen = segLens[segLens.length - 1] ?? 0;

  // ---- animation state: how many stops are "lit", and marker position ----
  const [litCount, setLitCount] = useState(animate ? 0 : stops.length);
  const [pulseOrder, setPulseOrder] = useState<number | null>(null);
  const [marker, setMarker] = useState<PathPoint>(() => path[0] ?? { x: 0, y: 0 });
  // Deterministic "fully drawn" flag. Once true, the polyline's inline
  // stroke-dashoffset is forced to 0 so the route line is ALWAYS visible at
  // rest — independent of whether the CSS draw animation fired/completed.
  const [drawn, setDrawn] = useState(!animate);
  const cartRef = useRef<SVGTextElement>(null);

  // duration scales with the route length so longer routes don't whip by.
  const durMs = clamp(2400 + totalLen * 28, 2600, 6500);

  useEffect(() => {
    // No animation or nothing to draw: settle into the final, fully-drawn state.
    if (!animate || path.length < 2 || totalLen === 0) {
      setLitCount(stops.length);
      setMarker(path[path.length - 1] ?? path[0] ?? { x: 0, y: 0 });
      setDrawn(true);
      return;
    }

    setDrawn(false);

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // light up the entrance stop immediately
    let lit = countStopsUpToDistance(stops, path, 0, cx, cy);
    setLitCount(lit);

    if (reduce) {
      setLitCount(stops.length);
      setMarker(path[path.length - 1]);
      setDrawn(true); // snap the line in for reduced-motion users
      return;
    }

    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durMs);
      const eased = easeInOutSine(t);
      const dist = eased * totalLen;
      setMarker(pointAtDistance(path, segLens, dist));

      const nowLit = countStopsUpToDistance(stops, path, dist, cx, cy);
      if (nowLit > lit) {
        lit = nowLit;
        setLitCount(lit);
        setPulseOrder(lit - 1);
      }
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        setLitCount(stops.length);
        setPulseOrder(stops.length - 1);
      }
    };
    raf = requestAnimationFrame(step);

    // Defense-in-depth: regardless of CSS `forwards` firing/completing, force the
    // route line to its fully-drawn state (dashoffset 0) once the draw window has
    // elapsed (+ a small buffer). This makes the final rest state deterministic.
    const drawTimer = setTimeout(() => setDrawn(true), durMs + 120);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(drawTimer);
    };
    // re-run if the route itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, plan, totalLen]);

  // build the polyline points string for the route line
  const polyPoints = path.map((p) => `${cx(p.x)},${cy(p.y)}`).join(" ");

  return (
    <div className="sp">
      <section className="sp-grid" aria-label={`${t("route.mapOf")} · ${grid.store_name}`}>
        <header className="sp-grid__head">
          <span className="sp-grid__store">🗺 {grid.store_name}</span>
          <span className="sp-grid__steps" aria-label={`${plan.total_steps} ${t("route.steps")}`}>
            👣 {plan.total_steps} {t("route.steps")}
          </span>
        </header>

        <div className="sp-grid__svgwrap">
          <svg
            className="sp-grid__svg"
            viewBox={`0 0 ${VW} ${VH}`}
            role="img"
            aria-label={`A ${W} by ${H} grid showing the shopping route through ${stops.length} stops.`}
          >
            {/* cells */}
            {grid.cells.map((cell) => {
              const onRoute = stopAt.has(stopKey(cell.x, cell.y));
              return (
                <Cell
                  key={`${cell.x}-${cell.y}`}
                  cell={cell}
                  onRoute={onRoute}
                  cellSize={CELL}
                  gap={GAP}
                />
              );
            })}

            {/* route line, drawn via stroke-dashoffset */}
            {path.length > 1 ? (
              <polyline
                className={`sp-route-line${animate && !drawn ? " is-drawing" : ""}`}
                points={polyPoints}
                // Once `drawn` is true the inline dashoffset is pinned to 0, so the
                // full route line is always visible at rest — it no longer relies
                // on the CSS `forwards` fill persisting. onAnimationEnd flips the
                // flag the instant the draw keyframe completes (no flash).
                onAnimationEnd={() => setDrawn(true)}
                style={
                  {
                    strokeDasharray: totalLen,
                    strokeDashoffset: drawn ? 0 : totalLen,
                    ["--sp-draw-dur" as string]: `${durMs}ms`,
                  } as React.CSSProperties
                }
              />
            ) : null}

            {/* stop nodes (numbered dots that light up) */}
            {stops.map((s, i) => {
              const lit = i < litCount;
              const endpoint = isEndpoint(s);
              return (
                <g key={`${s.order}-${s.x}-${s.y}`}>
                  {pulseOrder === i ? (
                    <circle
                      className="sp-stop-pulse is-pulsing"
                      cx={cx(s.x)}
                      cy={cy(s.y)}
                      r={CELL * 0.28}
                      fill="none"
                      stroke="var(--sp-orange)"
                      strokeWidth={0.8}
                    />
                  ) : null}
                  <circle
                    className={`sp-stop-node${lit ? " is-lit" : ""}`}
                    cx={cx(s.x)}
                    cy={cy(s.y)}
                    r={lit ? CELL * 0.26 : CELL * 0.2}
                    fill={lit ? "var(--sp-orange)" : "#cfd6e4"}
                    stroke={endpoint ? "var(--sp-navy)" : "#fff"}
                    strokeWidth={0.6}
                    opacity={lit ? 1 : 0.7}
                  />
                  <text
                    x={cx(s.x)}
                    y={cy(s.y) + 1.4}
                    textAnchor="middle"
                    fontSize={3.6}
                    fontWeight={800}
                    fill={lit ? "#fff" : "var(--sp-navy)"}
                    pointerEvents="none"
                  >
                    {labelFor(s)}
                  </text>
                </g>
              );
            })}

            {/* the cart marker */}
            <text
              ref={cartRef}
              className="sp-cart"
              x={cx(marker.x)}
              y={cy(marker.y) + 1.8}
              textAnchor="middle"
              aria-hidden="true"
            >
              🛒
            </text>
          </svg>
        </div>

        {/* ordered, synced legend */}
        <ol className="sp-legend" aria-label={t("route.pickupOrder")}>
          {stops.map((s, i) => {
            const lit = i < litCount;
            const endpoint = isEndpoint(s);
            return (
              <li
                key={`${s.order}-leg`}
                className={`sp-legend__item${lit ? " is-lit" : ""}${
                  endpoint ? " is-endpoint" : ""
                }`}
              >
                <span className="sp-legend__num" aria-hidden="true">
                  {labelFor(s)}
                </span>
                <span className="sp-legend__label">{s.label}</span>
                <span className="sp-legend__check" aria-hidden="true">
                  ✓
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* cell rendering                                                          */
/* ---------------------------------------------------------------------- */

function Cell({
  cell,
  onRoute,
  cellSize,
  gap,
}: {
  cell: GridCell;
  onRoute: boolean;
  cellSize: number;
  gap: number;
}) {
  const x = cell.x * cellSize + gap / 2;
  const y = cell.y * cellSize + gap / 2;
  const s = cellSize - gap;
  const fill = cellFill(cell, onRoute);

  // Show a tiny category label only for route-relevant category cells so the
  // map stays legible on a phone.
  const showLabel = onRoute && cell.type === "aisle" && cell.categories?.length;
  const label = showLabel ? shortCat(cell.categories[0]) : null;

  return (
    <g>
      <rect
        className="sp-cell"
        x={x}
        y={y}
        width={s}
        height={s}
        rx={1.6}
        fill={fill}
      />
      {cell.type === "entrance" ? (
        <text
          x={x + s / 2}
          y={y + s / 2 + 2.2}
          textAnchor="middle"
          fontSize={5}
          aria-hidden="true"
        >
          🚪
        </text>
      ) : null}
      {cell.type === "checkout" ? (
        <text
          x={x + s / 2}
          y={y + s / 2 + 2.2}
          textAnchor="middle"
          fontSize={5}
          aria-hidden="true"
        >
          🛍
        </text>
      ) : null}
      {label ? (
        <text
          className="sp-cell-label"
          x={x + s / 2}
          y={y + s - 1.2}
          textAnchor="middle"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}

function cellFill(cell: GridCell, onRoute: boolean): string {
  if (cell.type === "entrance") return "rgba(76, 175, 80, 0.85)";
  if (cell.type === "checkout") return "rgba(255, 120, 0, 0.9)";
  if (onRoute) return "rgba(65, 182, 230, 0.34)"; // ALDI-blue tint for stops
  if (cell.categories && cell.categories.length)
    return "rgba(65, 182, 230, 0.08)"; // faint hint that a category lives here
  return "#eef1f6"; // plain aisle / walkway
}

/* ---------------------------------------------------------------------- */
/* route geometry helpers                                                  */
/* ---------------------------------------------------------------------- */

function lengths(
  path: PathPoint[],
  cx: (x: number) => number,
  cy: (y: number) => number
): number[] {
  const out: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const dx = cx(path[i].x) - cx(path[i - 1].x);
    const dy = cy(path[i].y) - cy(path[i - 1].y);
    out.push(out[i - 1] + Math.hypot(dx, dy));
  }
  return out;
}

function pointAtDistance(
  path: PathPoint[],
  segLens: number[],
  dist: number
): PathPoint {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];
  const total = segLens[segLens.length - 1];
  const d = clamp(dist, 0, total);
  // find segment
  let i = 1;
  while (i < segLens.length && segLens[i] < d) i++;
  if (i >= path.length) return path[path.length - 1];
  const segStart = segLens[i - 1];
  const segLen = segLens[i] - segStart || 1;
  const t = (d - segStart) / segLen;
  // interpolate in SVG space then convert back to grid coords for cx/cy usage
  const ax = path[i - 1].x;
  const ay = path[i - 1].y;
  const bx = path[i].x;
  const by = path[i].y;
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

/** How many stops (in order) the cart has reached by `dist` along the path. */
function countStopsUpToDistance(
  stops: RouteStop[],
  path: PathPoint[],
  dist: number,
  cx: (x: number) => number,
  cy: (y: number) => number
): number {
  if (!stops.length) return 0;
  const segLens = lengths(path, cx, cy);
  // distance along the path at which each path vertex sits
  let count = 0;
  for (const s of stops) {
    const d = distanceOfStop(s, path, segLens);
    if (d <= dist + 0.001) count++;
    else break;
  }
  return count;
}

/** Path-distance of the first path vertex matching a stop's (x,y). */
function distanceOfStop(
  s: RouteStop,
  path: PathPoint[],
  segLens: number[]
): number {
  for (let i = 0; i < path.length; i++) {
    if (path[i].x === s.x && path[i].y === s.y) return segLens[i];
  }
  // stop not exactly on a vertex (shouldn't happen) -> nearest vertex
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = Math.abs(path[i].x - s.x) + Math.abs(path[i].y - s.y);
    if (d < bestD) {
      bestD = d;
      best = segLens[i];
    }
  }
  return best;
}

/** When plan.path is empty, connect the stops directly as a fallback. */
function fallbackPath(stops: RouteStop[]): PathPoint[] {
  return stops.map((s) => ({ x: s.x, y: s.y }));
}

/* ---------------------------------------------------------------------- */
/* misc helpers                                                            */
/* ---------------------------------------------------------------------- */

function isEndpoint(s: RouteStop): boolean {
  const c = (s.category || "").toLowerCase();
  return c === "entrance" || c === "checkout";
}

/** Marker shown inside a stop node: 🏁 for endpoints, else the order number. */
function labelFor(s: RouteStop): string {
  const c = (s.category || "").toLowerCase();
  if (c === "entrance") return "▶";
  if (c === "checkout") return "✓";
  return String(s.order);
}

function shortCat(name: string): string {
  // keep labels tiny: first word, max ~8 chars
  const first = name.split(/[\s&—-]/)[0] ?? name;
  return first.length > 9 ? `${first.slice(0, 8)}…` : first;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
