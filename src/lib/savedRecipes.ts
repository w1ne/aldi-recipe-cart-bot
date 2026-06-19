// ============================================================================
// savedRecipes — anonymous-first "My Recipes" store, persisted to localStorage.
// A tiny external store wired through useSyncExternalStore so every component
// (RecipeCard hearts, the header count, the drawer) stays in sync without a
// provider. No dependencies.
// ============================================================================
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "aldi.savedRecipes";

// Minimal shape we need to render a tile and re-ask the dish.
export interface SavedRecipe {
  id: number;
  name: string;
  cuisine: string;
  base_portions: number;
}

let cache: SavedRecipe[] = load();
const listeners = new Set<() => void>();

function load(): SavedRecipe[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: keep only well-formed entries.
    return parsed.filter(
      (r): r is SavedRecipe =>
        r && typeof r.id === "number" && typeof r.name === "string"
    );
  } catch {
    return [];
  }
}

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* quota / private mode — keep the in-memory copy */
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SavedRecipe[] {
  return cache;
}

const EMPTY: SavedRecipe[] = [];
function getServerSnapshot(): SavedRecipe[] {
  return EMPTY;
}

// Sync across tabs/windows.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      cache = load();
      emit();
    }
  });
}

export function isSaved(id: number): boolean {
  return cache.some((r) => r.id === id);
}

export function toggleRecipe(recipe: SavedRecipe): void {
  if (isSaved(recipe.id)) {
    cache = cache.filter((r) => r.id !== recipe.id);
  } else {
    cache = [
      { id: recipe.id, name: recipe.name, cuisine: recipe.cuisine, base_portions: recipe.base_portions },
      ...cache,
    ];
  }
  persist();
  emit();
}

export function removeRecipe(id: number): void {
  if (!isSaved(id)) return;
  cache = cache.filter((r) => r.id !== id);
  persist();
  emit();
}

/** Subscribe to the saved-recipes list (kept in sync across components). */
export function useSavedRecipes(): SavedRecipe[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
