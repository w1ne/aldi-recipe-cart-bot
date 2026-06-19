// Typed client for the ALDI Hackathon API. Open CORS, no auth — usable from
// both the browser and the Cloudflare Pages Function.
import type {
  Category,
  ProductOption,
  RecipeDetail,
  RecipeSummary,
  RoutePlan,
  Store,
  StoreGridData,
} from "./types";

// Allow overriding the base URL from the Pages Function env (set on globalThis)
// without depending on Node's `process` typings in the browser/worker build.
const envBase = (globalThis as { ALDI_BASE?: string }).ALDI_BASE;
export const ALDI_BASE = envBase || "https://hackhaton.internal.zrcn.dev";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${ALDI_BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ALDI API ${path} -> ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function listCategories(): Promise<{ categories: Category[] }> {
  return get("/api/categories");
}

export function searchRecipes(q?: string, tag?: string): Promise<{ count: number; recipes: RecipeSummary[] }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return get(`/api/recipes${qs ? `?${qs}` : ""}`);
}

export function getRecipe(
  id: number,
  opts: { portions?: number; exclude_pantry?: boolean } = {}
): Promise<RecipeDetail> {
  const params = new URLSearchParams();
  if (opts.portions != null) params.set("portions", String(opts.portions));
  if (opts.exclude_pantry != null) params.set("exclude_pantry", String(opts.exclude_pantry));
  const qs = params.toString();
  return get(`/api/recipes/${id}${qs ? `?${qs}` : ""}`);
}

export function listStores(): Promise<{ stores: Store[] }> {
  return get("/api/stores");
}

export function getStoreGrid(storeId: number): Promise<StoreGridData> {
  return get(`/api/stores/${storeId}/grid`);
}

export function getRoutePlan(
  storeId: number,
  opts: { recipe_id?: number; recipe_ids?: number[]; categories?: number[]; exclude_pantry?: boolean } = {}
): Promise<RoutePlan> {
  const params = new URLSearchParams();
  if (opts.recipe_id != null) params.set("recipe_id", String(opts.recipe_id));
  if (opts.recipe_ids?.length) params.set("recipe_ids", opts.recipe_ids.join(","));
  if (opts.categories?.length) params.set("categories", opts.categories.join(","));
  if (opts.exclude_pantry != null) params.set("exclude_pantry", String(opts.exclude_pantry));
  const qs = params.toString();
  return get(`/api/stores/${storeId}/route-plan${qs ? `?${qs}` : ""}`);
}

export function searchProducts(opts: {
  category_id?: number;
  ingredient_key?: string;
  q?: string;
  max_price?: number;
  sort?: "price" | "wholesale_price" | "margin";
}): Promise<{ products: ProductOption[] }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v != null) params.set(k, String(v));
  }
  const qs = params.toString();
  return get(`/api/products${qs ? `?${qs}` : ""}`);
}
