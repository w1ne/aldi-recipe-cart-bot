import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Ingredient,
  ProductOption,
  RecipeDetail,
  RoutePlan,
  RouteStop,
  StoreGridData,
} from "../lib/types";
import { selectionFor, totalsFor } from "../lib/basket";
import { useChecklist } from "../lib/checklist";
import { interpolate, useI18n } from "../lib/i18n";
import StoreGrid from "./StoreGrid";
import "./showpiece.css";
import "./guide.css";
import "./checklist.css";

interface RouteGuideProps {
  plan: RoutePlan;
  grid: StoreGridData;
  /** Most-recent recipe in the conversation (optional). */
  recipe?: RecipeDetail;
  /** Active basket selection (ingredient_key -> option id). Optional. */
  selection?: Record<string, number>;
}

/** A product the shopper grabs at a stop. */
interface GrabItem {
  key: string;
  name: string;
  size: string;
  price: number;
}

const WARM_INSTRUCTIONS =
  "Speak as a warm, friendly ALDI shop assistant guiding a shopper through the store. " +
  "Upbeat and natural, brisk but never rushed. One short sentence or two.";

/**
 * RouteGuide — wraps StoreGrid in CONTROLLED mode and lets the shopper step
 * through the route MANUALLY (◀ / ▶). It never reads or advances on its own;
 * the 🔊 button speaks the CURRENT step on demand via /api/tts (and does not
 * move to the next step). The cart follows whatever step the shopper is on.
 */
export default function RouteGuide({ plan, grid, recipe, selection }: RouteGuideProps) {
  const { t } = useI18n();

  // Same checked-state store as the basket: ticking a grab here marks it
  // "already have / grabbed" everywhere. Falls back to a no-op id when there's
  // no recipe (grab items only exist when a recipe is present anyway).
  const checklist = useChecklist(recipe?.recipe.id ?? "_none");

  const stops = useMemo(
    () => [...plan.stops].sort((a, b) => a.order - b.order),
    [plan.stops]
  );
  const lastIndex = Math.max(0, stops.length - 1);

  // Resolve the active selection: caller-provided, else profit-optimized.
  const activeSelection = useMemo<Record<string, number>>(() => {
    if (selection) return selection;
    if (recipe) return selectionFor(recipe, "profit");
    return {};
  }, [selection, recipe]);

  // category_id -> grab items, from the recipe ingredients + selection.
  const grabByCategory = useMemo(() => {
    const map = new Map<number, GrabItem[]>();
    if (!recipe) return map;
    for (const ing of recipe.ingredients as Ingredient[]) {
      if (!ing.include_in_shopping_list) continue;
      const chosenId = activeSelection[ing.ingredient_key];
      const opt: ProductOption | undefined =
        ing.product_options.find((p) => p.id === chosenId) ??
        ing.product_options[0];
      if (!opt) continue;
      const item: GrabItem = {
        key: ing.ingredient_key,
        name: opt.name,
        size: opt.size,
        price: opt.line_price,
      };
      const list = map.get(ing.category_id) ?? [];
      list.push(item);
      map.set(ing.category_id, list);
    }
    return map;
  }, [recipe, activeSelection]);

  const grabsFor = useCallback(
    (stop: RouteStop): GrabItem[] =>
      stop.category_id != null ? grabByCategory.get(stop.category_id) ?? [] : [],
    [grabByCategory]
  );

  const totals = useMemo(
    () => (recipe ? totalsFor(recipe, activeSelection) : null),
    [recipe, activeSelection]
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Token guards against stale async (a fetch resolving after we've moved on).
  const runToken = useRef(0);

  const isCheckout = (s: RouteStop) =>
    (s.category || "").toLowerCase() === "checkout";
  const isEntrance = (s: RouteStop) =>
    (s.category || "").toLowerCase() === "entrance";

  const stopAll = useCallback(() => {
    runToken.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      const url = audioRef.current.src;
      audioRef.current.src = "";
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  // Build the narration text for a step in the current language.
  const narrationFor = useCallback(
    (idx: number): string => {
      const stop = stops[idx];
      if (!stop) return "";
      if (isEntrance(stop)) return t("guide.narrateStart");
      if (isCheckout(stop)) {
        return interpolate(t("guide.checkout"), {
          total: totals ? `€${totals.customer_total.toFixed(2)}` : "—",
          margin: totals ? `€${totals.aldi_margin.toFixed(2)}` : "—",
        });
      }
      const head = interpolate(t("guide.narrateHead"), { category: stop.category });
      const grabs = grabsFor(stop);
      if (!grabs.length) return head;
      const items = grabs.map((g) => g.name).join(", ");
      return `${head} ${interpolate(t("guide.narrateGrab"), { items })}`;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stops, t, totals, grabsFor]
  );

  // Speak the CURRENT step on demand. Does NOT advance to the next step.
  const speak = useCallback(
    (idx: number) => {
      stopAll();
      const text = narrationFor(idx);
      if (!text) return;
      const token = ++runToken.current;
      setSpeaking(true);
      (async () => {
        try {
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text, voice: "nova", instructions: WARM_INSTRUCTIONS }),
          });
          if (token !== runToken.current) return;
          if (res.status === 204 || !res.ok) return setSpeaking(false);
          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("audio")) return setSpeaking(false);
          const blob = await res.blob();
          if (token !== runToken.current) return;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            if (token === runToken.current) setSpeaking(false);
          };
          audio.onerror = () => {
            if (token === runToken.current) setSpeaking(false);
          };
          try {
            await audio.play();
          } catch {
            if (token === runToken.current) setSpeaking(false);
          }
        } catch {
          if (token === runToken.current) setSpeaking(false);
        }
      })();
    },
    [narrationFor, stopAll]
  );

  // Clean up audio on unmount.
  useEffect(() => () => stopAll(), [stopAll]);

  // --- manual controls: stepping never auto-speaks ---
  const jumpTo = useCallback(
    (idx: number) => {
      stopAll();
      setStepIndex(Math.max(0, Math.min(lastIndex, idx)));
    },
    [lastIndex, stopAll]
  );

  const onBack = () => jumpTo(stepIndex - 1);
  const onNext = () => jumpTo(stepIndex + 1);
  const toggleSpeak = () => {
    if (speaking) stopAll();
    else speak(stepIndex);
  };

  const current = stops[stepIndex];
  const atCheckout = current ? isCheckout(current) : false;
  const grabs = current ? grabsFor(current) : [];

  const headline = (() => {
    if (!current) return "";
    if (isEntrance(current)) return t("guide.entrance");
    if (atCheckout) return t("guide.done");
    return interpolate(t("guide.headTo"), { category: current.category });
  })();

  return (
    <div className="guide">
      <StoreGrid grid={grid} plan={plan} controlledStopIndex={stepIndex} />

      <section className="guide-panel" aria-live="polite">
        <div className="guide-panel__top">
          <span className="guide-panel__step">
            {interpolate(t("guide.step"), { n: stepIndex + 1, m: stops.length })}
          </span>
          <span
            className={`guide-panel__speaker${speaking ? " is-speaking" : ""}`}
            aria-hidden="true"
          >
            {speaking ? "🔊" : "🔈"}
          </span>
        </div>

        <h3 className="guide-panel__head">{headline}</h3>

        {atCheckout && totals ? (
          <div className="guide-checkout">
            <div className="guide-checkout__row">
              <span className="guide-checkout__label">{t("basket.youPay")}</span>
              <span className="guide-checkout__val">
                €{totals.customer_total.toFixed(2)}
              </span>
            </div>
          </div>
        ) : grabs.length ? (
          <ul className="guide-grab">
            {grabs.map((g) => {
              const done = checklist.isChecked(g.key);
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    className={`guide-grab__item guide-grab__item--check${
                      done ? " is-done" : ""
                    }`}
                    role="checkbox"
                    aria-checked={done}
                    aria-label={g.name}
                    onClick={() => checklist.toggle(g.key)}
                  >
                    <span className="guide-grab__tick guide-grab__tick--check" aria-hidden="true">
                      <span className="guide-grab__tickmark">✓</span>
                    </span>
                    <span className="guide-grab__name">
                      {g.name}{" "}
                      {g.size ? <span className="guide-grab__size">· {g.size}</span> : null}
                    </span>
                    <span className="guide-grab__price">€{g.price.toFixed(2)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="guide-dots" role="tablist" aria-label={t("guide.title")}>
          {stops.map((s, i) => (
            <button
              key={`${s.order}-dot`}
              type="button"
              className={`guide-dot${i === stepIndex ? " is-active" : ""}${
                i < stepIndex ? " is-done" : ""
              }`}
              aria-label={interpolate(t("guide.step"), { n: i + 1, m: stops.length })}
              aria-selected={i === stepIndex}
              role="tab"
              onClick={() => jumpTo(i)}
            />
          ))}
        </div>

        <div className="guide-controls">
          <button
            type="button"
            className="guide-btn"
            onClick={onBack}
            disabled={stepIndex <= 0}
            aria-label={t("guide.back")}
          >
            ◀
          </button>

          <button
            type="button"
            className="guide-btn guide-btn--primary"
            onClick={toggleSpeak}
            aria-label={speaking ? t("guide.pause") : t("guide.play")}
          >
            {speaking ? `⏸ ${t("guide.pause")}` : `🔊 ${t("guide.play")}`}
          </button>

          <button
            type="button"
            className="guide-btn"
            onClick={onNext}
            disabled={stepIndex >= lastIndex}
            aria-label={t("guide.next")}
          >
            ▶
          </button>
        </div>
      </section>
    </div>
  );
}
