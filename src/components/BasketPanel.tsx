import { useEffect, useRef, useState } from "react";
import type { BasketPanelProps, OptimizeMode } from "../lib/types";
import { totalsFor } from "../lib/basket";
import { useI18n } from "../lib/i18n";
import type { TKey } from "../lib/i18n";
import "./showpiece.css";

const MODES: { value: OptimizeMode; emoji: string; labelKey: TKey }[] = [
  { value: "cheapest", emoji: "💰", labelKey: "basket.mode.cheapest" },
  { value: "balanced", emoji: "⚖️", labelKey: "basket.mode.balanced" },
  { value: "profit", emoji: "📈", labelKey: "basket.mode.profit" },
];

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);

/**
 * BasketPanel — the profit showpiece. A sticky summary card with a 3-way
 * segmented toggle (Cheapest / Balanced / Best for ALDI). Reads totals via
 * totalsFor(detail, selection), shows the big customer total and the ALDI
 * margin with a subtle progress bar, and count-up animates the numbers
 * whenever the mode/selection changes — making the margin feel like a win.
 */
export default function BasketPanel({
  detail,
  mode,
  onModeChange,
  selection,
}: BasketPanelProps) {
  const { t } = useI18n();
  const totals = totalsFor(detail, selection);
  const customer = useCountUp(totals.customer_total);
  const margin = useCountUp(totals.aldi_margin);

  // Bar fill = margin as a share of the customer total (capped, for taste).
  const marginPct =
    totals.customer_total > 0
      ? Math.min(100, (totals.aldi_margin / totals.customer_total) * 100)
      : 0;

  const activeIndex = Math.max(
    0,
    MODES.findIndex((m) => m.value === mode)
  );

  return (
    <div className="sp">
      <section className="sp-basket" aria-label="Basket summary">
        <div className="sp-basket__title">
          <span className="sp-dot" aria-hidden="true" />
          {t("basket.title")}
        </div>

        {/* 3-way segmented toggle */}
        <div
          className="sp-seg"
          role="tablist"
          aria-label="Basket optimisation mode"
        >
          <span
            className="sp-seg__thumb"
            aria-hidden="true"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={m.value === mode}
              className={`sp-seg__btn${m.value === mode ? " is-active" : ""}`}
              onClick={() => onModeChange(m.value)}
            >
              <span className="sp-seg__emoji" aria-hidden="true">
                {m.emoji}
              </span>
              <span>{t(m.labelKey)}</span>
            </button>
          ))}
        </div>

        {/* big numbers */}
        <div className="sp-basket__numbers">
          <div className="sp-stat">
            <div className="sp-stat__label">{t("basket.youPay")}</div>
            <Bumping value={totals.customer_total} className="sp-stat__value">
              {eur(customer)}
            </Bumping>
          </div>

          <div className="sp-stat sp-stat--margin">
            <div className="sp-stat__label">{t("basket.aldiMargin")}</div>
            <Bumping value={totals.aldi_margin} className="sp-stat__value">
              {eur(margin)}
            </Bumping>
            <div
              className="sp-stat__bar"
              role="img"
              aria-label={`ALDI margin is ${eur(totals.aldi_margin)}`}
            >
              <div
                className="sp-stat__barfill"
                style={{ width: `${marginPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="sp-basket__foot">
          <span>
            {Object.keys(selection).length} {t("basket.items")}
          </span>
          {mode === "profit" ? (
            <span className="sp-basket__pill">{t("basket.pill.profit")}</span>
          ) : mode === "balanced" ? (
            <span className="sp-basket__pill">{t("basket.pill.balanced")}</span>
          ) : (
            <span className="sp-basket__pill">{t("basket.pill.cheapest")}</span>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Wraps a stat value and re-triggers the "bump" animation whenever the
 * target value changes (mode/selection switch).
 */
function Bumping({
  value,
  className,
  children,
}: {
  value: number;
  className: string;
  children: React.ReactNode;
}) {
  const [bump, setBump] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setBump(true);
    const t = setTimeout(() => setBump(false), 440);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className={`${className}${bump ? " is-bumping" : ""}`}>{children}</div>
  );
}

/**
 * Smoothly counts a displayed number from its previous value to the next
 * target over ~450ms using requestAnimationFrame. Honors reduced-motion by
 * snapping instantly.
 */
function useCountUp(target: number, durationMs = 450): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = fromRef.current;
    const to = target;
    if (reduce || from === to) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [target, durationMs]);

  return display;
}
