// ============================================================================
// checklist.ts — shared "already have / got it" state for a recipe's shopping
// list, persisted to localStorage and synced across every component that reads
// it (BasketPanel, ProductOptions, RouteGuide) via a tiny external store +
// useSyncExternalStore. Semantics: a checked ingredient_key means "I already
// have it / I grabbed it" ⇒ it's struck through and excluded from the remaining
// count and the "You pay" total.
//
// Kept out of types.ts on purpose (that file is owned by another workstream).
// ============================================================================

import { useCallback, useSyncExternalStore } from "react";

type KeySet = Set<string>;

/**
 * Drop every checked (already-have / grabbed) ingredient from a selection map,
 * so totals/counts reflect only what's still to buy.
 */
export function remainingSelection(
  selection: Record<string, number>,
  checked: KeySet
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(selection)) {
    if (!checked.has(key)) out[key] = selection[key];
  }
  return out;
}

const PREFIX = "aldi.checklist.";
const memory = new Map<string, KeySet>();
const listeners = new Map<string, Set<() => void>>();

function storageKey(recipeId: number | string): string {
  return `${PREFIX}${recipeId}`;
}

function load(recipeId: number | string): KeySet {
  const id = String(recipeId);
  const cached = memory.get(id);
  if (cached) return cached;

  let set: KeySet = new Set();
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(storageKey(id));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) set = new Set(arr.filter((k) => typeof k === "string"));
      }
    }
  } catch {
    set = new Set();
  }
  memory.set(id, set);
  return set;
}

function persist(recipeId: string, set: KeySet): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey(recipeId), JSON.stringify([...set]));
    }
  } catch {
    // storage full / unavailable — keep in-memory state, ignore.
  }
}

function emit(recipeId: string): void {
  const subs = listeners.get(recipeId);
  if (subs) for (const fn of subs) fn();
}

function subscribe(recipeId: string, fn: () => void): () => void {
  let subs = listeners.get(recipeId);
  if (!subs) {
    subs = new Set();
    listeners.set(recipeId, subs);
  }
  subs.add(fn);
  return () => {
    subs!.delete(fn);
  };
}

/** Toggle a key's checked state for a recipe and notify subscribers. */
export function toggleChecked(recipeId: number | string, key: string): void {
  const id = String(recipeId);
  const prev = load(id);
  const next = new Set(prev);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  memory.set(id, next);
  persist(id, next);
  emit(id);
}

/** Current checked set for a recipe (read-only snapshot). */
export function getChecked(recipeId: number | string): KeySet {
  return load(recipeId);
}

export interface ChecklistApi {
  /** Checked ingredient_keys ("already have / grabbed"). */
  checked: KeySet;
  isChecked: (key: string) => boolean;
  toggle: (key: string) => void;
  /** How many keys are checked. */
  count: number;
}

/**
 * useChecklist — subscribe a component to a recipe's checked-state store. All
 * components using the same recipeId share one source of truth and re-render
 * together when any of them toggles an item.
 */
export function useChecklist(recipeId: number | string): ChecklistApi {
  const id = String(recipeId);

  const sub = useCallback((fn: () => void) => subscribe(id, fn), [id]);
  const snapshot = useCallback(() => load(id), [id]);

  const checked = useSyncExternalStore(sub, snapshot, snapshot);

  const isChecked = useCallback((key: string) => checked.has(key), [checked]);
  const toggle = useCallback((key: string) => toggleChecked(id, key), [id]);

  return { checked, isChecked, toggle, count: checked.size };
}
