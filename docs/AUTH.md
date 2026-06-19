# Auth & access control

This is a hackathon demo, so the priorities are: **keep the public demo
reachable for judges**, and **protect the OpenAI key from abuse**. Full
per-user auth is overkill for now — but here's how to add it when needed.

Options below are ordered by recommended-for-this-project.

---

## 1. Cloudflare Access — zero-code team gate (recommended)

[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/)
puts a login wall in front of a domain or path with no code changes.

**Setup**

1. Open **Cloudflare Zero Trust** → **Access** → **Applications** →
   **Add an application** → **Self-hosted**.
2. Set the application domain to the Pages site
   (`aldi-recipe-cart-bot.pages.dev`). You can scope it to a **path** instead of
   the whole site — e.g. cover only `/api/*` or an `/admin` path.
3. Add a **policy**: **Allow** → match on **Emails** (list your teammates) or
   **Login methods** (e.g. Google / One-Time PIN).
4. Save. Visitors hit a Cloudflare login before reaching the protected
   resource.

**Tradeoff for a demo:** if you gate the whole site, **judges have to be
allow-listed**, which adds friction. Better pattern: **keep the demo public**
and gate only a sensitive path — e.g. protect `/api/chat` (so only your team's
sessions can spend OpenAI tokens) or an internal `/admin` page, while the
public UI stays open. Note: gating `/api/chat` while leaving the UI public will
break the demo for anyone not logged in, so for judging you'd usually leave
`/api/chat` open and rely on rate limiting (below) instead.

---

## 2. Rate-limit the public `/api/chat` (protect the OpenAI key)

If the demo stays public, the real risk is someone hammering `/api/chat` and
burning your OpenAI budget. The function already **caps the tool-calling loop**
(a bounded number of iterations per request), so a single request can't spiral —
but you still want a per-caller ceiling.

Two complementary approaches:

- **Cloudflare WAF rate-limiting rules (no code).** In the dashboard under
  **Security → WAF → Rate limiting rules**, add a rule like *"requests to
  `/api/chat` from one IP > N per minute → block / challenge"*. Fastest to set
  up and runs at the edge.

- **A Pages middleware limiter (in code).** Add a
  `functions/_middleware.ts` that runs before `functions/api/chat.ts` and
  enforces a per-IP budget — keyed on `CF-Connecting-IP`, counting in
  [Workers KV](https://developers.cloudflare.com/kv/) (durable across the edge)
  or a simple in-memory counter (best-effort, per-isolate). Return `429` when
  the budget is exceeded.

For a hackathon, the WAF rule plus the built-in loop cap is usually enough.

---

## 3. Real per-user auth (post-hackathon)

When the app needs accounts rather than a team gate:

- **Cloudflare Access JWT** — keep Access in front, and have the function read
  and verify the `Cf-Access-Jwt-Assertion` header to get the authenticated
  identity (no separate auth stack).
- **A dedicated auth provider** — [Clerk](https://clerk.com),
  [Auth0](https://auth0.com), or [Supabase Auth](https://supabase.com/auth) for
  sign-up, sessions, and per-user data. Verify the session/JWT inside
  `functions/api/chat.ts` before proxying to OpenAI.

Defer this until there's a reason to know *who* a user is (saved baskets,
per-user limits, etc.).
