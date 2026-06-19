// Client-side typing for the AI SDK 5 chat stream. The /api/chat function emits
// four tool parts (search_recipes, get_recipe, list_stores, plan_route); each
// tool's `output` carries the rich Artifact the UI renders. We declare a typed
// UIMessage so `useChat()` gives us strongly-typed tool parts.
import type { UIMessage } from "ai";
import type { Artifact } from "./types";

// The object every server tool returns as its `output`.
export interface ToolOutput {
  summary: unknown;
  artifact?: Artifact;
}

// Map of tool name -> { input; output } used to type the UIMessage tool parts.
export type ChatTools = {
  search_recipes: { input: { query?: string; tag?: string }; output: ToolOutput };
  get_recipe: {
    input: { recipe_id: number; portions?: number; exclude_pantry?: boolean };
    output: ToolOutput;
  };
  list_stores: { input: Record<string, never>; output: ToolOutput };
  plan_route: {
    input: { store_id: number; recipe_id: number; exclude_pantry?: boolean };
    output: ToolOutput;
  };
};

export type ChatUIMessage = UIMessage<unknown, never, ChatTools>;
