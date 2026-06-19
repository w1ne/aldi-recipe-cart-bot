import { useEffect, useRef, useState } from "react";
import type { BasketPanelProps } from "../lib/types";
import { totalsFor } from "../lib/basket";
import { useI18n } from "../lib/i18n";
import "./showpiece.css";

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

export default function BasketPanel({ detail, selection }: BasketPanelProps) {
  const { t, lang } = useI18n();
  const totals = totalsFor(detail, selection);
  const customer = useCountUp(totals.customer_total);
  const [ordered, setOrdered] = useState(false);
  const deliver = DELIVER[lang] ?? DELIVER.en;

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

        <div className="sp-basket__foot">
          <span>
            {Object.keys(selection).length} {t("basket.items")}
          </span>
        </div>

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
