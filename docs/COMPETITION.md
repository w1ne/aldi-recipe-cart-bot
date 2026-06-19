# Competitive Landscape (June 2026)

Synthesis of three research sweeps — shoppable-recipe apps, in-store wayfinding/route
optimization, and AI conversational grocery assistants + ALDI's own posture. All claims
cross-verified across 2+ sources where possible; confidence caveats at the end.

## TL;DR — where we sit

- **The "craving → recipe → real priced cart at a named retailer" loop is now real and hot**, but very fresh: Instacart-in-ChatGPT shipped Dec 8 2025; DoorDash "Ask DoorDash" and Cooklist (Kroger/Wegmans) are 2026. So this is a **validated, contested** space — not white space on its own.
- **Two parts of our concept are genuinely rare-to-novel:**
  1. **Optimizing the *retailer's* margin** inside a consumer recipe basket — **no shipped consumer product does this.** (Instacart's AI *pricing* experiment was killed Dec 22 2025 after backlash — so it's both uncommon *and* sensitive; frame as customer value, which we do.)
  2. **A recipe-driven, animated, whole-list in-store route** — only positioning-dependent pilots animate store routes, and **nobody chains recipe → route**. Last real precedent: aisle411 + ZipList, **2011** (long dormant).
- **The full chain `dish → recipe → grounded ALDI basket → true in-store route` exists nowhere.** That is our most defensible wedge.
- **ALDI is open ground**: thin apps, no first-party in-store map, ~90% private label (→ margin-framing is on-brand), small ~2,000-SKU catalog (→ grounding + routing are tractable).

---

## 1. Shoppable-recipe / recipe→cart

| Product | Chat? | Cart at real retailer? | In-store route? | Maturity |
|---|---|---|---|---|
| **Instacart** (Ask Instacart, ChatGPT app, Instant Checkout) | Yes | Yes — 1,800+ retailers, in-chat checkout | No | Shipped, leader |
| **DoorDash "Ask DoorDash"** | Yes | Yes (prompt/photo → cart) | No | Pilot (Jun 2026) |
| **Cooklist** (Kroger/Wegmans) | Yes | Yes (agentic, ~50% complete in physical stores) | Partial (list) | Beta 2026 |
| **Samsung Food** (ex-Whisk) | Partial | Yes — 23+ retailers | No | Mature |
| **Amazon** (Alexa+ / Fresh via SideChef) | Yes | Yes | No | Rolling out |
| **Walmart** (Sparky + Tasty/Northfork) | Yes | Catalog yes; recipe→cart roadmap | No | Sparky shipped |
| **Chicory / Northfork / SideChef** (B2B engines) | No (AI matching) | Yes — redirect to carts | No | Mature B2B |
| **Mealime** | No | Yes (Kroger etc.) | Aisle-sorted list | Mature, narrow |

Dead/irrelevant: **Yummly** (shut down Dec 2024), **Kroger Chefbot** (defunct 2020 marketing bot), **SuperCook** (pantry discovery, no cart), **Paprika** (offline organizer).

**Bar:** matching the craving→priced-cart loop is now table stakes among leaders. **"Ask smart questions" (portions, pantry staples) is rare** — only DoorDash explicitly prompts. We do both. ✅

## 2. In-store wayfinding / route optimization

| Name | Route across a list? | Animated? | Real planogram? | Maturity |
|---|---|---|---|---|
| **Dent Reality** | Yes | Yes (AR + path) | Yes | Pilot (M&S) |
| **Oriient** | Yes | Yes (blue-dot + line) | Yes | Prod — 1,500+ stores |
| **Albert Heijn "Find my product"** | Yes | Yes (dynamic map) | Very high | Trial only |
| **Mappedin / Navigine / Situm / Pointr** | Yes/light | Partial (mostly 2D) | Yes | Prod (mostly non-grocery) |
| **aisle411 + ZipList** (2011) | Yes | Partial | Yes | **Dormant** — the one recipe→route precedent |
| **Walmart / Kroger / Tesco / Target** | Per-item pin or **aisle-sorted list** | No | High | Shipped |
| **Google/Apple/Mapsted/Inpixon** | No (point-to-point) | Mixed | Map only | Prod, not grocery |

**Bar:** the dominant *shipped* pattern at big chains is just **"sort your list by aisle number"** — a 1-D proxy, not a real route. True animated whole-list routing ships from essentially nobody (only pilots, all positioning-hardware-dependent). **Our escape hatch: we animate the optimal route on a synthetic store grid from the API — no beacons, no AR, no planogram licensing.** Novel framing, zero-hardware. (Defensibility long-term = real planogram data, not the TSP algorithm.)

## 3. AI conversational grocery assistants + ALDI

| Assistant | Owner | Grounded? | Builds cart? | Route? | Maturity |
|---|---|---|---|---|---|
| Instacart-in-ChatGPT / Ask Instacart | Instacart/OpenAI | Yes | Yes (Instant Checkout) | No | Launched |
| Sparky (+ Wallaby) | Walmart | Yes | Yes | No | Launched Jun 2025 |
| Rufus → "Alexa for Shopping" | Amazon | Yes | Yes (auto-buy pilots) | No | Launched 2024 |
| Kroger Gemini assistant | Kroger/Google | Yes | Yes (dish→recipe→cart) | Partial (aisle-sort) | Rollout Jan 2026 |
| Tesco in-app AI | Tesco | Yes | Yes (dish/budget→basket) | No | Beta 2026 |
| Samsung Food, SideChef, Klarna | — | Yes | Yes (SideChef = best SKU match) | No | Mature/launched |

**No competitor offers an in-store walking route.** Every assistant stops at the cart.

**ALDI posture:** deliberately low-tech, margin-obsessed hard discounter (confirmed). Only the **US app has a cart — and it's Instacart's** "Storefront Pro" tech, not ALDI-built; SÜD/NORD/UK apps are deal/list/store-finder tools. **No consumer ALDI chatbot, no hyperscaler AI deal** (infra partner = TCS). AI use is back-office/margin: GenAI product copy, promo-markdown ML (~29% write-off cut, ALDI SÜD/INFORMS 2025). ~1,400–2,000 SKUs, ~90% private label (30–40% margin vs ~26% branded). Europe is *retreating* from online (UK click-&-collect ended Aug 2024; DE online shop closing Sep 2025) because online overhead erodes discounter pricing power.

---

## What this means for our build

1. **Match grounding from day one** — real ALDI SKUs, substitutions. Ungrounded "LLM emits a list" looks amateur next to Rufus/Sparky/Instacart. ✅ (tools return real API products; no invented items)
2. **The route is the wedge** — lean into the animated, recipe-driven store route + step-by-step guide. It's the one thing no incumbent ships. ✅ (+ animated guide in progress)
3. **Margin = the on-brand ALDI hook** — favor private-label/higher-margin SKUs, shown transparently as customer value, never as hidden markup. ✅ (BasketPanel optimizer)
4. **Ask smart questions** — portions + pantry staples; rare among incumbents. ✅
5. **Don't bet on checkout plumbing** — OpenAI scaled back Instant Checkout (Mar 2026) and ALDI's checkout is already Instacart's. Own **discovery → grounded basket → optimized route**; hand purchase to ALDI's existing flow. (Strategic note for the team — we are not trying to out-build agentic checkout.)
6. **ALDI's small, stable catalog makes grounding + routing far more tractable** than a 40k-SKU grocer — a structural advantage to exploit, not fight.

## Sources (selected)
- Instacart-in-ChatGPT / Instant Checkout — prnewswire.com (302635106) · openai.com/index/instacart-partnership
- Ask Instacart — prnewswire.com (301838150) · DoorDash AI — techcrunch.com/2026/06/11
- Cooklist — grocerydive.com/news/cooklist-agentic-ai-grocery-shopping...
- Samsung Food — news.samsung.com · Amazon Alexa+ — techcrunch.com/2025/02/26 · Walmart Sparky — retailwire.com/walmart-ai-assistant-sparky
- Dent Reality — thegrocer.co.uk (M&S) · Oriient — oriient.me · Albert Heijn — interact-lighting.com · Mappedin — mappedin.com/industries/grocery
- aisle411+ZipList — techcrunch.com/2011/10/10 · Academic: pubsonline.informs.org/doi/10.1287/mksc.1080.0402 (Traveling Salesman Goes Shopping)
- Walmart store maps — walmart.com/cp/find-an-item-store-maps · patents.justia.com/patent/10572932
- ALDI digital relaunch (Instacart, Mar 2026) — prnewswire 302727604 · ALDI private-label refresh — retailbrew.com/2025/09/25 · Instacart pricing pilot shutdown — consumerreports.org (Dec 2025)
- Kroger Gemini — announced Jan 11 2026 · Tesco AI — thegrocer.co.uk · TCS/ALDI — tcs.com newsroom (2025-11-26)

### Confidence caveats
Vendor conversion/lift figures are directional (not audited). Some underlying LLMs undisclosed (Cooklist, DoorDash). "No one surfaces retailer margin" is high-confidence for *public* products but objective functions aren't published. The ~29% markdown figure is single-source (peer-reviewed INFORMS). "Instacart Ada" / "NoMNoM" / ALDI SÜD-NORD re-merger = unverified rumors, excluded.
