import type { ProductOptionsProps } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { useChecklist } from "../lib/checklist";
import "./showpiece.css";
import "./checklist.css";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);

// "Already have it / got it" hint, kept local so the shared dictionary stays lean.
const GOT: Record<string, { have: string; tap: string }> = {
  en: { have: "Got it", tap: "Tap if you already have this" },
  ua: { have: "Вже є", tap: "Натисніть, якщо це вже є" },
  ru: { have: "Уже есть", tap: "Нажмите, если это уже есть" },
  hu: { have: "Megvan", tap: "Koppintson, ha ez már megvan" },
  es: { have: "Ya lo tengo", tap: "Toque si ya lo tiene" },
};

/**
 * ProductOptions — one basket line: the ingredient and the single ALDI product
 * picked for it (name, pack size, price). Tappable like a real grocery list:
 * tap to mark "already have / got it" — the row dims, strikes through and drops
 * out of what's left to buy. Checked state is shared via useChecklist(recipeId).
 */
export default function ProductOptions({
  ingredient,
  chosenId,
  recipeId,
}: ProductOptionsProps & { recipeId?: number | string }) {
  const { t, lang } = useI18n();
  const got = GOT[lang] ?? GOT.en;
  const amount = ingredient.scaled_amount ?? ingredient.amount;
  const amountLabel = formatAmount(amount, ingredient.unit);
  const chosen =
    ingredient.product_options.find((o) => o.id === chosenId) ??
    ingredient.product_options[0];

  const checklist = useChecklist(recipeId ?? "_none");
  const interactive = recipeId != null;
  const done = interactive && checklist.isChecked(ingredient.ingredient_key);

  const onToggle = () => {
    if (interactive) checklist.toggle(ingredient.ingredient_key);
  };

  const inner = (
    <>
      <header className="sp-product__head sp-product__headrow">
        <span className="sp-product__headtext">
          <span className="sp-product__name">{ingredient.name}</span>
          <span className="sp-product__amount">
            {amountLabel}
            {ingredient.pantry_staple ? (
              <span className="sp-chip sp-chip--staple" style={{ marginLeft: 8 }}>
                🧂 {t("product.staple")}
              </span>
            ) : null}
          </span>
        </span>
        {interactive ? (
          <span className="sp-check" aria-hidden="true">
            <span className="sp-check__mark">✓</span>
          </span>
        ) : null}
      </header>

      {chosen ? (
        <div className="sp-opt is-chosen">
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
    </>
  );

  if (!interactive) {
    return (
      <div className="sp">
        <section className="sp-product" aria-label={`Basket item: ${ingredient.name}`}>
          {inner}
        </section>
      </div>
    );
  }

  return (
    <div className="sp">
      <button
        type="button"
        className={`sp-product sp-product--check${done ? " is-done" : ""}`}
        role="checkbox"
        aria-checked={done}
        aria-label={`${ingredient.name} — ${done ? got.have : got.tap}`}
        onClick={onToggle}
      >
        {inner}
      </button>
    </div>
  );
}

function formatAmount(amount: number, unit: string): string {
  if (!amount || amount <= 0) return unit ? unit : "—";
  const n = Math.round(amount * 100) / 100;
  const pretty = Number.isInteger(n) ? `${n}` : `${n}`.replace(/0+$/, "");
  return unit ? `${pretty} ${unit}` : pretty;
}
