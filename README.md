# ALDI Recipe-to-Cart Bot

> Name a dish — get a recipe, the right ALDI products, and the smartest in-store route to checkout.

[![Live demo](https://img.shields.io/badge/demo-pages.dev-00005f)](https://aldi-recipe-cart-bot.pages.dev)
[![Built with](https://img.shields.io/badge/Vite%20%2B%20React%20%2B%20TS-blue)](#tech-stack)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-f38020)](https://pages.cloudflare.com)
![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8)

**Live:** https://aldi-recipe-cart-bot.pages.dev

A mobile-first, installable chatbot PWA that turns a craving into a fully-priced ALDI basket and an animated walk-to-checkout route. Built for the ALDI Hackathon.

<!-- TODO: add docs/screenshot.png -->
![Screenshot of the ALDI Recipe-to-Cart Bot (TODO: add docs/screenshot.png)](docs/screenshot.png)

---

## What it does

Chat your way through three steps:

1. **Name a dish** — say *"I fancy pasta"* or *"something with chicken"* and the bot searches ALDI recipes and shows tappable recipe cards.
2. **Pick a recipe & products** — choose one and the bot matches every ingredient to real ALDI products with live prices, rendered as a basket you can tune.
3. **Walk to checkout** — pick a store and an animated in-store route map walks a 🛒 from the entrance through each aisle stop to the checkout.

### Two ALDI bonus angles

- **Profit / margin optimizer toggle** — the basket has a 3-way switch (**Cheapest for me** / **Balanced** / **Best for ALDI**). Customers see their total; ALDI sees its margin. The numbers count-up animate so the margin feels like a win.
- **Smart questions** — before building the basket the bot asks **how many portions** (and scales every ingredient amount) and offers to **skip common pantry staples** (salt, oil, sugar, pepper) the shopper likely already owns, so the basket and route only cover what they actually need to buy.

---

## Architecture

The OpenAI key lives **only** on the server (the Cloudflare Pages Function) and is never shipped in the browser bundle.

```
┌─────────────────────────┐
│  Browser (React PWA)    │   installable, mobile-first
│  recipe cards · basket  │
│  optimizer · route map  │
└───────────┬─────────────┘
            │  POST /api/chat   { messages: [...] }
            ▼
┌─────────────────────────┐
│  /api/chat              │   Cloudflare Pages Function
│  (functions/api/chat.ts)│   ← holds OPENAI_API_KEY (server-side only)
│  streams assistant text │
│  + structured artifacts │
└───────────┬─────────────┘
            │  OpenAI tool-calling loop
            ▼
┌─────────────────────────┐
│  OpenAI (gpt-4o)        │   decides which ALDI tool to call
└───────────┬─────────────┘
            │  tool calls (search_recipes, get_recipe, plan_route, …)
            ▼
┌─────────────────────────┐
│  ALDI Hackathon API     │   https://hackhaton.internal.zrcn.dev
│  recipes · products ·   │   open CORS, no auth
│  stores · route plans   │
└─────────────────────────┘
```

The function runs a bounded tool-calling loop: OpenAI picks ALDI tools, the
function executes them and feeds the results back, and the assistant reply is
returned along with an ordered list of **structured artifacts** (recipes,
recipe detail, stores, route plan + grid) that the UI renders as rich cards
and the animated map instead of plain text.

**Demo mode:** if no `OPENAI_API_KEY` is configured, the function falls back to
a deterministic scripted flow over the *real* ALDI API (no LLM calls) so the
live link still works for judges out of the box.

---

## Tech stack

- **Frontend:** Vite + React 18 + TypeScript
- **PWA:** `vite-plugin-pwa` (installable, app-shell cached, API never cached)
- **Backend:** Cloudflare Pages Function (`functions/api/chat.ts`)
- **AI:** OpenAI Chat Completions with tool/function-calling (default `gpt-4o`)
- **Data:** ALDI Hackathon API (`https://hackhaton.internal.zrcn.dev`)
- **Hosting:** Cloudflare Pages — https://aldi-recipe-cart-bot.pages.dev

---

## Run locally

```bash
git clone git@github.com:w1ne/aldi-recipe-cart-bot.git
cd aldi-recipe-cart-bot
npm install

# Configure secrets. Add your own OpenAI key for full conversational AI,
# or leave OPENAI_API_KEY blank to run in keyless demo mode.
cp .dev.vars.example .dev.vars

# Run the chat function (wrangler) + Vite UI together:
npm run pages:dev
```

`npm run pages:dev` runs `wrangler pages dev` in front of the Vite dev server,
so `/api/chat` works locally exactly as in production.

Other useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite UI only (no chat function; `/api/chat` won't respond) |
| `npm run pages:dev` | Chat function + Vite UI together (use this for the full app) |
| `npm run build` | Type-check then build the static site into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript project type-check |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

---

## Project structure

```
.
├── index.html
├── vite.config.ts              # Vite + PWA config; dev-proxies /api/chat to wrangler
├── .dev.vars.example           # template for local secrets (copy to .dev.vars)
├── functions/
│   └── api/
│       └── chat.ts             # POST /api/chat — Cloudflare Pages Function (holds OpenAI key)
├── src/
│   ├── main.tsx                # React entry
│   ├── App.tsx                 # app shell
│   ├── lib/
│   │   ├── types.ts            # shared contracts: ALDI shapes, Artifact union, chat I/O
│   │   ├── aldi.ts             # typed ALDI Hackathon API client
│   │   ├── tools.ts            # OpenAI tool definitions + system prompt + dispatcher
│   │   ├── basket.ts           # client-side basket optimizer (cheapest/balanced/profit)
│   │   └── chatClient.ts       # fetch wrapper around /api/chat
│   └── components/
│       ├── Chat.tsx            # conversation surface
│       ├── ChatInput.tsx       # composer
│       ├── ChatMessage.tsx     # message + artifact renderer
│       ├── QuickReplies.tsx    # suggested replies
│       ├── RecipeCard.tsx      # tappable recipe tile
│       ├── ProductOptions.tsx  # per-ingredient product picker
│       ├── BasketPanel.tsx     # margin optimizer (the profit showpiece)
│       └── StoreGrid.tsx       # animated in-store route map (the hero)
└── docs/
    ├── DEPLOY.md               # deployment guide
    └── AUTH.md                 # access-control / rate-limiting options
```

---

## Environment / secrets

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | No* | — | OpenAI key. Omit/leave blank to run in keyless demo mode. |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model used by the chat function. |

\* Without a key the app runs in demo mode (scripted flow over the real ALDI API). Add a key for full conversational AI.

- **Locally:** values live in `.dev.vars` (a copy of `.dev.vars.example`).
  `wrangler pages dev` loads them automatically.
- **Production:** set them in the Cloudflare Pages project — either as encrypted
  secrets via `wrangler pages secret put OPENAI_API_KEY` or as environment
  variables in the dashboard. See [docs/DEPLOY.md](docs/DEPLOY.md).

> ⚠️ **Never commit an API key.** `.dev.vars` is gitignored — keep it that way.
> The key is read server-side in the Pages Function and is **never** included in
> the browser bundle.

---

## Deploy

Push-to-deploy via Cloudflare Pages, or deploy manually with Wrangler. Full
step-by-step (including how to set the OpenAI secret in production) is in
**[docs/DEPLOY.md](docs/DEPLOY.md)**.

For access control and protecting the OpenAI key (Cloudflare Access, rate
limiting), see **[docs/AUTH.md](docs/AUTH.md)**.

---

## Contributing

The team are repo collaborators. To make a change:

1. Branch off `main` (e.g. `git checkout -b feature/your-thing`).
2. Commit, push, and open a PR against `main`.
3. Pushing/opening a PR creates a Cloudflare preview URL you can share for review.

Keep `npm run typecheck` green before opening a PR.
