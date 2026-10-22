# Harbour

A personal deal tracker for Harieshwar in Hamilton, Ontario. Prices are in CAD.

A separate assistant checks whitelisted Canadian stores once a day and writes snapshots and deals into Supabase. Anyone can browse the watchlist, stores, deals, item history, and analytics. The owner signs in to edit them.

The browser talks to Supabase directly. There is no other server.

## Architecture

```text
Browser (Vite + React)
  │  supabase-js, publishable key
  │  anon read; owner session for writes
  ▼
Supabase project ieohjxtkoiphewcfttuw (ca-central-1)
  Auth   owner email + password, with a 6-digit email code as backup
  Postgres  stores, items, price_snapshots, deals
            public SELECT; writes only for the owner user
```

GitHub Pages hosts the static build at `/deal-tracker/`. React Router uses the history API. A copy of `index.html` is published as `404.html`, so a refresh on `/deal-tracker/items/…` still loads the app.

The publishable key is safe to ship in the client. It is not a service-role key. Anonymous visitors can read. Insert, update, and delete succeed only when `auth.uid()` is the owner account. Public sign-ups stay off.

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

Both views use `security_invoker`, so the row policies on `price_snapshots` still apply.

`supabase/migrations/20261022234500_public_read_owner_write.sql` is the repo record of the production migration `public_read_owner_write`. It is already applied. The file drops the old `owner full access` policies if they exist, then creates `public read`, `owner insert`, `owner update`, and `owner delete`, and grants `SELECT` to `anon` on the four tables and the two views. Re-running it is safe.

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

Owner sign-in is email and password (`signInWithPassword`). **Email me a code instead** calls `signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp` with the 6-digit code. A magic link in that same email still returns to the site root (`emailRedirectTo`). On return, the page calls `exchangeCodeForSession` once for `?code`. That link only completes in the browser that requested it, because the PKCE verifier lives in that browser’s local storage. The code works in any browser.

Public sign-ups stay off. A session whose user id is not `ce399408-8885-49fd-a960-ce4479603aaa` is signed out.

Paste this into Authentication → Emails → Templates → Magic link:

```html
<h2>Sign in to Harbour</h2>
<p>Your code is</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:600;">{{ .Token }}</p>
<p>Enter that code on the sign-in page. It works in any browser.</p>
<p>Or open this link in the same browser where you requested the email:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in to Harbour</a></p>
<p>The link and the code both expire soon. If you did not ask to sign in, you can ignore this email.</p>
```

### Manual settings

1. **Pages source.** Settings → Pages → GitHub Actions, as above. The site is already live.
2. **Owner password.** Set the password on the existing owner account in the Supabase dashboard (or the Auth admin API). The app does not create users.
3. **Keep public sign-ups off.** Authentication → Sign In / Providers → Email → “Allow new users to sign up” stays disabled. Enable the email provider so the password form works, and leave the 6-digit code available as the backup.
4. **Leave the SQL alone.** `20261022204401_init_deal_tracker.sql` and `20261022234500_public_read_owner_write.sql` are already applied. The public-read file is safe to re-run. Apply `20261022223000_analytics_views.sql` only if it is missing from `schema_migrations`.
5. Paste the Magic link template above if you still want the backup email to include both the code and the link. The built-in Supabase mailer allows about two emails an hour. The code button waits 60 seconds between sends and shows the server’s 429 message when the hourly cap is hit. Day-to-day sign-in uses the password and does not send mail.

## How the numbers work

Days are calculated in `America/Toronto`.

- **Current best price.** Latest CAD snapshot per store. In-stock prices win over out-of-stock ones. A null stock flag still counts.
- **Under target.** `target_price − current best`, summed only when the price is lower.
- **Vs regular.** On that same current offer, `regular_price − price` when regular is higher.
- **Price index.** Each item starts at 100 on its first priced day in the selected range. Missing days carry the last price forward. The chart averages those indexes.
- **Cheapest store.** One win per item per day, for the lowest CAD price. Equal prices go to the store whose name comes first alphabetically.
- **All-time low.** Lowest CAD price on record for the category and store filters. The date range does not move it. “At the low” means the current best price is that low.

Non-CAD snapshots are counted and then left out of the totals.
