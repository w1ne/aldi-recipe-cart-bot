// Dish photos. The ALDI recipe API has no image field, so we render a real
// food photo keyed by the dish name (deterministic per dish). We use
// LoremFlickr — a free, no-key Creative-Commons photo CDN that resolves
// reliably as a plain <img> src (the previous AI generator was flaky and often
// failed to load, leaving cards with bare emoji). A cuisine emoji stays as the
// last-resort fallback when even that can't load (offline / blocked).

// Words that don't help an image search — dropped so the keywords stay on the
// actual food (e.g. "Creamy Thai Chicken Curry" -> "thai,chicken,curry").
const STOPWORDS = new Set([
  "with", "and", "the", "a", "of", "in", "on", "over", "style", "homemade",
  "classic", "fresh", "creamy", "easy", "quick", "mixed", "served",
]);

function keywords(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 3);
  // Always anchor on food so generic names still return a plate, not a person.
  return [...words, "food"].join(",");
}

// Small stable hash so each dish always gets the SAME photo (no flicker between
// renders) while different dishes get different photos.
function lock(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}

export function dishImageUrl(name: string, w = 480, h = 300): string {
  return `https://loremflickr.com/${w}/${h}/${keywords(name)}?lock=${lock(name)}`;
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
