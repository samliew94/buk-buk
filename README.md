# Setup

from root, run `pnpm i`

# API

## Migration

### localhost
from root, run `pnpm --filter api migrate --local`

### production
from root, run `pnpm --filter api migrate --remote -c wrangler.production.jsonc`

## Deploy production API
```bash
cd apps/api && pnpm deploy -- -c wrangler.production.jsonc
```

## Update cors.json
```bash
pnpm exec wrangler r2 bucket cors set astra-cloud-solution
s \
    --file cors.json \
    --config wrangler.production.jsonc
```

# WEB
```bash
cd apps/web && pnpm wrangler types && pnpm build && pnpm wrangler deploy --secrets-file .env.production --name xunbao-web
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
and `PUBLIC_BOOKING_BUSINESS_ID` (default ST3 Wonderland). Admin additionally
requires `PUBLIC_CUSTOMER_URL` in production: an HTTP(S) origin without a path,
for example https://booking.example.com. Development defaults to
http://localhost:5173. Payment-row booking links navigate to that customer origin
in the same tab. New Reservation stays on the admin origin. Admin selection uses
`admin.booking-draft`; the contact form starts empty with MY (+60) and keeps
contact values only in page state. Submit (including Enter) currently does nothing:
no customer/booking writes, payments or navigation.
Turbo includes consumed PUBLIC_* variables in task hashes. No deployment or
migration is part of the app split.
