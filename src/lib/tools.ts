// OpenAI tool (function-calling) definitions + dispatcher. Shared by the
// Cloudflare Pages Function. Each tool is a thin wrapper over one ALDI
// endpoint. The dispatcher returns BOTH a compact JSON string for the model
// and a structured Artifact the UI renders (rich cards / animated grid).
import { getRecipe, getRoutePlan, getStoreGrid, listStores, searchRecipes } from "./aldi";
import type { Artifact } from "./types";

export const SYSTEM_PROMPT = `You are the ALDI Recipe-to-Cart assistant. You help a shopper turn a craving into a recipe, the right ALDI products, and the smartest in-store route to checkout.

FLOW:
1. When the user names a dish or ingredient ("I fancy pasta", "something with chicken"), call search_recipes and present the matching options briefly.
2. When they pick a recipe, ALWAYS ask how many portions they're cooking for if not stated, and offer to skip common pantry staples (salt, oil, sugar, pepper) they likely already own. Then call get_recipe with those settings.
3. To build the route, ask which store (call list_stores if they haven't chosen) and then call plan_route.

RULES:
- NEVER invent products, prices, or routes. Only state product names, sizes and prices that came back from a tool call. If unsure, call a tool.
- The UI renders rich recipe cards, product options, a live basket with ALDI's margin, and an animated store map — so keep your prose short and friendly; let the cards do the heavy lifting.
- ALDI cares about margin: when relevant, mention that the basket can be optimized for the customer's wallet or ALDI's margin (the user can toggle this), and that staples can be skipped.
- Be concise, warm, and decisive. One short paragraph max per turn.`;

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
      return {
        forModel: recipes.map((r) => ({ id: r.id, name: r.name, cuisine: r.cuisine, tags: r.tags, prep_minutes: r.prep_minutes })),
        artifact: { type: "recipes", recipes },
      };
    }
    case "get_recipe": {
      const detail = await getRecipe(args.recipe_id as number, {
        portions: args.portions as number | undefined,
        exclude_pantry: args.exclude_pantry as boolean | undefined,
      });
      return {
        forModel: {
          recipe: detail.recipe.name,
          portions: detail.portions,
          ingredients: detail.ingredients.map((i) => ({ name: i.name, amount: i.scaled_amount, unit: i.unit, pantry_staple: i.pantry_staple })),
          cheapest_total: detail.summary.cheapest_basket_total,
          profit_total: detail.summary.profit_optimized_basket_total,
          aldi_margin: detail.summary.profit_optimized_aldi_margin,
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
        forModel: {
          store: plan.store_name,
          total_steps: plan.total_steps,
          stops: plan.stops.map((s) => ({ order: s.order, category: s.category, label: s.label })),
        },
        artifact: { type: "route", plan, grid },
      };
    }
    default:
      return { forModel: { error: `unknown tool: ${name}` } };
  }
}
