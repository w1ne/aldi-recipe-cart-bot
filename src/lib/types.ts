// ============================================================================
// Shared contracts for the ALDI Recipe-to-Cart assistant.
// Every component and the chat function code against THESE types. Field names
// mirror the real ALDI Hackathon API responses verbatim — do not rename them.
// ============================================================================

// ---------- Raw ALDI API shapes ----------

export interface RecipeSummary {
  id: number;
  name: string;
  description: string;
  cuisine: string;
  base_portions: number;
  prep_minutes: number;
  tags: string[];
  ingredient_count: number;
}

export interface ProductOption {
  id: number;
  category_id: number;
  category: string;
  name: string;
  price: number;
  wholesale_price: number;
  size: string;
  unit: string;
  unit_amount: number;
  ingredient_key: string;
  packs_needed: number;
  line_price: number;
  line_wholesale: number;
  line_margin: number;
}

export interface Ingredient {
  ingredient_key: string;
  name: string;
  amount: number;
  unit: string;
  category_id: number;
  category: string;
  pantry_staple: boolean;
  scaled_amount: number;
  include_in_shopping_list: boolean;
  product_options: ProductOption[];
  cheapest_option_id: number;
  max_profit_option_id: number;
}

export interface RecipeDetailSummary {
  cheapest_basket_total: number;
  profit_optimized_basket_total: number;
  profit_optimized_aldi_margin: number;
  shopping_category_ids: number[];
}

export interface RecipeDetail {
  recipe: RecipeSummary;
  portions: number;
  scale: number;
  exclude_pantry: boolean;
  ingredients: Ingredient[];
  summary: RecipeDetailSummary;
}

export interface Store {
  id: number;
  name: string;
  // Geocoded fields from the ALDI stores API (used by the in-chat map).
  lat?: number;
  lng?: number;
  city?: string;
  address?: string;
  grid_size?: number;
  // Any further fields are passed through untouched.
  [key: string]: unknown;
}

export interface GridCell {
  x: number;
  y: number;
  type: "aisle" | "entrance" | "checkout";
  category_ids: number[];
  categories: string[];
  label?: string;
}

export interface StoreGridData {
  store_id: number;
  store_name: string;
  width: number;
  height: number;
  cells: GridCell[];
}

export interface PathPoint {
  x: number;
  y: number;
}

export interface RouteStop {
  order: number;
  x: number;
  y: number;
  category_id: number;
  category: string;
  label: string;
  steps_from_previous: number;
}

export interface RoutePlan {
  store_id: number;
  store_name: string;
  required_category_ids: number[];
  unavailable_category_ids: number[];
  stops: RouteStop[];
  total_steps: number;
  path: PathPoint[];
}

export interface Category {
  id: number;
  name: string;
}

// ---------- Basket optimization (client-side) ----------

export type OptimizeMode = "cheapest" | "profit" | "balanced";

export interface BasketLine {
  ingredient_key: string;
  ingredient_name: string;
  chosen: ProductOption;
}

export interface BasketTotals {
  customer_total: number; // sum of line_price
  aldi_margin: number; // sum of line_margin (price - wholesale)
}

// ---------- Chat <-> /api/chat function contract ----------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Structured payloads the chat function attaches to an assistant turn so the
// UI can render rich cards / the grid instead of plain text. Discriminated by
// `type`. The function collects these from tool results, in call order.
export type Artifact =
  | { type: "recipes"; recipes: RecipeSummary[] }
  | { type: "recipe"; detail: RecipeDetail }
  | { type: "stores"; stores: Store[] }
  | { type: "route"; plan: RoutePlan; grid: StoreGridData };

export interface ChatResponse {
  message: string; // assistant prose
  artifacts: Artifact[]; // rich UI payloads, in order
}

export interface ChatRequest {
  messages: ChatMessage[];
}

// ---------- Component prop contracts (locked for parallel build) ----------

export interface RecipeCardProps {
  recipe: RecipeSummary;
  // "Pick this recipe" with the chosen number of persons (servings)
  onSelect?: (id: number, persons: number) => void;
  selected?: boolean;
}

export interface ProductOptionsProps {
  ingredient: Ingredient;
  mode: OptimizeMode; // which option to highlight
  // chosen option id for this ingredient under the active mode
  chosenId: number;
  onChoose?: (ingredientKey: string, optionId: number) => void;
}

export interface BasketPanelProps {
  detail: RecipeDetail;
  // resolved selection per ingredient_key -> option id for the active mode
  selection: Record<string, number>;
  // active basket mode + setter for the customer-facing toggle. Labels are
  // customer-neutral (Cheapest / Balanced / Premium) — ALDI margin is NEVER shown.
  mode?: OptimizeMode;
  onModeChange?: (mode: OptimizeMode) => void;
}

export interface StoreGridProps {
  grid: StoreGridData;
  plan: RoutePlan;
  // when true, the basket walks the path on mount (the showpiece animation)
  animate?: boolean;
  // Controlled mode (used by RouteGuide). When provided (>= 0) the internal
  // auto-run RAF is disabled; the cart sits at this stop's position, stops
  // 0..controlledStopIndex are lit, and the cart tweens between the previous
  // and the new index whenever it changes. When undefined, the existing
  // auto-play behavior is 100% preserved.
  controlledStopIndex?: number;
}
