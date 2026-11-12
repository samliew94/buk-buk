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
