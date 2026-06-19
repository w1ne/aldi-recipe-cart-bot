# Gamification Plan (June 2026)

Synthesis of three research sweeps — loyalty/mechanics, promo-codes/prizes/compliance, and
serverless implementation. Goal: grow basket size & repeat visits **with honest value** (no dark
patterns) — aligned to the contest's "maximise ALDI profit **while keeping the customer happy**."

## Guiding principle

A discount only adds margin when it pulls **incremental** spend. Break-even lift = `1 ÷ (1 − discount/margin) − 1` — brutal on grocery margins (a 20% coupon on a 35%-margin SKU needs ~+133% units just to hold profit). So: favor **targeting + thresholds + own-brand mix** over blanket discounts, and **personalize the offer, never the base price** (the Instacart price-testing tool was killed Dec 2025 + FTC probe — that's the third rail).

## Recommended build shortlist (ranked by evidence × on-brand fit)

**Hardest finding:** only **progress-bars + spend thresholds** and the **recipe-to-cart "add all" action** have *causal* proof of lifting **basket size** (goal-gradient: 34% vs 19% completion, Nunes & Drèze; thresholds +15–25% AOV; recipe-to-cart +20–30% basket, ~3× conversion). Everything else lifts **frequency/retention**. And ALDI markets *"no points, no cards, no faff"* — so we do **not** copy Lidl's points/coupon-activation faff; we build a recipe-utility layer that earns engagement by helping people **shop smarter**, not jump through hoops.

| # | Mechanic | Why it fits ALDI | Lifts | Risk | Build |
|---|---|---|---|---|---|
| 1 | **Basket-completion progress bar + threshold** ("4 of 9 ingredients" / "€6 from free delivery") | Only mechanic with hard causal AOV proof; recipe basket is the natural unit | **AOV** | None | Low |
| 2 | **"Complete the meal" recipe nudge → own-brand picks** | Recipe-to-cart is the biggest measured basket lever; nudge missing staples + a paired side, defaulting to ALDI private-label (margin ~25–30pts higher) | **AOV + margin** | None | Low |
| 3 | **Recipe streaks + cuisine / "cook-the-rainbow" badges** | Best-proven *frequency* mechanic; perfect for a recipe assistant | **Frequency** | None* | Low–Med |
| 4 | **"You saved €X cooking vs takeaway" savings score** | On-brand value/trust differentiator, largely unbuilt in chat form | Retention/trust | None | Low |
| 5 | **Seasonal quests** (Tesco-style: "cook 3 in-season meals this month") | The one mechanic proven to lift **both** frequency *and* basket at a grocer (+16% freq); pushes fresher/cheaper seasonal categories | **Both** | Low | Med |

\* Streaks must use **no-guilt** framing + generous grace periods — never "you're about to lose your streak" loss-anxiety (DSA Art. 25 / the upcoming EU Digital Fairness Act target exactly that).

**Optional (you asked for promo codes/prizes) — do them the safe way:**
- **Recipe-tied threshold coupon** ("add €5 to hit €30 → €5 off") — naturally incremental, margin-controllable. Honest, low risk. ✅
- **Spin-to-win / scratchcard** — only as a *guaranteed-discount reveal* (everyone "wins" a coupon → a promotion, not a regulated prize draw). **But** all three sweeps flag it as gambling-adjacent, off-brand for ALDI, and under active EU/UK regulatory scrutiny — so **lower priority**, and clearly labelled "demo, not a real promotion."

**Avoid:** real random-prize sweepstakes/instant-win (odds disclosure, official rules, US/UK free-entry/AMOE, GDPR consent, age-gating, NY/FL bonding); fake countdown timers / "only 2 left" (illegal under UK DMCC Act); streak-loss guilt & points-expiry framing; drip pricing; and **never** personalized base pricing (the Instacart third rail).

## Compliance cheat-sheet (practical, not legal advice)

- **Lottery = Prize + Chance + Consideration (paid entry).** Remove one. **Sweepstakes** (no paid entry) and **skill contests** (no chance) are legal.
- **Germany (ALDI's home): purchase-to-enter IS legal** — the Kopplungsverbot (§4 UWG) was repealed in 2015. The live duty is **transparency** (§§5/5a UWG): clearly a promo, accessible T&Cs, disclosed odds/eligibility/end-date. Don't cross into licensed Glücksspiel (paid stake).
- **US: "No Purchase Necessary" + free alt-entry mandatory** for chance prizes; **UK: free entry route mandatory** (unlicensed lottery is criminal).
- **EU UCPD Annex I #31:** never imply "you've won" if claiming costs money.
- **GDPR:** data minimization; separate, optional marketing opt-in; let people enter without consenting to marketing.
- **Our easy path:** "everyone wins a coupon" reveal = a promotion, not a prize draw → none of the above prize machinery applies. Add a "demo — not a real promotion" disclaimer.

## Architecture (anonymous-first, serverless — fits our Cloudflare stack)

- **Identity:** mint a random UUID server-side on first visit, return as an **HMAC-signed cookie** (Worker secret); mirror in localStorage for instant UI. The UUID is the user's key.
- **State (server-authoritative):**
  - **Durable Object per user** = authoritative ledger (points balance, streak, idempotency log, redemption guard, rate-limit). Single-threaded → atomic, no races.
  - **D1** = promo-code table + leaderboard/reporting (atomic `UPDATE codes SET redeemed=1 WHERE code=? AND redeemed=0` → check rows_affected for single-use).
  - **KV** = read-mostly config (reward catalog, earn multipliers). Never for counters.
  - **localStorage** = UI cache only, never the ledger (tamperable + evictable).
- **Anti-cheat:** client sends *events* + an idempotency key, **never** "+50 points"; server computes the award from a server-side rules table. HMAC-sign events + timestamp (reject >5min) + event-id dedupe.
- **Spin-to-win:** **server picks the winning segment by weight and returns the index**; client only *animates* to it (CrazyTim `spin-wheel` or a Framer-Motion DIY wheel). Optional commit-reveal (`SHA-256(serverSeed)`) for a "provably fair" judge talking point.
- **LLM narrates, server decides:** a Vercel AI SDK `grantReward` tool whose `execute()` runs server-side and accepts only identifiers (userId, basketId) — never a points amount from the model (OWASP LLM01 / prompt-injection). Render a `<RewardCard>` from the tool's server output; the model just says "Nice — 3-day streak!".
- **Upgrade path:** keep the anon UUID as the stable key; on signup, *attach* an auth identity to it so all progress survives. Decide merge policy up front.

## Build-vs-buy

**Build thin.** Cloudflare DO/D1/KV already give the strongly-consistent primitives a points/prize engine needs, and a custom build avoids every vendor's `user.id` friction. Buy only if you want zero backend tonight — best SaaS option is **Trophy** (trophy.so, 100 MAU free, <1h integration). Open Loyalty (OSS) is a scale-later hedge, not a one-night build.

## "Minimum lovable gamification" for the hackathon

1. Anonymous HMAC-signed identity cookie (0.5d)
2. `PointsEngine` Durable Object: `POST /award {event, idempotencyKey}` → atomic, returns balance; **bonus points for own-brand/higher-margin picks** (1d)
3. Streak logic in the DO (server dates only)
4. Reward surfaced in chat via `grantReward` tool + `<RewardCard>` (0.5d)
5. Promo codes in D1 + atomic single-use redeem + Turnstile/rate-limit (0.5d)
6. Server-authoritative spin-to-win → guaranteed next-shop coupon (1d)

**Defer:** real accounts (path designed, unbuilt), leaderboard, badge polish.

## Sources (selected)
- McKinsey grocery / personalization — mckinsey.com/industries/retail · Private label — grocerydive.com/news/private-label-record-sales-volume-2025
- Lidl Plus — latestdeals.co.uk/guides/shopping/lidl-plus · thegrocer.co.uk (points overhaul) · Giant Food double-points — grocerydive.com/news/giant-food-rewards-loyalty-private-label
- Germany Kopplungsverbot repeal — hk2.eu · abmahnung.org/gewinnspiel-uwg · UK free entry — asa.org.uk · EU UCPD — eur-lex.europa.eu
- Instacart price-testing shutdown / FTC — cbsnews.com · consumerreports.org · ftc.gov (surveillance pricing)
- Cloudflare DO/D1/KV — developers.cloudflare.com/workers/platform/storage-options · Rate-limit binding — developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit
- spin-wheel — github.com/CrazyTim/spin-wheel · OWASP LLM01 — cheatsheetseries.owasp.org · Trophy — trophy.so/developers
- Academic (gamification is conditional/non-monotonic) — sciencedirect.com/science/article/abs/pii/S0969698926001141

### Confidence notes
Vendor lift/engagement figures are directional (self-reported). Gamification ROI is contested — it can backfire; favor personalized progress over leaderboards. The Germany purchase-to-enter legality is the most counterintuitive, high-value finding (verified across multiple German legal sources). "Instacart individualized pricing" framing is contested (price *testing* confirmed; per-person targeting denied by Instacart).
