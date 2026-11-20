# 0005 — Admin notification controls and worker handlers

**Status:** Closed

The developer confirmed local booking notification delivery on 20 Nov 2026. See the implementation notes in [the diary](../.docs/DIARY.md) for the final sender and registration behavior.

## Description

Implemented admin `/settings/notifications` and a shared navigation link, connected
to public `POST /register-web-push`, plus worker push display and click handlers.
Implementation is complete for the agreed reduced scope; real-device and delivery
verification remains pending.

## Problem Description

Browser permission alone does not establish that a browser subscription is saved.
The admin has no session UI; the agreed reduced scope uses the existing public
registration endpoint without login, subscription ownership or D1 removal.

## Implementation Plan

- Use shared theme, TopNav and Button with accessible status feedback and guarded
  actions. Distinguish checking, unsupported, Home Screen installation required,
  off, enabling, enabled, blocked, key mismatch and retryable failure.
- Manually configure `PUBLIC_VAPID_PUBLIC_KEY` to match the API public key, using
  existing `PUBLIC_API_URL`. Validate configuration and bound worker readiness
  waits before enabling. Request permission only from an explicit Enable action.
- Subscribe with `userVisibleOnly: true`. POST exactly endpoint and p256dh/auth
  keys; require success with an ID. On load/Retry, re-register an existing matching
  subscription without prompting or automatically creating one.
- Explicitly replace mismatched application server keys. Browser unsubscribe is
  verified; permission, displayed notifications and saved D1 records remain.
- Preserve admin-only worker registration, network-only operation and browser
  activation. Readiness protocol version 1 detects old active workers; save drafts,
  close all admin tabs/installed windows and reopen for waiting updates. No forced
  activation, claiming or reload.
- Initial payload: `{"version":1,"type":"test","url":"/calendar"}`. Fixed generic
  BUK BUK test content; empty, malformed, over-2048-byte or unsupported payloads
  fall back to calendar. Clicks close the notification and navigate/focus an
  existing same-origin window or open one. Only literal `/calendar`, `/bookings`
  and `/payments` are allowed, without origins, credentials, queries or fragments.
- No subscription logging/application storage, API contract/schema change,
  deployment, migration, test sender or automatic operational notifications.

## What Success Outcome Looks Like

Page load never prompts. Enable saves one matching subscription, persistence
failure is retryable using that subscription, and revisiting after turning off
never creates another subscription. Accurate local unsubscribe outcomes and safe
notification destinations are covered by focused automated/mocked checks.
See admin README for configuration, recovery and verification evidence.

### Verification status — 13 Nov 2026

- Source reviewed: shared navigation link, settings page and server configuration,
  subscription persistence/readiness helpers, payload validation and worker handlers
  implement the reduced scope above.
- Local settings are already present: `apps/admin/.env` contains
  `PUBLIC_API_URL=http://localhost:8787` and `PUBLIC_VAPID_PUBLIC_KEY`;
  `apps/api/.dev.vars` contains `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
  Rechecked without exposing values: frontend/backend public keys match and the
  private key derives the configured P-256 public key. No key generation or
  replacement is needed. `VAPID_SUBJECT` is not required for registration.
- `PUBLIC_CUSTOMER_URL` is absent from the admin `.env`; supply a distinct origin
  for production preview, e.g. `--var PUBLIC_CUSTOMER_URL:http://localhost:4173`.
  Development intentionally does not register a worker. Runtime loading of the
  local settings by preview still needs verification.
- Reran `node --experimental-strip-types apps/admin/tests/notifications.test.ts`:
  all five tests pass. They cover approved/fallback destinations, key matching,
  bounded readiness, persistence request shape and required response ID, retry,
  and actual worker handlers with existing/new/failed window navigation.
- Direct Svelte sync/check rerun: zero errors and warnings. Direct Vite production
  build also passes, bypassing the Wrangler types prerequisite. The standard build
  currently fails its `wrangler types --check` prerequisite because
  `worker-configuration.d.ts` is out of date. The pnpm check wrapper also hit a
  read-only engine-store lock. Earlier successful checks recorded in the README
  do not establish that the current standard build passes; regenerate Wrangler
  types and rerun the standard check/build before rollout.
- Earlier implementation verification, recorded in the admin README and diary:
  production-preview Chrome checks covered Enable, persistence failure/Retry,
  permission dismissal/denial, explicit key replacement, unsubscribe failure/success,
  no automatic re-subscribe after turning off, worker recovery, unsupported browsers,
  iPhone installation guidance, responsive layout and keyboard/live-status semantics.
  Actual worker readiness and synthetic push display were also checked. These
  browser checks were not rerun during this documentation verification.

### Remaining manual verification

- Confirm current preview receives the configured environment, the API is running,
  migration 0018 is applied locally, and CORS permits the admin preview origin.
  Verify Enable persists to the real local API/D1, Retry reuses the subscription,
  and Turn off removes only the browser subscription.
- Verify real installed desktop/Android/iPhone/iPad permission and installation,
  notification display/click behavior and screen-reader announcements.
- Verify separate production admin/customer HTTPS origins and worker isolation
  before rollout. No deployment, remote migration, live API write or provider send
  was performed during this verification.
- Real provider delivery requires 0006's sender. Synthetic push events and mocked
  subscriptions do not prove end-to-end delivery.

## Dependencies

[0004](0004-admin-vapid-subscription-backend.md) provides public registration.
Sending belongs to [0006](0006-admin-web-push-delivery-and-rollout.md).

## Assumptions

Supported iPhone/iPad web push requires Home Screen installation and direct user
interaction, per [WebKit](https://webkit.org/blog/13878/). Real device installation,
permission behavior and push delivery remain manual rollout checks. Mocked push
checks do not establish real delivery. Authentication, business authorization and
ownership-scoped removal are deferred prerequisites for 0006 delivery controls.
