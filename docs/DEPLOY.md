# Deploy

The app is a static Vite build (served by Cloudflare Pages) plus a Pages
Function at `functions/api/chat.ts`. Cloudflare auto-detects the `functions/`
directory and deploys it alongside the static assets — no extra config needed.

Two ways to ship: **manual** (Wrangler from your machine) or **auto-deploy**
(connect the GitHub repo — recommended).

Live project: **https://aldi-recipe-cart-bot.pages.dev**
Cloudflare project name: **`aldi-recipe-cart-bot`**

---

## 1. Manual deploy (current)

Build the static site and push it with Wrangler:

```bash
npm run build
npx wrangler pages deploy dist --project-name aldi-recipe-cart-bot
```

(`npm run deploy` does both steps in one go.)

### Set the OpenAI key as a production secret

The chat function reads `OPENAI_API_KEY` from the Pages project. Set it once as
an encrypted secret:

```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name aldi-recipe-cart-bot
# paste your key when prompted

# optional — override the default model (gpt-4o):
npx wrangler pages secret put OPENAI_MODEL --project-name aldi-recipe-cart-bot
```

Secrets are encrypted at rest and injected into the function at runtime; they
are never part of the browser bundle. If you skip this, the live site still
works in **demo mode** (scripted flow over the real ALDI API, no LLM).

---

## 2. Auto-deploy from GitHub (recommended)

Connect the repo once and every push to `main` ships to production; every PR
gets its own preview URL.

### Connect the repo

1. In the Cloudflare dashboard go to **Workers & Pages**.
2. Open the **`aldi-recipe-cart-bot`** project → **Settings** →
   **Builds & deployments** → **Connect to Git** (for a brand-new project,
   choose **Create application → Pages → Connect to Git**).
3. Authorize Cloudflare for GitHub and select **`w1ne/aldi-recipe-cart-bot`**.

### Build settings

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None / Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |

The `functions/` directory is auto-detected and deployed as Pages Functions —
you don't configure it separately.

### Environment variables / secrets

In the project's **Settings → Environment variables** (or **Variables and
Secrets**), add for the **Production** environment:

| Name | Type | Value |
| --- | --- | --- |
| `OPENAI_API_KEY` | Secret (encrypted) | your OpenAI key |
| `OPENAI_MODEL` | Plaintext (optional) | e.g. `gpt-4o` |

Add the same to the **Preview** environment if you want preview deployments to
use full conversational AI (otherwise previews fall back to demo mode).

### How deployments map

- **Push to `main`** → production build → https://aldi-recipe-cart-bot.pages.dev
- **Open / update a PR** → preview build → a unique `*.pages.dev` preview URL
  Cloudflare comments on the PR.

---

## Verifying a deploy

After a deploy completes:

- Load the live URL and run the flow (name a dish → pick a recipe → route).
- If responses look scripted and end with *"demo mode"*, the function isn't
  seeing `OPENAI_API_KEY` — re-check the secret in the Production environment.
- Check **Workers & Pages → the project → Functions** logs for any runtime
  errors from `/api/chat`.
