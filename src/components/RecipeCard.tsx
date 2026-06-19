import { useState } from "react";
import type { RecipeCardProps } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { dishImageUrl, cuisineEmoji } from "../lib/recipeImages";
import "./showpiece.css";

const MIN_PERSONS = 1;
const MAX_PERSONS = 12;

/**
 * RecipeCard — a compact dish tile for the horizontal strip. Shows a photo,
 * cuisine, prep time, name, a short description and tags, then a persons
 * stepper next to a "Pick this" button. Picking sends the chosen servings so
 * the basket is built for the right number of people right away.
 */
export default function RecipeCard({ recipe, onSelect, selected }: RecipeCardProps) {
  const { t } = useI18n();
  const [imgOk, setImgOk] = useState(true);
  const [persons, setPersons] = useState(recipe.base_portions || 2);

  const shown = recipe.tags.slice(0, 3);
  const extra = recipe.tags.length - shown.length;

  return (
    <div className="sp">
      <div className={`sp-recipe-card${selected ? " is-selected" : ""}`}>
        {selected ? (
          <span className="sp-recipe-card__check" aria-hidden="true">
            ✓
          </span>
        ) : null}

        <div className="sp-recipe-card__photo" aria-hidden="true">
          {imgOk ? (
            <img
              src={dishImageUrl(recipe.name, 320, 180)}
              alt=""
              loading="lazy"
              onError={() => setImgOk(false)}
            />
          ) : (
            <span className="sp-recipe-card__photo-fallback">
              {cuisineEmoji(recipe.cuisine)}
            </span>
          )}
        </div>

        <div className="sp-recipe-card__head">
          <span className="sp-recipe-card__cuisine">{recipe.cuisine}</span>
          <span className="sp-recipe-card__time" aria-hidden="true">
            ⏱ {recipe.prep_minutes} {t("recipe.min")}
          </span>
        </div>

        <h3 className="sp-recipe-card__name">{recipe.name}</h3>

        {recipe.description ? (
          <p className="sp-recipe-card__desc">{recipe.description}</p>
        ) : null}

        {recipe.tags.length > 0 ? (
          <div className="sp-chips" aria-hidden="true">
            {shown.map((tg) => (
              <span className="sp-chip" key={tg}>
                {tg}
              </span>
            ))}
            {extra > 0 ? <span className="sp-chip">+{extra}</span> : null}
          </div>
        ) : null}

        <div className="sp-recipe-card__foot">
          <div className="sp-stepper" role="group" aria-label="Persons">
            <button
              type="button"
              className="sp-stepper__btn"
              onClick={() => setPersons((p) => Math.max(MIN_PERSONS, p - 1))}
              disabled={persons <= MIN_PERSONS}
              aria-label="Fewer persons"
            >
              −
            </button>
            <span className="sp-stepper__val" aria-live="polite">
              👤 {persons}
            </span>
            <button
              type="button"
              className="sp-stepper__btn"
              onClick={() => setPersons((p) => Math.min(MAX_PERSONS, p + 1))}
              disabled={persons >= MAX_PERSONS}
              aria-label="More persons"
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="sp-pick"
            onClick={() => onSelect?.(recipe.id, persons)}
            aria-label={`${t("recipe.pick")} — ${recipe.name}, ${persons}`}
          >
            {t("recipe.pick")}
          </button>
        </div>
      </div>
    </div>
  );
}
