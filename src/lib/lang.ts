// Pure, React-free language module. Safe to import from the Cloudflare worker
// (functions/api/chat.ts) without pulling React into the worker bundle.
// The React i18n context (i18n.tsx) re-exports these so the UI keeps one import.

export type Lang = "en" | "ua" | "ru" | "hu" | "es";

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ua", label: "Українська", flag: "🇺🇦" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "hu", label: "Magyar", flag: "🇭🇺" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

// Map a navigator language tag (e.g. "uk-UA", "ru", "hu-HU") to an internal code.
// Note: Ukrainian's ISO code is "uk", not "ua".
export function detectLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  const tags = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean);
  for (const tag of tags) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "uk" || base === "ua") return "ua";
    if (base === "ru") return "ru";
    if (base === "hu") return "hu";
    if (base === "es") return "es";
    if (base === "en") return "en";
  }
  return "en";
}

// Instruction appended to the system prompt so the assistant replies in-language.
// Product/recipe names from the ALDI API are left as-is.
export function langInstruction(lang: Lang): string {
  switch (lang) {
    case "ua":
      return "Always respond to the user in Ukrainian. Keep ALDI product and recipe names exactly as provided by the tools (do not translate brand/product names).";
    case "ru":
      return "Always respond to the user in Russian. Keep ALDI product and recipe names exactly as provided by the tools (do not translate brand/product names).";
    case "hu":
      return "Always respond to the user in Hungarian. Keep ALDI product and recipe names exactly as provided by the tools (do not translate brand/product names).";
    case "es":
      return "Always respond to the user in Spanish. Keep ALDI product and recipe names exactly as provided by the tools (do not translate brand/product names).";
    default:
      return "Always respond to the user in English.";
  }
}

// Normalize an arbitrary incoming value (e.g. request body `language`) to a Lang.
export function asLang(value: unknown): Lang {
  return LANGS.some((l) => l.code === value) ? (value as Lang) : "en";
}
