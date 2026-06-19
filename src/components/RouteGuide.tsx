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
import { interpolate, useI18n } from "../lib/i18n";
import StoreGrid from "./StoreGrid";
import "./showpiece.css";
import "./guide.css";

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
 * RouteGuide — the deliverable. Wraps StoreGrid in CONTROLLED mode and drives
 * it step by step (entrance → each stop → checkout). Auto-plays: on entering a
 * step it builds localized narration, sends it to /api/tts, plays the returned
 * audio, and advances when the audio ENDS. If TTS is silent (204) or errors, it
 * falls back to a timed advance so the guide still works without sound.
 */
export default function RouteGuide({ plan, grid, recipe, selection }: RouteGuideProps) {
  const { t, lang } = useI18n();

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
  const [playing, setPlaying] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
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

  const advance = useCallback(() => {
    setStepIndex((i) => Math.min(lastIndex, i + 1));
  }, [lastIndex]);

  // The auto-play engine: react to (stepIndex, playing). On each active step,
  // narrate then advance on audio end, or fall back to a timer.
  useEffect(() => {
    stopAll();
    if (!playing) return;
    const stop = stops[stepIndex];
    if (!stop) return;

    // Last step (checkout): narrate once, then stop (no further advance).
    const atEnd = stepIndex >= lastIndex;
    const token = ++runToken.current;

    const fallbackMs =
      2800 + Math.max(0, stop.steps_from_previous || 0) * 400;

    const scheduleFallback = () => {
      if (atEnd) return;
      fallbackTimer.current = setTimeout(() => {
        if (token === runToken.current) advance();
      }, fallbackMs);
    };

    const text = narrationFor(stepIndex);
    if (!text) {
      scheduleFallback();
      return;
    }

    setSpeaking(true);
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text,
            voice: "nova",
            instructions: WARM_INSTRUCTIONS,
          }),
        });
        if (cancelled || token !== runToken.current) return;

        // 204 / no audio / non-ok → silent timed fallback.
        if (res.status === 204 || !res.ok) {
          setSpeaking(false);
          scheduleFallback();
          return;
        }
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("audio")) {
          setSpeaking(false);
          scheduleFallback();
          return;
        }

        const blob = await res.blob();
        if (cancelled || token !== runToken.current) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          if (token !== runToken.current) return;
          setSpeaking(false);
          if (!atEnd) advance();
        };
        audio.onerror = () => {
          if (token !== runToken.current) return;
          setSpeaking(false);
          scheduleFallback();
        };
        try {
          await audio.play();
        } catch {
          // Autoplay blocked or failed → fall back to timed advance.
          if (token !== runToken.current) return;
          setSpeaking(false);
          scheduleFallback();
        }
      } catch {
        if (cancelled || token !== runToken.current) return;
        setSpeaking(false);
        scheduleFallback();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, playing, lang]);

  // Clean up on unmount.
  useEffect(() => () => stopAll(), [stopAll]);

  // --- manual controls (Back/Next pause auto-play and jump) ---
  const jumpTo = useCallback(
    (idx: number) => {
      stopAll();
      setPlaying(false);
      setStepIndex(Math.max(0, Math.min(lastIndex, idx)));
    },
    [lastIndex, stopAll]
  );

  const onBack = () => jumpTo(stepIndex - 1);
  const onNext = () => jumpTo(stepIndex + 1);
  const togglePlay = () => {
    if (playing) {
      stopAll();
      setPlaying(false);
    } else {
      // Replay from the start if we're already at the end.
      if (stepIndex >= lastIndex) setStepIndex(0);
      setPlaying(true);
    }
  };

  const current = stops[stepIndex];
  const finished = !playing && stepIndex >= lastIndex;
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
            <div className="guide-checkout__row">
              <span className="guide-checkout__label">{t("basket.aldiMargin")}</span>
              <span className="guide-checkout__val guide-checkout__val--margin">
                €{totals.aldi_margin.toFixed(2)}
              </span>
            </div>
          </div>
        ) : grabs.length ? (
          <ul className="guide-grab">
            {grabs.map((g) => (
              <li className="guide-grab__item" key={g.key}>
                <span className="guide-grab__tick" aria-hidden="true">
                  ✓
                </span>
                <span className="guide-grab__name">
                  {g.name}{" "}
                  {g.size ? <span className="guide-grab__size">· {g.size}</span> : null}
                </span>
                <span className="guide-grab__price">€{g.price.toFixed(2)}</span>
              </li>
            ))}
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
            onClick={togglePlay}
            aria-label={playing ? t("guide.pause") : finished ? t("guide.replay") : t("guide.play")}
          >
            {playing ? `⏸ ${t("guide.pause")}` : finished ? `↻ ${t("guide.replay")}` : `▶ ${t("guide.start")}`}
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
