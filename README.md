# Setup

from root, run `pnpm i`

## Local API migrations

```sh
pnpm --filter api exec wrangler d1 migrations apply DB --local
```

## Production deployment

Each app defines an `env.production` block in its `wrangler.jsonc`. The customer, admin and API
Workers serve their respective custom domains under `astra-cloud-solutions.com`.

Create the production D1 database named `bukbuk` and replace
`REPLACE_WITH_BUKBUK_D1_DATABASE_ID` in the API production config with its ID.
Review the pending migrations and verify the ST3 records and payment policy
before opening bookings.

```sh
pnpm --filter api exec wrangler d1 migrations list DB --remote --env production
pnpm --filter api exec wrangler d1 migrations apply DB --remote --env production
```

Use Wrangler secrets on the production Workers. Set `JWT_SECRET` and
`JWT_REFRESH_SECRET` to independent values on the API Worker. For push, set
`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` on the API and the matching
`PUBLIC_VAPID_PUBLIC_KEY` on admin. The admin public key is exposed to browsers.
Set `DEVELOPER_SECRET` on the API if using developer test broadcasts.

```sh
pnpm --filter api exec wrangler secret put JWT_SECRET --env production
pnpm --filter api exec wrangler secret put JWT_REFRESH_SECRET --env production
```

Build the frontends before deploying. Rebuild after source changes.

```sh
pnpm --filter api exec wrangler deploy --minify --env production
pnpm --filter web build
pnpm --filter web exec wrangler deploy --env production
pnpm --filter admin build
pnpm --filter admin exec wrangler deploy --env production
```

## Frontend apps

`apps/web` (`web`, port 5173) serves customer `/bookings/new`,
`/bookings/new/contact-info`, `/bookings/[booking_id]`, `/payments/[paymentId]`
and `/payment/demo/[orderId]`. `/` redirects to `/bookings/new`. Existing GM,
player, device, info and auth features remain here.

`apps/admin` (`admin`, port 5174) serves `/calendar`, the daily `/bookings` list, `/payments`, `/bookings/new`,
`/bookings/new/contact-info` and `/bookings/[booking_id]`; `/`
redirects to `/calendar`. Old `/customer/*` and `/admin/*` routes are removed.
Both apps share Svelte source components, fonts and theme in `@booking/ui`.

```sh
pnpm dev                                  # API and both frontends
pnpm exec turbo dev --filter=web --filter=admin # both frontends
pnpm --filter web dev                      # customer only
pnpm --filter admin dev                    # admin only
pnpm build                                # both frontend builds
pnpm types                                # API and frontend checks
```

Development ports are strict; previews use 4173 (web) and 4174 (admin).
Both apps consume `PUBLIC_API_URL` (development default http://localhost:8787)
and `PUBLIC_BOOKING_BUSINESS_ID` (default ST3 Wonderland). Payment-row booking links and New Reservation stay
on the admin origin. Admin selection uses
`admin.booking-draft`; the contact form starts empty with MY (+60) and keeps
contact values only in page state. Submit (including Enter) currently does nothing:
no customer/booking writes, payments or navigation.
Turbo includes consumed PUBLIC_* variables in task hashes. No deployment or
migration is part of the app split.
