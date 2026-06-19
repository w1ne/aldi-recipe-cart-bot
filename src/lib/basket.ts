// Client-side basket optimization across the three modes the user can toggle.
// The ALDI recipe endpoint already gives us cheapest_option_id and
// max_profit_option_id per ingredient; "balanced" is our own heuristic that
// keeps ALDI margin healthy without overcharging the customer.
import type {
  BasketTotals,
  Ingredient,
  OptimizeMode,
  ProductOption,
  RecipeDetail,
} from "./types";

export function chooseOption(ing: Ingredient, mode: OptimizeMode): ProductOption {
  const byId = (id: number) =>
    ing.product_options.find((p) => p.id === id) ?? ing.product_options[0];

  if (mode === "cheapest") return byId(ing.cheapest_option_id);
  if (mode === "profit") return byId(ing.max_profit_option_id);

  // balanced: best margin-per-euro that doesn't cost the customer more than
  // 25% above the cheapest option. Maximizes ALDI margin while staying fair.
  const cheapest = byId(ing.cheapest_option_id);
  const cap = cheapest.line_price * 1.25;
  const affordable = ing.product_options.filter((p) => p.line_price <= cap);
  const pool = affordable.length ? affordable : ing.product_options;
  return pool.reduce((best, p) => (p.line_margin > best.line_margin ? p : best), pool[0]);
}

export function selectionFor(detail: RecipeDetail, mode: OptimizeMode): Record<string, number> {
  const sel: Record<string, number> = {};
  for (const ing of detail.ingredients) {
    if (!ing.include_in_shopping_list) continue;
    sel[ing.ingredient_key] = chooseOption(ing, mode).id;
  }
  return sel;
}

export function totalsFor(
  detail: RecipeDetail,
  selection: Record<string, number>
): BasketTotals {
  let customer_total = 0;
  let aldi_margin = 0;
  for (const ing of detail.ingredients) {
    const id = selection[ing.ingredient_key];
    if (id == null) continue;
    const opt = ing.product_options.find((p) => p.id === id);
    if (!opt) continue;
    customer_total += opt.line_price;
    aldi_margin += opt.line_margin;
  }
  return {
    customer_total: round2(customer_total),
    aldi_margin: round2(aldi_margin),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
