# admin

## Staff sign-in and users

Sign in at `/login` with a developer or manager account. On a fresh local API
database, migration `0020` seeds `sam` with the initial password `changeit`.
Use **Users** to change the initial password before exposing the API publicly.
Set `PUBLIC_API_URL` to the API origin and configure its independent `JWT_SECRET`
and `JWT_REFRESH_SECRET` values as described in the API README.

Sign-in opens `/calendar`. The browser stores the token pair under the `auth`
localStorage key. Protected API requests validate the access token and can
refresh it within the original seven-day window. The Users section calls
`GET /v1/auth/me` for the current user's ID and role. **Logout** clears the pair in the current browser and returns
to `/login`. A ban prevents new sign-ins immediately. Issued sessions remain
valid through their existing deadlines after password changes, bans or logout.

Open **Users** to list accounts, create managers or edit an account. Developers
can edit both roles. Managers can edit managers and ban or unban other managers.
The API handles developer account provisioning through the database.

See [workspace guidance](../../README.md#frontend-apps) for routes, shared UI, configuration and commands.

Run `pnpm --filter admin dev`, `pnpm --filter admin build`, or `pnpm --filter admin types` from the workspace root.

## Installing BUK BUK

The admin manifest identifies the app as **BUK BUK** (short name **BUK BUK**),
with description **Booking App**. It launches `/calendar` in standalone mode,
with stable ID `/`, scope `/`, English language, yellow `#FFF000` theme and
black `#000000` launch background. Page titles and navigation labels are retained.
Production hosting must use HTTPS. For local development, use
`http://localhost:5174` with `pnpm --filter admin dev`; plain HTTP on a LAN IP
does not provide the same secure-context development exception.

In a supporting desktop or Android browser, open the admin origin and choose
the browser's Install app action (in the address bar or browser menu when
available). On iPhone/iPad, open the admin site in Safari, use Share → Add to
Home Screen, enable Open as Web App if offered, then Add. Open the installed
icon and confirm it launches `/calendar` without the normal browser toolbar.
Availability and menu wording depend on the browser and OS. There is no custom
install banner, offline support or notification permission request in this phase.

The manifest loads the 192px and 512px branding PNGs directly from the CDN:
[icon-192.png](https://cdn.astra-cloud-solutions.com/bukbuk/icon-192.png) and
[icon-512.png](https://cdn.astra-cloud-solutions.com/bukbuk/icon-512.png).
No local Apple touch or maskable icon is supplied; the two CDN icons are
declared as `any`. Modern iOS/iPadOS can use the manifest icons.

Verification on 13 Nov 2026: admin check passed with zero errors/warnings and
production build passed. Local Chrome DevTools parsed the manifest without
errors, resolved the expected identity, standalone display and `/calendar`
start URL, and reported no installability errors. At initial implementation, the manifest and all four icons
returned 200 with `application/manifest+json` and `image/png` respectively;
PNG dimensions and the initial maskable branding bounds were checked.
The optional maskable and Apple touch icons were subsequently removed at the
developer’s request. There were zero
registered service workers. Actual installation and standalone launch remain
manual checks: this headless Chrome has no `PWA.install`/`PWA.launch` DevTools
commands, and no iOS device was available. No worker prerequisite was reported
by this Chrome; phase 0003 below adds the worker lifecycle.

Before deploying [phase 0003](../../.prds/0003-admin-service-worker-lifecycle.md),
verify the admin and customer production app identities and confirm distinct
HTTPS origins with separate deployments. Different paths on one origin are
insufficient. Production checks are pending as described below.

Booking details link to `/bookings/edit/:booking_id`. The editor opens one blank
selection with today's Malaysia date and the first available category, room,
time and one-hour duration selected automatically. It does not fetch or prefill the existing
booking/reservations. Choose a category, physical room, time and duration;
Racing allows multiple machines sharing the selected interval, while other
categories select one room. Category selection defaults to the first configured
room with a free interval and that room's earliest time. Duration defaults to one
hour unless the current duration is supported.

Availability uses Malaysia day overlap queries, excludes the edited booking and
blocks confirmed/live pending reservations. Starts use 15-minute increments and
whole-hour durations within business hours and the next seven Malaysia dates.
Confirm rechecks availability and PUTs only the new selection as the complete
replacement list, then opens refreshed admin details. Racing machines each become
a separate reservation row. Existing reservations are replaced, not appended.
No original-value exception applies to the new selection.

Failures retain page-memory edits, including a missing booking detected at save.
Cancel leaves without writing. No status or payment changes occur. The API's
existing conflict bypass leaves concurrent edits outside these client checks'
guarantees. Confirm remains disabled until the new selection is complete and valid.

## Admin service worker — 0003

The admin build bundles `src/service-worker.ts` using [SvelteKit's worker support](https://svelte.dev/docs/kit/service-workers).
Automatic registration is disabled. The root layout registers `/service-worker.js`
once on mount, with scope `/` and `updateViaCache: 'none'`, only in production,
in a secure context with browser support. The registration is scoped to the
admin origin. Registration failures warn in the console and leave browsing available.

The worker logs installation with the build version, making worker bytes change
between builds. It has no fetch interception, Cache Storage, offline fallback,
replay, push, forced activation, client claiming, update prompts or reloads.
Ordinary HTTP caching follows browser/server rules. Initial activation does not
force control of an already-open page; later navigation can become controlled.
Updates wait until all controlled tabs/windows, including installed app windows,
close. Reopening uses the updated worker. Keep unsaved drafts open until ready
to leave.

### Local production-preview verification

Use separate origins, with localhost consistently:

```sh
pnpm --filter web build
pnpm --filter web preview
pnpm --filter admin build
pnpm --filter admin preview
```

Customer preview uses 4173. Set `PUBLIC_API_URL` to a local API with migration
`0020` applied and sign in before checking protected routes. A mock used for
these checks also needs to serve the auth endpoints.
In a fresh browser profile, `http://localhost:4174/calendar` must show exactly
one root registration, script `/service-worker.js` returning 200 JavaScript,
and customer preview must show none. `pnpm --filter admin dev` on 5174 must
create none; remove any earlier worker there first or use a fresh profile.

Leave an unsaved reservation/contact form open in a controlled tab, rebuild,
then run `await (await navigator.serviceWorker.getRegistration('/')).update()`.
Check the replacement is waiting with the draft and page unchanged. Close all
controlled tabs and installed windows, reopen and verify the new worker is
active. Do not enable DevTools Update on reload or force skipWaiting. Check
mocked booking/payment requests reach the network, Cache Storage stays unchanged,
offline reads/writes fail, and reconnecting does not replay failed writes.
Simulate unsupported browsers and rejected registration and check normal
navigation remains available (with a console warning on rejection).

### Targeted unregister and rollback

Run on the admin origin only:

```js
const scope = new URL('/', location.origin).href;
const script = new URL('/service-worker.js', location.origin).href;
for (const registration of await navigator.serviceWorker.getRegistrations()) {
	const workers = [registration.installing, registration.waiting, registration.active].filter(
		Boolean
	);
	if (
		registration.scope === scope &&
		workers.length &&
		workers.every((worker) => worker.scriptURL === script)
	) {
		await registration.unregister();
	}
}
```

Close controlled tabs and installed windows afterward. Reopening the current
app registers again unless registration is disabled. Preserve unrelated
registrations and caches; do not clear all site data. For rollback, disable the
manual registration block and keep automatic registration disabled, while
retaining a valid inert worker at `/service-worker.js` for previously registered
clients. Removing the worker URL alone is not a rollback.

### Verification and pending rollout

Local Chrome verification on 13 Nov 2026: one admin root registration, correct
JavaScript MIME and updateViaCache, initial page not claimed, customer preview
and admin development with zero registrations. Offline reads/writes failed and
Cache Storage remained unchanged, including an unrelated sentinel cache. Two
production builds verified a waiting replacement with an unsaved contact form
and page-memory marker intact, then activation after the controlled page left
the origin and reopened. Installed-window closure remains a manual device check.
Admin type checking reported zero errors/warnings, Wrangler types were current,
and production builds passed using installed tools directly (the pnpm wrapper
encountered a read-only engine-store lock).
Mocked booking/payment POSTs reached the browser network layer; offline failed
writes produced zero replay requests after reconnecting. Simulated registration
rejection logged the expected warning while navigation remained available.
Simulated missing service-worker support and an insecure context also retained
normal navigation without registration.
Changed admin source/document formatting and whitespace checks passed.

Intended production origins:
`https://bukbuk-admin.astra-cloud-solutions.workers.dev` and
`https://bukbuk-customer.astra-cloud-solutions.workers.dev`. Both returned
Cloudflare 404s during planning. Before rollout, verify each serves its intended
app on a distinct HTTPS origin and verify registration isolation there.
Production readiness and the installation/device checks from 0002 remain
pending. No deployment or live booking/payment writes were performed.

## Notifications — 0005

Open **Notifications** in admin navigation (`/settings/notifications`). Configure
`PUBLIC_VAPID_PUBLIC_KEY` manually with the API's matching `VAPID_PUBLIC_KEY`,
and configure the existing `PUBLIC_API_URL`. These are public settings; never put
`VAPID_PRIVATE_KEY` in frontend configuration. The key must be a base64url-encoded
uncompressed P-256 public key. No key discovery endpoint is used. API CORS must
allow the admin origin. Use production preview on an isolated admin origin; the
development app intentionally does not register a worker.

The page validates configuration and waits at most 10 seconds for an active
registration, then 3 seconds for the push-handler readiness reply. If an older
worker is active or an update is waiting, save drafts, close **all** admin tabs
and installed app windows, reopen, then Retry. There is no forced activation,
client claiming, automatic reload or offline behavior. The worker now handles
push and notification clicks; the earlier 0003 description of no push behavior
is superseded.

Page load never asks permission or creates a subscription. It re-registers an
existing matching subscription for the signed-in account. Enable requests permission
from that button action and subscribes with the configured key. Enabled means
the API returned a successful response containing an ID; it does not prove
push delivery or that frontend/backend VAPID keys were configured identically.
Retry reuses an existing subscription after a save failure. Use **Re-subscribe**
when the key changes or the existing subscription comes from another account or
the earlier public demo.

If permission is blocked, allow notifications for this site in browser settings,
then Retry. On iPhone/iPad, use Share → Add to Home Screen, open the installed
icon, then Enable. Supported iOS/iPadOS 16.4+ Home Screen web apps require direct
user interaction for permission ([WebKit guidance](https://webkit.org/blog/13878/)).
Manage installed-app permission in system Notifications settings. A dismissed
prompt leaves notifications off and can be retried explicitly.

**Turn off on this device** removes the signed-in account's D1 row for the
browser's subscription endpoint, then unsubscribes the browser and verifies
removal. Browser permission and already displayed notifications are retained.
Banning a user removes every saved device for that account.

The worker displays the supplied plain-text `title` and `body` from
`{"title":"BUK BUK","body":"This is a test notification.","url":"/calendar"}`.
The original versioned test payload remains supported. Payloads over 2048
UTF-8 bytes, empty/malformed or unsupported payloads use `/calendar`. Accepted
destinations are `/calendar`, `/bookings`, `/payments`, and
`/bookings/<booking UUID>`. The worker validates the destination again on click.
Clicks close the notification and navigate/focus a same-origin admin window or
open one. No subscription values are logged or written to application storage.
Booking confirmation pushes go to registered devices of active developers and
managers and open the booking details.

Focused regression checks (Node 22.23+):

```sh
node --experimental-strip-types apps/admin/tests/notifications.test.ts
```

Real installed Android/iPhone/iPad/desktop permission and delivery checks remain
manual. Mocked subscriptions and synthetic push events do not prove delivery.

Verification on 13 Nov 2026: five focused Node tests, zero admin type-check
errors/warnings, current Wrangler types, production build and changed-file
formatting/whitespace checks passed. Headless Chrome on production preview
verified mocked Enable/save failure/Retry reuse, dismissed/denied permission,
key replacement, unsubscribe failure/success, no subscription on returning to off
settings, old worker recovery, missing capability and iPhone installation
guidance. At 390px/1440px, no horizontal overflow; keyboard focus and live status
semantics checked. The real worker answered readiness and synthetic PushEvents
in its production runtime displayed fixed content and valid/fallback paths.
Actual screen-reader announcements, installed-device permission/installation and
real provider delivery remain unverified. No deployment or provider send.

## Developer test notifications

Enable notifications while signed in as a developer to register this device.
Trigger a broadcast through the API with `POST /v1/web-push-subscriptions/test` and the
`developer_secret` header set to the API's `DEVELOPER_SECRET` value. The push provider's acceptance count is
reported in the API response. Check the device for the displayed notification.

After key rotation, select Re-subscribe with current key. On rollback, preserve
`/service-worker.js` and follow the existing save-drafts/close-all-windows update
recovery. No forced worker replacement, automatic sends or queue.
Android, iPhone/iPad Home Screen and installed desktop delivery/display/calendar
click checks remain pending, as do production deployment and provider sends.
Synthetic browser/API/worker checks do not establish real delivery.
