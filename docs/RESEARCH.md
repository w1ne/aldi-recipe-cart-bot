# SOTA Research — World-Class Conversational Grocery Assistant (ALDI, 2026)

> Background research that informed this project's architecture. Cited, cross-verified.
> Status of each item in our build is marked ✅ done / 🔄 in progress / 📋 planned.

## Top 10 concrete actions, ranked by impact

1. **Animated 9×9 route map = the single hero "wow"; open the demo with it.** SVG (well under the ~1k-element Canvas threshold); draw the route with `pathLength`/`stroke-dashoffset`; move the marker with CSS `offset-path` + `offset-distance`, sharing one transition so line and marker travel in sync. — 🔄 (StoreGrid built; route-line visibility bug being fixed + verified)
2. **Never hallucinate a product — ground every product to the real catalog.** Tool returns real catalog rows; the LLM only selects/formats; cards render from structured tool output, not free text. Use JSON-schema `enum` + OpenAI `strict: true`. — ✅ (tools return real ALDI rows; system prompt forbids inventing)
3. **Vercel AI SDK 5 `useChat` + typed `tool-${name}` parts** for generative-UI cards; four tool states map to skeleton → card → error. — ✅ (migrated to AI SDK 5)
4. **Recipe → cart in one tap, portions pre-calibrated to pack sizes**, servings stepper, pantry-staple skip. Hits ALDI's stated bonuses. — ✅ (portions + exclude_pantry; smart questions asked)
5. **Margin optimization shown transparently** as value-matching with a plain-language "why" (63% trust AI more when it explains). — ✅ (BasketPanel 3-way toggle + live margin)
6. **Rich product cards, never text walls** — image, live price, 2–3 attributes, one-tap add. — ✅ (RecipeCard / ProductOptions)
7. **Stream via SSE; aggressively hide latency.** TTFT < 700ms; optimistic user message; skeletons; coalesce token renders per `requestAnimationFrame`. — ✅ (AI SDK streaming) / 📋 (latency polish)
8. **Mobile-first thumb-reach shell:** bottom sheets over top modals, ≥44×44pt targets, `viewport-fit=cover` + `env(safe-area-inset-*)`, `100dvh` (never raw `100vh`). — ✅ (scaffold)
9. **Premium polish fast:** ALDI tokens (navy `#001E5E` primary, light blue `#1FC4F4` route accent, red/orange/yellow waypoints). Animate only `transform`/`opacity` for 60fps. — ✅ (design tokens) 
10. **Rehearse a tight ≤3-min pitch; pre-record a crash-proof fallback video.** Never debug live; optimize for 1–2 features. — 📋 (demo day)

---

## 1. LLM tool-calling chat architecture
- **Agent loop:** request-with-tools → `tool_calls` → execute (parallel, `Promise.all`) → append outputs keyed by `tool_call_id` → re-request; cap iterations (~6–15). Keep < 20 active tools.
- **Reliability:** `strict: true` per function + `additionalProperties: false` + every prop in `required` (optional → `["type","null"]`). Constrained decoding via `enum` masks invalid tokens at generation (stronger than post-hoc validation). Combine with RAG for large catalogs.
- **Generative UI (AI SDK 5):** `streamText({ tools })` + `convertToModelMessages()` + `toUIMessageStreamResponse()`; client `useChat` renders typed `tool-${name}` parts.
- **AI SDK vs hand-rolled on Cloudflare:** SDK gives SSE, typed parts, generative UI, provider abstraction for free. **Two landmines:** Workers have **no `process.env`** — bare `openai()` fails silently → construct provider from the Worker `env` object; streaming may need `compatibility_flags = ["nodejs_compat"]`.
- **Error recovery:** classify errors; backoff w/ jitter for rate limits; feed schema/tool errors back to the model for self-fix; circuit breaker; hard max-iterations.

Sources: developers.openai.com/api/docs/guides/function-calling · ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces · vercel.com/blog/ai-sdk-5 · developers.cloudflare.com/workers-ai/configuration/ai-sdk · bentoml.com · moveworks.com

## 2. Conversational commerce UX
Product cards beat text (~3× vendor-reported); one-tap add with no context switch; show **3 curated options** each with a "why", not a long list; quick-reply chips + scoped intents so users grasp capability in ~5s; handle ambiguity with one focused question or 2–4 buttons; recipe→cart batched with servings recalculation and pantry checkoffs; +/– quantity steppers (dropdowns hurt conversion). Embed the assistant in the search/nav surface, personalize from history and *say so*. Keep a human escape path (Klarna cautionary tale).

Sources: alhena.ai · investors.instacart.com · klarna.com · aboutamazon.com/news/retail/how-to-use-amazon-rufus · baymard.com · spiralscout.com

## 3. Mobile-first PWA checklist
Manifest: name+short_name, 192/512 PNG icons + one **maskable**, stable `id`, `display: standalone` + `display_override`, screenshots, shortcuts. Service worker (Workbox): precache shell (Cache-First, hash-busted), SWR for API, Network-First for HTML, Cache-First+expiry for media. iOS: no `beforeinstallprompt` (build your own A2HS hint); push only when installed (16.4+); assume storage eviction. Viewport: `viewport-fit=cover` + `env(safe-area-inset-*)`; `100dvh` default, `100svh` for must-reach CTAs, never raw `100vh`. CWV p75: LCP ≤ 2.5s, INP ≤ 200ms, CLS < 0.1; animate only `transform`/`opacity`.

Sources: developer.mozilla.org (PWA, env) · web.dev (manifest, workbox, inp, lcp) · developer.chrome.com/docs/workbox · magicbell.com

## 4. In-store route visualization
**SVG, not Canvas** for this scale (accessibility, CSS, DOM events). Route line via `motion.path` `pathLength` 0→1 (or CSS `stroke-dasharray`/`dashoffset`). Walking marker via CSS Motion Path: `offset-path: path(...)` + animate `offset-distance` 0→100%, `offset-rotate: auto` (Baseline since Mar 2022). Numbered waypoints in pickup order. A11y: honor `prefers-reduced-motion` (show full route instantly), pair the map with an **ordered text list** as the accessible source of truth, mark decorative SVG `aria-hidden`.

Sources: css-tricks.com (svg-vs-canvas) · motion.dev (svg-animation, motion-path) · developer.mozilla.org (offset-path, prefers-reduced-motion) · a11y-collective.com

## 5. Hackathon winning factors
Polish + wow beats backend complexity. Optimize 1–2 hero features and make them flawless (ours = the route map). Lead with the wow in the first ~30s; tell a problem→who→payoff story; hit sponsor bonuses with quantified value. ≤3-min demo; never debug live; pre-record an edited fallback. Map explicitly to ALDI's bonuses: (a) maximize margin as transparent value-matching; (b) smart questions = portions stepper + pantry-staple skip.

Sources: info.devpost.com/blog · medium.com/garyyauchan · news.mlh.io

## 6. Design system / visual polish
ALDI palette (unofficial/approx): navy `#001E5E` primary, light blue `#1FC4F4` route accent, red `#E11921` / orange `#F37D1E` / yellow `#FABF11` waypoints, white. Stack: Tailwind v4 (`@theme` CSS vars, OKLCH) + shadcn/ui + Motion. Tokens: spacing 4/8/12/16/24/32/48/64; radius sm4/md8/lg16/full; durations 100/200/300/500ms; ease-out `cubic-bezier(0,0,0.2,1)`, spring `cubic-bezier(0.175,0.885,0.32,1.275)`.

Sources: brandpalettes.com · shadcnspace.com · maviklabs.com · designsystems.surf

---

### Reliability notes
- **Well-corroborated:** agent-loop + strict + enum/RAG grounding; AI-SDK-on-Workers `process.env` gap; SSE default; CWV thresholds; SVG-vs-Canvas; `offset-path` Baseline 2022; thumb-zone; cards>text direction; recipe→cart.
- **Directional/approx:** vendor conversion figures; retry/breaker thresholds; ALDI hex values (unofficial); iOS eviction numbers. The circulating "LCP 2.0s" figure is unverified — use 2.5s.
