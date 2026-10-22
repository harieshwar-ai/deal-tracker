# Harbour

A personal deal tracker for Harieshwar in Hamilton, Ontario. Prices are in CAD.

A separate assistant checks whitelisted Canadian stores once a day and writes snapshots and deals into Supabase. This app is the place to browse and edit that data: the watchlist, the store list, the deal feed, an item’s price history, and the analytics.

The browser talks to Supabase directly. There is no other server.

## Architecture

```text
Browser (Vite + React)
  │  supabase-js, signed-in session
  ▼
Supabase project ieohjxtkoiphewcfttuw (ca-central-1)
  Auth   email magic link, PKCE
  Postgres  stores, items, price_snapshots, deals
            RLS on, full access for role authenticated
```

GitHub Pages hosts the static build at `/deal-tracker/`. React Router uses the history API. A copy of `index.html` is published as `404.html`, so a refresh on `/deal-tracker/items/…` still loads the app.

The publishable key is safe to ship in the client. It is not a service-role key. Row level security still requires a signed-in user, and every signed-in user can read and write the whole dataset, so public sign-ups need to stay off.

Analytics run in the browser from the rows you already have. Two SQL views are included for the price checker and for ad-hoc queries. The app does not depend on them.

## Schema

Already applied (`supabase/migrations/20261022204401_init_deal_tracker.sql`). Do not run that file again.

| Table | What it holds |
| --- | --- |
| `stores` | Whitelisted shops. Seeded: Costco (Executive), Amazon (Prime), Walmart, Canada Computers, Best Buy, Staples, Visions Electronics. `enabled` tells the checker whether to visit the store. Deleting a store sets `store_id` to null on snapshots and deals. |
| `items` | The watchlist. Priority is `low`, `normal`, or `high`. Deleting an item cascades to its snapshots and deals. |
| `price_snapshots` | One observed price. `price` is required. `currency` defaults to `CAD`. |
| `deals` | A scored offer. Verdict is `must_buy`, `good`, `ok`, or `skip`. Status is `open`, `bought`, `dismissed`, or `expired`. |

`items` and `stores` update `updated_at` through `touch_updated_at()`.

Apply `supabase/migrations/20261022223000_analytics_views.sql` when you can. It adds:

- indexes for item/store/time scans and open deals
- `latest_store_prices` — newest snapshot per item and store
- `item_all_time_lows` — lowest CAD price per item

Both views use `security_invoker`, so the existing RLS policies still apply.

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

In a dev build, the sign-in screen has **Browse with sample data**. That mode stays in the browser and never writes to Supabase. It is omitted from the production bundle’s UI.

## Deploy

Workflow: `.github/workflows/pages.yml`. It runs on pushes to `main` and on manual dispatch. The build uses Vite `base: '/deal-tracker/'`.

Expected site:

https://harieshwar-ai.github.io/deal-tracker/

Pull requests run tests, lint, typecheck, and a production build (`.github/workflows/ci.yml`).

This repository is private. GitHub Pages for a private repository needs GitHub Pro (or making the repository public). The published site is reachable by URL either way. The price data stays behind Supabase auth.

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

The app sends the magic link back to the site root (`emailRedirectTo`). Sign-in uses PKCE, so open the email link in the same browser that requested it.

### Manual settings

1. **Pages source.** Settings → Pages → GitHub Actions, as above.
2. **Create the account, then turn sign-ups off.** Authentication → Users → Add user with your email. Then disable public sign-ups (Authentication → Sign In / Providers → Email → “Allow new users to sign up”). `disable_signup` is currently `false`. Leave it on only long enough to create the one account. Any other authenticated user would have full access, because the RLS policies grant `authenticated` every row.
3. **Apply** `supabase/migrations/20261022223000_analytics_views.sql`. Leave `20261022204401_init_deal_tracker.sql` alone; it is already in `schema_migrations`.
4. Confirm the email provider is enabled. The built-in Supabase mailer has a low hourly cap. Custom SMTP is optional.

## How the numbers work

Days are calculated in `America/Toronto`.

- **Current best price.** Latest CAD snapshot per store. In-stock prices win over out-of-stock ones. A null stock flag still counts.
- **Under target.** `target_price − current best`, summed only when the price is lower.
- **Vs regular.** On that same current offer, `regular_price − price` when regular is higher.
- **Price index.** Each item starts at 100 on its first priced day in the selected range. Missing days carry the last price forward. The chart averages those indexes.
- **Cheapest store.** One win per item per day, for the lowest CAD price. Equal prices go to the store whose name comes first alphabetically.
- **All-time low.** Lowest CAD price on record for the category and store filters. The date range does not move it. “At the low” means the current best price is that low.

Non-CAD snapshots are counted and then left out of the totals.
