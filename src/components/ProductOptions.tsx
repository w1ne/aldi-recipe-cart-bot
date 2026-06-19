import type { ProductOptionsProps } from "../lib/types";
import { useI18n } from "../lib/i18n";
import "./showpiece.css";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);

/**
 * ProductOptions — one basket line: the ingredient and the single ALDI product
 * picked for it (name, pack size, price). We just show the basket — no
 * alternatives, no margin, no optimisation UI.
 */
export default function ProductOptions({ ingredient, chosenId }: ProductOptionsProps) {
  const { t } = useI18n();
  const amount = ingredient.scaled_amount ?? ingredient.amount;
  const amountLabel = formatAmount(amount, ingredient.unit);
  const chosen =
    ingredient.product_options.find((o) => o.id === chosenId) ??
    ingredient.product_options[0];

  return (
    <div className="sp">
      <section className="sp-product" aria-label={`Basket item: ${ingredient.name}`}>
        <header className="sp-product__head">
          <span className="sp-product__name">{ingredient.name}</span>
          <span className="sp-product__amount">
            {amountLabel}
            {ingredient.pantry_staple ? (
              <span className="sp-chip sp-chip--staple" style={{ marginLeft: 8 }}>
                🧂 {t("product.staple")}
              </span>
            ) : null}
          </span>
        </header>

        {chosen ? (
          <div className="sp-opt is-chosen">
            <span className="sp-opt__radio" aria-hidden="true" />
            <span className="sp-opt__body">
              <span className="sp-opt__pname">{chosen.name}</span>
              <span className="sp-opt__meta">
                {chosen.size}
                {chosen.packs_needed > 1 ? ` · ×${chosen.packs_needed}` : ""}
              </span>
            </span>
            <span className="sp-opt__right">
              <span className="sp-opt__price">{eur(chosen.line_price)}</span>
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function formatAmount(amount: number, unit: string): string {
  if (!amount || amount <= 0) return unit ? unit : "—";
  const n = Math.round(amount * 100) / 100;
  const pretty = Number.isInteger(n) ? `${n}` : `${n}`.replace(/0+$/, "");
  return unit ? `${pretty} ${unit}` : pretty;
}
