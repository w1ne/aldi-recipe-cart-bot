import { useEffect, useRef, useState } from "react";
import type { BasketPanelProps } from "../lib/types";
import { totalsFor } from "../lib/basket";
import { useChecklist, remainingSelection } from "../lib/checklist";
import { interpolate, useI18n } from "../lib/i18n";
import "./showpiece.css";
import "./checklist.css";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);

/**
 * BasketPanel — the profit showpiece. The basket is ALWAYS the ALDI-maximised
 * pick (highest line_margin per ingredient), so there is no mode toggle. Shows
 * the customer total and, prominently, ALDI's margin with a subtle bar, and
 * count-up animates the numbers whenever the basket changes.
 */
// Delivery CTA labels, kept local so the shared i18n dictionary stays lean.
const DELIVER: Record<string, { cta: string; onway: string }> = {
  en: { cta: "🚚 Get it delivered", onway: "✅ On its way — arriving in ~2 hours" },
  ua: { cta: "🚚 Замовити доставку", onway: "✅ Вже в дорозі — прибуде за ~2 години" },
  ru: { cta: "🚚 Заказать доставку", onway: "✅ Уже в пути — прибудет через ~2 часа" },
  hu: { cta: "🚚 Kérem házhoz", onway: "✅ Úton van — kb. 2 óra múlva érkezik" },
  es: { cta: "🚚 Pedir a domicilio", onway: "✅ En camino — llega en ~2 horas" },
};

// "{got} of {total} got" progress label, kept local to the component.
const PROGRESS: Record<string, string> = {
  en: "{got} of {total} got",
  ua: "{got} з {total} зібрано",
  ru: "{got} из {total} собрано",
  hu: "{got} / {total} megvan",
  es: "{got} de {total} listos",
};

export default function BasketPanel({
  detail,
  selection,
  recipeId,
}: BasketPanelProps & { recipeId?: number | string }) {
  const { t, lang } = useI18n();
  const checklist = useChecklist(recipeId ?? "_none");
  const interactive = recipeId != null;

  // Totals reflect only what's still to buy (checked = already have it).
  const remaining = interactive
    ? remainingSelection(selection, checklist.checked)
    : selection;
  const totals = totalsFor(detail, remaining);

  const totalItems = Object.keys(selection).length;
  const remainingItems = Object.keys(remaining).length;
  const gotItems = totalItems - remainingItems;
  const progressPct = totalItems > 0 ? Math.round((gotItems / totalItems) * 100) : 0;

  const customer = useCountUp(totals.customer_total);
  const [ordered, setOrdered] = useState(false);
  const deliver = DELIVER[lang] ?? DELIVER.en;
  const progressTpl = PROGRESS[lang] ?? PROGRESS.en;

  return (
    <div className="sp">
      <section className="sp-basket" aria-label="Basket summary">
        <div className="sp-basket__title">
          <span className="sp-dot" aria-hidden="true" />
          {t("basket.title")}
        </div>

        <div className="sp-basket__numbers">
          <div className="sp-stat">
            <div className="sp-stat__label">{t("basket.youPay")}</div>
            <Bumping value={totals.customer_total} className="sp-stat__value">
              {eur(customer)}
            </Bumping>
          </div>
        </div>

        {interactive && totalItems > 0 ? (
          <div className="sp-progress">
            <div className="sp-progress__row">
              <span>
                {remainingItems} {t("basket.items")}
              </span>
              <span className="sp-progress__got">
                {interpolate(progressTpl, { got: gotItems, total: totalItems })}
              </span>
            </div>
            <div
              className="sp-progress__bar"
              role="progressbar"
              aria-valuenow={gotItems}
              aria-valuemin={0}
              aria-valuemax={totalItems}
            >
              <div className="sp-progress__fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        ) : (
          <div className="sp-basket__foot">
            <span>
              {totalItems} {t("basket.items")}
            </span>
          </div>
        )}

        <button
          type="button"
          className={`sp-deliver${ordered ? " is-ordered" : ""}`}
          onClick={() => setOrdered(true)}
          disabled={ordered}
        >
          {ordered ? deliver.onway : deliver.cta}
        </button>
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
