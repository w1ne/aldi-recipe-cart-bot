import { useState } from "react";
import { useI18n } from "../lib/i18n";
import { dishImageUrl, cuisineEmoji } from "../lib/recipeImages";
import "./banner.css";

interface DishBannerProps {
  /** Send a natural-language message for the tapped dish. */
  onPick: (text: string) => void;
  disabled?: boolean;
}

// A handful of crowd-pleasers for the visual first impression. `cuisine` only
// feeds the emoji fallback when the image can't load.
const DISHES: { name: string; cuisine: string }[] = [
  { name: "Pizza Margherita", cuisine: "italian" },
  { name: "Spaghetti Bolognese", cuisine: "italian" },
  { name: "Caesar Salad", cuisine: "american" },
  { name: "Chicken Curry", cuisine: "asian" },
  { name: "Beef Tacos", cuisine: "mexican" },
  { name: "Pancakes", cuisine: "american" },
];

// Local label map (per house rules — no edits to the shared i18n dictionary).
const BANNER: Record<string, { headline: string; fancy: (dish: string) => string }> = {
  en: { headline: "Tap a dish to get cooking", fancy: (d) => `I fancy ${d}` },
  ua: { headline: "Торкніться страви — і почнемо готувати", fancy: (d) => `Хочу ${d}` },
  ru: { headline: "Нажмите на блюдо — и начнём готовить", fancy: (d) => `Хочу ${d}` },
  hu: { headline: "Koppints egy ételre, és főzzünk", fancy: (d) => `${d} kívánok` },
  es: { headline: "Toca un plato y a cocinar", fancy: (d) => `Me apetece ${d}` },
};

/**
 * DishBanner — a horizontal, mobile-friendly strip of appetizing dishes shown
 * on first load. Tapping a dish kicks off the chat with a natural message.
 */
export default function DishBanner({ onPick, disabled }: DishBannerProps) {
  const { t, lang } = useI18n();
  const labels = BANNER[lang] ?? BANNER.en;

  return (
    <div className="dish-banner" role="group" aria-label={labels.headline}>
      <div className="dish-banner__overlay-head">
        <span className="dish-banner__tagline">{t("app.tagline")}</span>
        <span className="dish-banner__headline">{labels.headline}</span>
      </div>

      <div className="dish-banner__strip">
        {DISHES.map((dish) => (
          <DishTile
            key={dish.name}
            name={dish.name}
            cuisine={dish.cuisine}
            disabled={disabled}
            onPick={() => onPick(labels.fancy(dish.name))}
          />
        ))}
      </div>
    </div>
  );
}

function DishTile({
  name,
  cuisine,
  disabled,
  onPick,
}: {
  name: string;
  cuisine: string;
  disabled?: boolean;
  onPick: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <button
      type="button"
      className="dish-banner__tile"
      onClick={onPick}
      disabled={disabled}
      aria-label={name}
    >
      <span className="dish-banner__photo" aria-hidden="true">
        {imgOk ? (
          <img
            src={dishImageUrl(name, 240, 240)}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="dish-banner__photo-fallback">{cuisineEmoji(cuisine)}</span>
        )}
      </span>
      <span className="dish-banner__name">{name}</span>
    </button>
  );
}
