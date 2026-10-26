# Harbour

A personal deal tracker for Harieshwar in Hamilton, Ontario. Prices are in CAD.

A separate assistant checks whitelisted Canadian stores once a day and writes snapshots and deals into Supabase. Anyone can browse the watchlist, stores, deals, item history, and analytics. The owner signs in to edit them.

The browser talks to Supabase directly. Deal-alert mail is a Supabase Edge Function the owner deploys; the static site does not send email.

## Architecture

```text
Browser (Vite + React)
  │  supabase-js, publishable key
  │  anon read; owner session for writes
  ▼
Supabase project ieohjxtkoiphewcfttuw (ca-central-1)
  Auth   owner email + password
  Postgres  stores, items, price_snapshots, deals
            public SELECT; writes only for the owner user
```

GitHub Pages hosts the static build at `/deal-tracker/`. React Router uses the history API. The build also copies `index.html` to `confirm/index.html` and `unsubscribe/index.html` so those alert links return HTTP 200. A copy of `index.html` is published as `404.html`, so a refresh on other deep links such as `/deal-tracker/items/…` still loads the app.

The publishable key is safe to ship in the client. It is not a service-role key. Anonymous visitors can read. Insert, update, and delete succeed only when `auth.uid()` is the owner account. Public sign-ups stay off.

Analytics run in the browser from the rows you already have. Two SQL views are included for the price checker and for ad-hoc queries. The app does not depend on them.

## Schema

Already applied (`supabase/migrations/20261022204401_init_deal_tracker.sql`). Do not run that file again.

| Table | What it holds |
| --- | --- |
| `stores` | Whitelisted shops. Seeded: Costco (Executive), Amazon (Prime), Walmart, Canada Computers, Best Buy, Staples, Visions Electronics. `enabled` tells the checker whether to visit the store. Deleting a store sets `store_id` to null on snapshots and deals. |
| `items` | The watchlist. Priority is `low`, `normal`, or `high`. `public_summary` is the only description visitors see. Deleting an item cascades to its snapshots and deals. |
| `price_snapshots` | One observed price. `price` is required. `currency` defaults to `CAD`. |
| `deals` | A scored offer. Verdict is `must_buy`, `good`, `ok`, or `skip`. Status is `open`, `bought`, `dismissed`, or `expired`. |

`items` and `stores` update `updated_at` through `touch_updated_at()`.

Apply `supabase/migrations/20261022223000_analytics_views.sql` when you can. It adds:

- indexes for item/store/time scans and open deals
- `latest_store_prices` — newest snapshot per item and store
- `item_all_time_lows` — lowest CAD price per item

Both views use `security_invoker`, so the row policies on `price_snapshots` still apply.

`supabase/migrations/20261022234500_public_read_owner_write.sql` is the repo record of the production migration `public_read_owner_write`. It is already applied. The file drops the old `owner full access` policies if they exist, then creates `public read`, `owner insert`, `owner update`, and `owner delete`, and grants `SELECT` to `anon` on the four tables and the two views. Re-running it is safe.

`supabase/migrations/20261022235500_public_column_privileges.sql` is the repo record of production migration `public_column_privileges`. It is already applied. The file adds `items.public_summary` if it is missing and replaces the anon table-level `SELECT` on `items`, `stores`, and `deals` with column lists. Visitors cannot read item descriptions, notes, targets, or max prices; store membership or notes; or deal reasons. Re-running it is safe. Signed-out visitors select only those columns.

## Countries

Harbour can show prices for whitelisted stores by country. Canada is enabled by default; other regions appear as “Coming soon” until their stores are approved. Visitors pick a country in the header (`?country=GB` is synced to the URL and `localStorage`). Prices stay in each store’s local currency; the UI formats them with `Intl.NumberFormat` and shows country-specific tax copy.

Apply these migrations in order after the deal-alert migration (and after `20261026120000_market_rollups.sql` when that view exists):

1. `supabase/migrations/20261027000000_multi_country.sql` — `countries`, `country_code` on `stores`, `country_code` on `alert_subscriptions`, `country_waitlist`, updated `subscribe_to_alerts`, waitlist RPCs.
2. `supabase/migrations/20261027000100_market_rollups_country.sql` — `market_latest` / `market_daily` expose `country_code` and match qualifying lows to each store’s currency.

Only enabled countries are readable from `countries`. Waitlist emails are never granted to `anon`. The owner sees waitlist counts (and confirmed emails) through `list_country_waitlist_counts`.

Redeploy `supabase/functions/deal-alerts` after merge so `waitlist_confirm` and per-country deal matching are live.

## Deal alerts

Visitors can ask for an email when Harbour records a public price for a product or a category. The address is confirmed before any alert is sent. Confirm and unsubscribe links open `/deal-tracker/confirm` and `/deal-tracker/unsubscribe`.

`supabase/migrations/20261025120000_alert_subscriptions.sql` is not applied by the app. Review it and apply it yourself. `supabase/seed/alert_subscriptions.sql` is a separate owner opt-in for the categories `prebuilt-pc`, `gpu`, `ram`, and `ssd`. Tokens are generated when that seed runs. Do not commit API keys.

`alert_subscriptions` stores the address, exactly one of `item_id` or `category`, the status (`pending`, `confirmed`, or `unsubscribed`), and the confirm and unsubscribe tokens. `alert_notifications` records each confirmation and deal send. A successful deal send is unique per subscription, item, store, and price, so the same offer is not mailed twice. A failed send can be retried.

Row level security is on for both tables. There is no insert, update, or delete policy. Anonymous clients have no select grant, so addresses and tokens are not readable with the publishable key. The owner reads the list through `list_alert_subscribers`, which returns the address, target, and status and never the token columns. `alert_notifications` has no client grant. Visitors subscribe, confirm, and unsubscribe only through `subscribe_to_alerts`, `confirm_alert`, and `unsubscribe_alert`. Those functions are `security definer`, validate the input, and never return an address or a token. A category is accepted only when an active item already uses that exact stored value (`Chairs`, `Prebuilt PCs`, `Graphics cards`, `Memory (RAM)`, `SSDs`, and any other active category). `group:pc-hardware` is the All PC hardware group. It is accepted when an active item is in one of those four PC categories, and a confirmed group subscription is mailed when any of them has a deal. New requests are limited to 5 pending subscriptions per address per hour and 10 new subscriptions per product or category per hour.

The edge function `supabase/functions/deal-alerts` sends the confirmation and, when called with a deal by the owner or the project secret key, the alert. This repo does not deploy it. `supabase/config.toml` sets `verify_jwt = false` for that function because a visitor confirms without a user session. The function still rejects deal calls that are not the owner or the secret key.

### Triggering a deal alert (scan pipeline)

After the checker records a deal, call the deployed function from server-side code (not the browser). Authenticate with the Supabase **secret** key (`sb_secret_…` from Project Settings → API). Set that value as the function secret `SUPABASE_SERVICE_ROLE_KEY` when you deploy. The legacy `service_role` JWT is not accepted for deal sends.

```http
POST https://<project-ref>.supabase.co/functions/v1/deal-alerts
Authorization: Bearer <sb_secret_…>
Content-Type: application/json

{
  "action": "deal",
  "item_id": "<uuid>",
  "store_id": "<uuid>",
  "price": 1299.9
}
```

`store_id` may be omitted or null when the alert is not tied to one store. `price` must match the CAD price you want subscribers to see (the function canonicalizes it to two decimal places).

The function loads confirmed subscribers for the item, for the item’s category, and for `group:pc-hardware` when the item is in a PC hardware category. It skips anyone who already has a **sent** row in `alert_notifications` for the same subscription, item, store, and price, so the same offer is not emailed twice. Failed sends are not deduped and may be retried. The JSON response includes `sent`, `failed`, and `skipped` counts.

Visitor confirm requests use `action: "confirm"` with `subscription_id` and `email` (no secret key).

Resend is the mail provider. Set these as function secrets, for example with `supabase secrets set`. They are not committed:

| Secret | Value |
| --- | --- |
| `RESEND_API_KEY` | Resend API key |
| `ALERTS_FROM` | `Harbour Deal Alerts <noreply@harieshwar.dev>` |

Reply-To is `noreply@harieshwar.dev`. The root domain has no MX record, so replies bounce. Every confirmation and alert sets `Auto-Submitted: auto-generated`, `X-Auto-Response-Suppress: All`, `List-Unsubscribe` to the public unsubscribe URL, and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. The plain text and HTML both end with: “This is an automated message from a no-reply address. Replies are not received.”

Sends use `POST https://api.resend.com/emails/batch` in chunks of at most 100, waiting 200ms between requests so the function stays under Resend’s default of 10 requests per second. A 429 waits for `retry-after` and retries. Each alert has an idempotency key `deal:{subscription}:{item}:{store}:{price}`. A one-message request uses that key as Resend’s `Idempotency-Key`. A larger chunk uses `batch:` plus the SHA-256 of those keys, so retrying the same chunk does not send twice. The same key is stored on `alert_notifications`.

If `RESEND_API_KEY` is unset and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` are all set, the function uses SMTP instead. If neither Resend nor SMTP is configured, it logs and does not send.

`ALERTS_PUBLIC_URL` is optional and defaults to `https://harieshwar-ai.github.io/deal-tracker`. It is only used to build confirm, unsubscribe, and item links.

An alert contains the product name, the public price, the store name, the public summary, a store link (deal URL, latest snapshot product URL, item product URL, or store home, in that order), the Harbour item page, and unsubscribe. It does not include targets, budgets, notes, membership, or deal reasons.

`20261026120000_market_rollups.sql` adds `market_latest` and `market_daily`. When those views exist, the first page load reads the latest offer per listing and one qualifying price per store per day instead of every snapshot. Apply that file by hand. Until then Harbour still loads `price_snapshots` directly, using only the public columns.

The signed-in owner can open Subscribers for counts by product and category and a list with status. Visitors who open that route see a sign-in message and no addresses. The public catalog select does not include subscriptions.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173/deal-tracker/

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | Unit tests for pricing, filters, and analytics |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Serve `dist` |

Optional overrides live in `.env` (see `.env.example`). The hosted URL and publishable key are the defaults in `src/lib/config.ts`, so a Pages build does not need secrets.

In a dev build, the sign-in screen has **Browse with sample data**. That mode stays in the browser and never writes to Supabase. It is omitted from the production bundle’s UI. Adding `owner=1` to that preview URL shows the edit controls locally. Production ignores both flags.

## Deploy

Workflow: `.github/workflows/pages.yml`. It runs on pushes to `main` and on manual dispatch. The build uses Vite `base: '/deal-tracker/'`.

Expected site:

https://harieshwar-ai.github.io/deal-tracker/

Pull requests run tests, lint, typecheck, and a production build (`.github/workflows/ci.yml`).

The published site is public. Price rows are readable with the publishable key. Editing requires the owner session.

After the workflow exists:

1. GitHub → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Merge to `main`, or run the **Deploy GitHub Pages** workflow by hand.
3. The first run creates the `github-pages` environment.

## Supabase Auth

Authentication → URL configuration:

| Setting | Value |
| --- | --- |
| Site URL | `https://harieshwar-ai.github.io/deal-tracker/` |
| Redirect URLs | `https://harieshwar-ai.github.io/deal-tracker/` |
| Redirect URLs | `http://localhost:5173/deal-tracker/` |

Owner sign-in is email and password (`signInWithPassword`). The page does not send a one-time code or a magic link.

Public sign-ups stay off. A session whose user id is not `ce399408-8885-49fd-a960-ce4479603aaa` is signed out.

### Manual settings

1. **Pages source.** Settings → Pages → GitHub Actions, as above. The site is already live.
2. **Owner password.** Set the password on the existing owner account in the Supabase dashboard (or the Auth admin API). The app does not create users.
3. **Keep public sign-ups off.** Authentication → Sign In / Providers → Email → “Allow new users to sign up” stays disabled. Enable the email provider so the password form works.
4. **Column privileges.** `public_column_privileges` is already applied. The matching file is `supabase/migrations/20261022235500_public_column_privileges.sql`, and re-running it is safe. Leave `20261022204401_init_deal_tracker.sql` and `20261022234500_public_read_owner_write.sql` alone. Apply `20261022223000_analytics_views.sql` only if it is missing from `schema_migrations`.

## How the numbers work

Days are calculated in `America/Toronto`.

- **Current best price.** Latest CAD snapshot per store. In-stock prices win over out-of-stock ones. A null stock flag still counts.
- **Under target.** `target_price − current best`, summed only when the price is lower.
- **Vs regular.** On that same current offer, `regular_price − price` when regular is higher.
- **Price index.** Each item starts at 100 on its first priced day in the selected range. Missing days carry the last price forward. The chart averages those indexes.
- **Cheapest store.** One win per item per day, for the lowest CAD price. Equal prices go to the store whose name comes first alphabetically.
- **All-time low.** Lowest CAD price on record for the category and store filters. The date range does not move it. “At the low” means the current best price is that low.

Non-CAD snapshots are counted and then left out of the totals.
