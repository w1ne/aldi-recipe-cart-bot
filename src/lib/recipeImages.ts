// Dish photos. The ALDI recipe API has no image field, so we render an
// AI-generated photo of the dish (no stock-image licensing concerns) keyed by
// the recipe name — deterministic per dish. A cuisine emoji is the fallback
// when the image can't load (offline / blocked).
export function dishImageUrl(name: string, w = 480, h = 300): string {
  const prompt = encodeURIComponent(
    `${name}, plated dish, appetizing, professional food photography, natural light`
  );
  // pollinations.ai returns a generated image for the prompt; ?nologo keeps it clean.
  return `https://image.pollinations.ai/prompt/${prompt}?width=${w}&height=${h}&nologo=true`;
}

const CUISINE_EMOJI: Record<string, string> = {
  italian: "🍝",
  mexican: "🌮",
  thai: "🍜",
  greek: "🥗",
  american: "🥞",
  asian: "🥢",
};

export function cuisineEmoji(cuisine: string): string {
  return CUISINE_EMOJI[cuisine.toLowerCase()] ?? "🍽️";
}
