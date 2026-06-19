# Feature Inspiration & Backlog (June 2026)

Synthesis of two teardowns — best **grocery** apps (Instacart, Walmart, Tesco, Lidl Plus, Kroger, Amazon Fresh, Albert Heijn, Picnic, Rohlik/Oda, Getir/Flink, Carrefour, Whole Foods) and best **recipe/meal-plan** apps (Samsung Food, Paprika, Mela, Crouton, Kitchen Stories, NYT Cooking, Mealime, SideChef, HelloFresh, AnyList, Cooklist). We adapt *patterns*, not anyone's code/assets/branding.

API anchor: `categories` · `products` (price + wholesale_price + margin) · `10 recipes` (portion scaling + pantry-staple exclusion + profit picks) · `stores` (lat/lng + 9×9 grid) · `route planner`.

## Two confirmed whitespace wins (no competitor does these well — and we can)

1. **Per-serving & per-basket cost label.** Nobody surfaces clean €/serving. Trivial math (`price × qty ÷ servings`), huge trust/budget hook. → **build, S effort**
2. **True turn-by-turn in-store aisle route.** Every major app stops at "aisle number + pinned dot" — *none* ship an actual optimized walking path. Our route planner + 9×9 grid leapfrogs all of them. → **already our hero; lean in.**

## Most-loved patterns (high adopt priority)

| Pattern | Evidence | Our status |
|---|---|---|
| **Aisle-grouped / layout-sorted shopping list** (deduped, pantry-aware) | The single most-praised feature field-wide; Whole Foods *removed* theirs in 2025 → became the #1 complaint | We have categories + ingredient→product + staple exclusion → **nearly free; build it** |
| **"Add all ingredients" + per-line select/deselect** | ~3× faster checkout; universal table-stakes | partial — basket exists; add select/deselect |
| **Pantry-skip "you may already have"** (staples NOT auto-added, confirm) | Albert Heijn / Instacart / Carrefour signature; builds trust | ✅ API supports it; surface it |
| **Servings scaling → flows to cart quantities** | Table-stakes; watch the Samsung Food bug (scale must reach cart qty) | ✅ API scales; add a stepper |
| **My Recipes / Buy Again / favorites** | ~55–65% of orders are repeats; #1 retention rail | 🔄 **building now** (anonymous-first localStorage) |
| **Nearest-store map + one-tap Directions** | >80% of "near me" is mobile; gates catalog credibility | 📋 queued (Leaflet + real lat/lng) |
| **"Bonus / smart-value cooking"** (recipes around best-value picks) | Albert Heijn "Bonus cooking"; our margin signal is unique | 📋 reframe margin as shopper value |
| **Polish: fly-to-cart microinteraction + haptic, deferred no-signup onboarding, WCAG 2.2 AA, PWA offline** | Repeatedly-praised; 2026 a11y is a legal baseline (EAA / US DOJ) | partial (PWA ✅); add the rest |

## Deprioritized for the hackathon
Web recipe import (we have 10 curated recipes), nutrition, real-time collaborative sharing, barcode scan, live delivery tracking (we're in-store, not delivery), dietary filters (need product tags we lack → mock only).

## "My Recipes" design (building now, anonymous-first)

**Model (localStorage `aldi.myrecipes.v1`):** `SavedRecipe { id, title, cuisine?, tags[], savedAt, lastOpenedAt?, servings, rating?, notes?, snapshot:RecipeSummary }` + a global `pantry[]`.

**Flows:**
1. **Save from chat** — ★ button on the recipe card (id + current servings + snapshot). Zero-friction, no login.
2. **Browse** — My Recipes panel: cards, tag filter chips, recently-opened strip, actions (Re-open / Edit tags / Delete).
3. **Re-open → rebuild** — fires the *existing* pipeline (rescale → map ingredients→products → exclude pantry → dedup by product → group by aisle → route). The closed loop NYT/Kitchen Stories never finish and that makes Samsung/Cooklist feel magical — and it's mostly orchestration of endpoints we already have.

**Why it fits:** anonymous-first (no login wall), reuses the whole API pipeline, keeps profit-optimized picks fresh by re-fetching on re-open, and stays chat-native (Cooklist data: conversation captures ~5× the intent of search).

## Recommended build order (post current in-flight work)
1. **Per-serving cost label** (S, whitespace) — cheapest "wow."
2. **Aisle-grouped shopping list** (S–M, most-loved) — we're 80% there.
3. **My Recipes** (M) — 🔄 in progress.
4. **Nearest-store map** (S) — 📋 queued.
5. **Servings stepper + select/deselect** (S).
6. **Polish layer** (fly-to-cart, a11y, onboarding) (S–M).

### Cautions from the teardowns
- **Layout-aware lists are deeply loved — never drop the aisle ordering** (Whole Foods' mistake).
- **Reliability is the universal complaint** (Tesco/Carrefour/Kroger/Whole Foods) — a fast, stable, offline-tolerant PWA is itself a differentiator.
- **Never hallucinate SKUs** — ground every product in the real catalog (Kroger-Gemini / Ask Instacart lesson). ✅ we already do.

## Sources
Per-app sources captured in the teardown transcripts; key anchors: Albert Heijn Steijn (Microsoft + AH newsroom), Instacart developer docs, Tesco AI meal planner (The Grocer), Whole Foods list-removal complaints, Cooklist agentic (Grocery Dive), WCAG 2.2 / Core Web Vitals (web.dev). Confidence: strongest on the two whitespace findings (per-serving cost, true routing) — cross-checked, no competitor found doing either well.
