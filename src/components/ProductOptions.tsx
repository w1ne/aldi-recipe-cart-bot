import type { ProductOption, ProductOptionsProps } from "../lib/types";
import "./showpiece.css";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);

/**
 * ProductOptions — one ingredient and its selectable product options.
 * Header shows the (scaled) amount + unit and a pantry-staple tag; each
 * option row shows product name, pack size, line price and a subtle ALDI
 * margin hint. The row whose id === chosenId is highlighted. Tapping a row
 * calls onChoose(ingredient_key, optionId).
 */
export default function ProductOptions({
  ingredient,
  chosenId,
  onChoose,
}: ProductOptionsProps) {
  const amount = ingredient.scaled_amount ?? ingredient.amount;
  const amountLabel = formatAmount(amount, ingredient.unit);

  return (
    <div className="sp">
      <section
        className="sp-product"
        aria-label={`Product options for ${ingredient.name}`}
      >
        <header className="sp-product__head">
          <span className="sp-product__name">{ingredient.name}</span>
          <span className="sp-product__amount">
            {amountLabel}
            {ingredient.pantry_staple ? (
              <span className="sp-chip sp-chip--staple" style={{ marginLeft: 8 }}>
                🧂 pantry staple
              </span>
            ) : null}
          </span>
        </header>

        <div className="sp-product__rows" role="radiogroup" aria-label={ingredient.name}>
          {ingredient.product_options.map((opt) => (
            <OptionRow
              key={opt.id}
              option={opt}
              chosen={opt.id === chosenId}
              onChoose={() => onChoose?.(ingredient.ingredient_key, opt.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function OptionRow({
  option,
  chosen,
  onChoose,
}: {
  option: ProductOption;
  chosen: boolean;
  onChoose: () => void;
}) {
  const margin = option.line_margin;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      className={`sp-opt${chosen ? " is-chosen" : ""}`}
      onClick={onChoose}
      aria-label={`${option.name}, ${option.size}, ${eur(option.line_price)}${
        chosen ? ", selected" : ""
      }`}
    >
      <span className="sp-opt__radio" aria-hidden="true" />
      <span className="sp-opt__body">
        <span className="sp-opt__pname">{option.name}</span>
        <span className="sp-opt__meta">
          {option.size}
          {option.packs_needed > 1 ? ` · ×${option.packs_needed}` : ""}
        </span>
      </span>
      <span className="sp-opt__right">
        <span className="sp-opt__price">{eur(option.line_price)}</span>
        {margin > 0 ? (
          <span className="sp-opt__margin" aria-hidden="true">
            📈 {eur(margin)} margin
          </span>
        ) : null}
      </span>
    </button>
  );
}

function formatAmount(amount: number, unit: string): string {
  if (!amount || amount <= 0) return unit ? unit : "—";
  // Trim trailing zeros: 2.0 -> 2, 1.50 -> 1.5
  const n = Math.round(amount * 100) / 100;
  const pretty = Number.isInteger(n) ? `${n}` : `${n}`.replace(/0+$/, "");
  return unit ? `${pretty} ${unit}` : pretty;
}
