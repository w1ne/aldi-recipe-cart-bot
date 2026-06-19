import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { dishImageUrl, cuisineEmoji } from "../lib/recipeImages";
import { useSavedRecipes, removeRecipe, type SavedRecipe } from "../lib/savedRecipes";
import "./myrecipes.css";

interface MyRecipesProps {
  open: boolean;
  onClose: () => void;
}

// Local label map (per house rules — keep the shared i18n dictionary lean).
const MR: Record<
  string,
  { title: string; empty: string; hint: string; close: string; remove: string }
> = {
  en: {
    title: "My Recipes",
    empty: "No saved recipes yet",
    hint: "Tap ♥ on a dish to save it here.",
    close: "Close",
    remove: "Remove",
  },
  ua: {
    title: "Мої рецепти",
    empty: "Поки немає збережених рецептів",
    hint: "Торкніться ♥ на страві, щоб зберегти її тут.",
    close: "Закрити",
    remove: "Прибрати",
  },
  ru: {
    title: "Мои рецепты",
    empty: "Пока нет сохранённых рецептов",
    hint: "Нажмите ♥ на блюде, чтобы сохранить его здесь.",
    close: "Закрыть",
    remove: "Убрать",
  },
  hu: {
    title: "Receptjeim",
    empty: "Még nincs mentett recept",
    hint: "Koppints a ♥ ikonra egy ételnél a mentéshez.",
    close: "Bezárás",
    remove: "Eltávolítás",
  },
  es: {
    title: "Mis Recetas",
    empty: "Aún no hay recetas guardadas",
    hint: "Toca ♥ en un plato para guardarlo aquí.",
    close: "Cerrar",
    remove: "Quitar",
  },
};

// Mirror DishBanner's natural re-ask phrasing per language.
const FANCY: Record<string, (dish: string) => string> = {
  en: (d) => `I fancy ${d}`,
  ua: (d) => `Хочу ${d}`,
  ru: (d) => `Хочу ${d}`,
  hu: (d) => `${d} kívánok`,
  es: (d) => `Me apetece ${d}`,
};

/**
 * MyRecipes — a bottom sheet listing the user's saved dishes. Tapping a dish
 * re-asks it by dispatching a window `aldi:ask` event that Chat listens for.
 */
export default function MyRecipes({ open, onClose }: MyRecipesProps) {
  const { lang } = useI18n();
  const saved = useSavedRecipes();
  const labels = MR[lang] ?? MR.en;
  const fancy = FANCY[lang] ?? FANCY.en;

  if (!open) return null;

  const ask = (recipe: SavedRecipe) => {
    window.dispatchEvent(
      new CustomEvent("aldi:ask", { detail: { text: fancy(recipe.name) } })
    );
    onClose();
  };

  return (
    <div className="myr" role="dialog" aria-modal="true" aria-label={labels.title}>
      <button type="button" className="myr__scrim" aria-label={labels.close} onClick={onClose} />

      <div className="myr__sheet" role="document">
        <div className="myr__grabber" aria-hidden="true" />
        <div className="myr__head">
          <h2 className="myr__title">
            <span aria-hidden="true">♥</span> {labels.title}
            {saved.length > 0 ? <span className="myr__count">{saved.length}</span> : null}
          </h2>
          <button type="button" className="myr__close" onClick={onClose} aria-label={labels.close}>
            ✕
          </button>
        </div>

        {saved.length === 0 ? (
          <div className="myr__empty">
            <span className="myr__empty-emoji" aria-hidden="true">♡</span>
            <p className="myr__empty-title">{labels.empty}</p>
            <p className="myr__empty-hint">{labels.hint}</p>
          </div>
        ) : (
          <ul className="myr__list">
            {saved.map((r) => (
              <li key={r.id} className="myr__item">
                <button
                  type="button"
                  className="myr__pick"
                  onClick={() => ask(r)}
                  aria-label={fancy(r.name)}
                >
                  <SavedThumb name={r.name} cuisine={r.cuisine} />
                  <span className="myr__name">{r.name}</span>
                </button>
                <button
                  type="button"
                  className="myr__remove"
                  onClick={() => removeRecipe(r.id)}
                  aria-label={`${labels.remove} — ${r.name}`}
                  title={labels.remove}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SavedThumb({ name, cuisine }: { name: string; cuisine: string }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <span className="myr__thumb" aria-hidden="true">
      {imgOk ? (
        <img
          src={dishImageUrl(name, 120, 120)}
          alt=""
          loading="lazy"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="myr__thumb-fallback">{cuisineEmoji(cuisine)}</span>
      )}
    </span>
  );
}
