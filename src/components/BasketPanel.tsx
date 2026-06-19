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
export default function BasketPanel({ detail, selection }: BasketPanelProps) {
  const { t } = useI18n();
  const totals = totalsFor(detail, selection);
  const customer = useCountUp(totals.customer_total);

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
