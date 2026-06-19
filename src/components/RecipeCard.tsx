import type { RecipeCardProps } from "../lib/types";
import "./showpiece.css";

/**
 * RecipeCard — a compact, tappable recipe tile sized for a horizontal
 * scroll strip. Shows name, cuisine, prep time, tags as chips and an
 * ingredient count, with a "Pick this" CTA that calls onSelect(recipe.id).
 */
export default function RecipeCard({ recipe, onSelect, selected }: RecipeCardProps) {
  const pick = () => onSelect?.(recipe.id);

  // Show at most a few tags so the card stays compact; the rest collapse
  // into a "+N" chip.
  const MAX_TAGS = 3;
  const shown = recipe.tags.slice(0, MAX_TAGS);
  const extra = recipe.tags.length - shown.length;

  return (
    <div className="sp">
      <button
        type="button"
        className={`sp-recipe-card${selected ? " is-selected" : ""}`}
        onClick={pick}
        aria-pressed={selected ? true : false}
        aria-label={`${recipe.name}, ${recipe.cuisine}, ${recipe.prep_minutes} minutes, ${recipe.ingredient_count} ingredients. ${
          selected ? "Selected." : "Tap to pick this recipe."
        }`}
      >
        <span className="sp-recipe-card__check" aria-hidden="true">
          ✓
        </span>

        <div className="sp-recipe-card__head">
          <span className="sp-recipe-card__cuisine">{recipe.cuisine}</span>
          <span className="sp-recipe-card__time" aria-hidden="true">
            ⏱ {recipe.prep_minutes} min
          </span>
        </div>

        <h3 className="sp-recipe-card__name">{recipe.name}</h3>

        {recipe.description ? (
          <p className="sp-recipe-card__desc">{recipe.description}</p>
        ) : null}

        {recipe.tags.length > 0 ? (
          <div className="sp-chips" aria-hidden="true">
            {shown.map((t) => (
              <span className="sp-chip" key={t}>
                {t}
              </span>
            ))}
            {extra > 0 ? <span className="sp-chip">+{extra}</span> : null}
          </div>
        ) : null}

        <div className="sp-recipe-card__foot">
          <span className="sp-recipe-card__count">
            🧺 {recipe.ingredient_count} ingredient
            {recipe.ingredient_count === 1 ? "" : "s"}
          </span>
          <span className="sp-cta" aria-hidden="true">
            {selected ? "Picked ✓" : "Pick this"}
          </span>
        </div>
      </button>
    </div>
  );
}
