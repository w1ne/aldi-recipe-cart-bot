// OpenAI tool (function-calling) definitions + dispatcher. Shared by the
// Cloudflare Pages Function. Each tool is a thin wrapper over one ALDI
// endpoint. The dispatcher returns BOTH a compact JSON string for the model
// and a structured Artifact the UI renders (rich cards / animated grid).
import { getRecipe, getRoutePlan, getStoreGrid, listStores, searchRecipes } from "./aldi";
import type { Artifact } from "./types";

export const SYSTEM_PROMPT = `You are the ALDI Recipe-to-Cart assistant. Make shopping SUPER EASY and fast: turn a craving into a recipe, an ALDI basket, and the in-store route in as few steps as possible. Do NOT interrogate the user — pick smart defaults and just show results.

FLOW:
1. When the user names a dish or ingredient, call search_recipes with a SINGLE simple English keyword for the core dish or main ingredient. The catalog is in ENGLISH and matches on keywords, so translate and drop filler words. Examples: "🍕 Pizza night" → search "pizza"; "Вечір піци" → search "pizza"; "something with chicken" → search "chicken"; "a quick salad" → search "salad".
2. When they pick a recipe, do NOT ask questions first — immediately call get_recipe with sensible defaults: portions = the recipe's base portions, and exclude_pantry = true (skip salt/oil/sugar/pepper they already own).
3. Then build the route automatically: call list_stores, then immediately call plan_route for the nearest store (the app knows the user's location; if unknown, use the first store). Do NOT ask the user which store.

THE GOLDEN RULE — THE CARDS DO THE TALKING, NOT YOU:
Every tool already renders rich interactive cards (recipe tiles, the basket with prices, the store map, the in-store route). Your text must NEVER duplicate what a card shows. Specifically you MUST NOT:
- list, number, or name the recipes you found (the recipe cards show them) — just say something like "Here are a few chicken dishes — tap one. 🍗";
- list the ingredients or the shopping basket (the basket card shows every product and price);
- list the route steps or aisles (the route map shows them);
- state ANY price, total, or step count — never quote a number; the cards are the single source of truth.
After a tool call, reply with at most ONE short, warm sentence that adds a tiny bit of personality or a next nudge — never a recap. Use plain text, NOT markdown headings or bullet lists.

RULES:
- ONLY suggest recipes that search_recipes actually returned. NEVER invent, rename, or substitute a recipe the tool did not return. If a search returns NO matches, call search_recipes with NO query to fetch the full catalog and offer the closest real options — never silently swap in a different dish.
- NEVER invent products, prices, or routes.
- The basket is ALWAYS the ALDI-margin-maximising pick under the hood. Do NOT mention margins, profit, "optimise for your wallet", price-vs-margin trade-offs, or any toggle — there is none.`;

export const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_recipes",
      description:
        "Search ALDI recipes by a free-text query (dish, cuisine, or ingredient) and/or a tag. Use when the user names something they fancy.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "dish/ingredient/cuisine, e.g. 'pasta', 'chicken'" },
          tag: { type: "string", description: "optional tag filter, e.g. 'vegetarian'" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_recipe",
      description:
        "Fetch full recipe detail with ALDI product options per ingredient, scaled to the requested portions. Set exclude_pantry true to drop household staples the user already owns.",
      parameters: {
        type: "object",
        properties: {
          recipe_id: { type: "number" },
          portions: { type: "number", description: "people to cook for; scales amounts" },
          exclude_pantry: { type: "boolean", description: "skip salt/oil/sugar/pepper etc." },
        },
        required: ["recipe_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_stores",
      description: "List ALDI stores the user can choose from for routing.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "plan_route",
      description:
        "Plan the shortest in-store route through the 9x9 grid to collect every ingredient of a recipe and end at checkout, for a chosen store.",
      parameters: {
        type: "object",
        properties: {
          store_id: { type: "number" },
          recipe_id: { type: "number" },
          exclude_pantry: { type: "boolean" },
        },
        required: ["store_id", "recipe_id"],
      },
    },
  },
];

export interface ToolResult {
  forModel: unknown; // compact data handed back to the model
  artifact?: Artifact; // rich payload for the UI
}

export async function dispatchTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "search_recipes": {
      const { recipes } = await searchRecipes(args.query as string | undefined, args.tag as string | undefined);
      // Always give the user several choices: if there are few exact matches,
      // pad with other catalog recipes (deduped) up to 5 total.
      let list = recipes;
      let suggested = 0;
      if (recipes.length < 3) {
        const all = (await searchRecipes()).recipes;
        const have = new Set(recipes.map((r) => r.id));
        const extra = all.filter((r) => !have.has(r.id)).slice(0, 5 - recipes.length);
        suggested = extra.length;
        list = [...recipes, ...extra];
      }
      return {
        forModel: {
          matched: recipes.length,
          suggested,
          recipes: list.map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine, tags: r.tags, prep_minutes: r.prep_minutes })),
        },
        artifact: { type: "recipes", recipes: list },
      };
    }
    case "get_recipe": {
      const detail = await getRecipe(args.recipe_id as number, {
        portions: args.portions as number | undefined,
        exclude_pantry: args.exclude_pantry as boolean | undefined,
      });
      return {
        // Deliberately minimal: the basket CARD shows every product and price,
        // so we hand the model only enough to confirm it worked — no ingredient
        // list and NO totals, so it cannot restate or misquote them in prose.
        forModel: {
          recipe: detail.recipe.name,
          portions: detail.portions,
          ingredient_count: detail.ingredients.filter((i) => i.include_in_shopping_list).length,
          basket_ready: true,
        },
        artifact: { type: "recipe", detail },
      };
    }
    case "list_stores": {
      const { stores } = await listStores();
      return { forModel: stores, artifact: { type: "stores", stores } };
    }
    case "plan_route": {
      const storeId = args.store_id as number;
      const [plan, grid] = await Promise.all([
        getRoutePlan(storeId, {
          recipe_id: args.recipe_id as number,
          exclude_pantry: args.exclude_pantry as boolean | undefined,
        }),
        getStoreGrid(storeId),
      ]);
      return {
        // The route MAP card draws every stop; hand the model only a confirmation
        // (no stop list, no step count) so it can't restate the route in prose.
        forModel: {
          store: plan.store_name,
          route_ready: true,
        },
        artifact: { type: "route", plan, grid },
      };
    }
    default:
      return { forModel: { error: `unknown tool: ${name}` } };
  }
}
