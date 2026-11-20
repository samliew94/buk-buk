# Setup and deployment

Run these commands from the repository root in Bash. You’ll need Node.js,
pnpm, and access to the Cloudflare account that owns the Workers, D1 database,
and custom domains.

```bash
pnpm install
pnpm --filter api exec wrangler login
pnpm --filter api exec wrangler whoami
```

## Apply database migrations

For local development, apply migrations to the local D1 database.

```bash
pnpm --filter api exec wrangler d1 migrations apply DB --local
```

Production uses the `DB` binding for `bukbuk` in
[the API Wrangler config](apps/api/wrangler.jsonc). For a new Cloudflare account,
create the database with `pnpm --filter api exec wrangler d1 create bukbuk` and
set the production `database_id` in that config to the returned ID.

Review pending production migrations, apply them, and check the list again.

```bash
pnpm --filter api exec wrangler d1 migrations list bukbuk --env production --remote
pnpm --filter api exec wrangler d1 migrations apply bukbuk --env production --remote
pnpm --filter api exec wrangler d1 migrations list bukbuk --env production --remote
```

## Set or reset the developer password

Migration `0020` seeds the developer account `sam` with the initial password
`changeit` if the account is missing. Set a new password before making production
sign-in available.

Paste this block into Bash. It prompts for the new password without echoing it,
generates the same salted scrypt format as
[the API](apps/api/src/auth/password.ts), and updates `sam` in production D1.

```bash
(
  set -euo pipefail
  IFS= read -r -s -p 'New password for sam: ' new_password
  printf '\n'
  if [[ -z "$new_password" ]]; then
    printf 'Enter a non-empty password.\n' >&2
    exit 1
  fi

  password_hash=$(printf '%s' "$new_password" | node -e '
    const { readFileSync } = require("node:fs")
    const { randomBytes, scryptSync } = require("node:crypto")
    const salt = randomBytes(16)
    const key = scryptSync(readFileSync(0), salt, 32, { N: 16384, r: 8, p: 5 })
    console.log(["scrypt", "v1", salt.toString("hex"), key.toString("hex")].join("$"))
  ')
  unset new_password

  pnpm --filter api exec wrangler d1 execute bukbuk \
    --env production --remote \
    --command "UPDATE \"user\" SET password_hash = '$password_hash' WHERE username = 'sam' RETURNING id, username;"
)
```

Confirm the command returns one row for `sam`. After deployment, sign in with
the new password in a private browser window. Existing sessions keep their
original expiry.

## Configure secrets

Before deploying application code, set all five production API secrets.
`JWT_SECRET` and `JWT_REFRESH_SECRET` support sign-in.
`VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` support web push.
`DEVELOPER_SECRET` authenticates developer test broadcasts. Also set the
matching VAPID public key in the admin production config.

For local API development, copy [the example](apps/api/.dev.vars.example) to
`apps/api/.dev.vars` and replace the placeholder values for the features you use.
Set the production API secrets before deploying the application code. Generate
two independent JWT values by running `openssl rand -hex 32` twice, then paste
each value into its corresponding Wrangler prompt. If the first `secret put`
asks to create the missing `bukbuk-api` Worker, answer **Yes** and continue.
Keep existing JWT values on routine redeploys.

```bash
pnpm --filter api exec wrangler secret put JWT_SECRET --env production
pnpm --filter api exec wrangler secret put JWT_REFRESH_SECRET --env production
```

### Generate VAPID keys for web push on Linux Mint

Use the Node.js installation from the setup steps. Run this once to generate
a P-256 key pair in the base64url format the API expects.

```bash
node <<'NODE'
const { generateKeyPairSync } = require('node:crypto')
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const { x, y, d } = privateKey.export({ format: 'jwk' })
const publicKey = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(x, 'base64url'),
  Buffer.from(y, 'base64url'),
])
console.log('VAPID_PUBLIC_KEY=' + publicKey.toString('base64url'))
console.log('VAPID_PRIVATE_KEY=' + d)
NODE
```

Save the pair in your password manager and reuse it across deployments. Paste
only the value after `=` into each Wrangler prompt. Keep the private key out of
Git and frontend configuration.

```bash
pnpm --filter api exec wrangler secret put VAPID_PUBLIC_KEY --env production
pnpm --filter api exec wrangler secret put VAPID_PRIVATE_KEY --env production
```

Set the matching public key as `PUBLIC_VAPID_PUBLIC_KEY` in the admin
`env.production.vars` block in [its Wrangler config](apps/admin/wrangler.jsonc).
If you rotate an existing pair, deploy admin with the updated public key and
use **Re-subscribe** in admin **Notifications** on each subscribed device.

### Configure developer test broadcasts

Generate a separate random value with `openssl rand -hex 32` and paste it at
the Wrangler prompt. The API reads the uppercase `DEVELOPER_SECRET` binding
and expects the value in the `developer_secret` request header.

```bash
pnpm --filter api exec wrangler secret put DEVELOPER_SECRET --env production
```

Before deploying, verify all five names appear on the production API Worker.

```bash
pnpm --filter api exec wrangler secret list --env production
```

## Deploy all three apps

Complete [secret and key configuration](#configure-secrets) first.
Then run these commands from the repository root. Deploy the API first.
Once it succeeds, deploy admin and customer in either order.

### Deploy the API first

After [configuring secrets](#configure-secrets), deploy the API application code.
Use the same command for routine API updates.

```bash
pnpm --filter api exec wrangler deploy --minify --env production
```

### Build and deploy admin

The admin production Wrangler config already sets `PUBLIC_API_URL` to the
production API.

```bash
pnpm --filter admin build &&
  pnpm --filter admin exec wrangler deploy --env production
```

### Build and deploy the customer app

The customer production Wrangler config also sets `PUBLIC_API_URL` to the
production API.

```bash
pnpm --filter web build &&
  pnpm --filter web exec wrangler deploy --env production
```

For frontend updates, rerun the build and deploy commands for the app you changed.

### Verify production

| App | Cloudflare Worker | Production URL |
| --- | --- | --- |
| API | `bukbuk-api` | https://bukbuk-api.astra-cloud-solutions.com |
| Admin | `bukbuk-admin` | https://bukbuk-hello88.astra-cloud-solutions.com |
| Customer | `bukbuk-customer` | https://bukbuk-web.astra-cloud-solutions.com |

Open `/login` on the admin origin, sign in as `sam`, and verify **Calendar** and
**Users** load. On the customer origin, verify ST3 availability and the intended
payment policy before opening bookings.

#### Test web push notifications

Sign in as a developer and enable push under **Notifications** on the device
you want to test. Replace `YOUR_DEVELOPER_SECRET` with your production secret
and run this request.

```bash
curl -X POST \
  -H 'developer_secret: YOUR_DEVELOPER_SECRET' \
  https://bukbuk-api.astra-cloud-solutions.com/v1/web-push-subscriptions/test
```

The endpoint sends to all registered devices belonging to active developers.
Check the response counts (`matched`, `accepted`, and `failed`) and confirm the
notification appears on your device.
