# Booking API

A minimal Cloudflare Worker using Hono, constructor injection, and JWT authentication with role authorization.

From the repository root, run `pnpm install`. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and set independent random values of at least 32 characters for `JWT_SECRET` and `JWT_REFRESH_SECRET`. Start the API with `pnpm --filter api dev`. Configure each secret in the deployment environment with `pnpm --filter api exec wrangler secret put JWT_SECRET` and `pnpm --filter api exec wrangler secret put JWT_REFRESH_SECRET`.

Apply D1 migration `0020` after the existing migrations. It seeds the developer `sam` with the initial password `changeit` and preserves an existing `sam` account. Change that initial password through Users or the authenticated users endpoint before public exposure. Provision additional developer accounts directly in D1 using the versioned scrypt format in `src/auth/password.ts`.

## HTTP contract

All request and response JSON object keys use snake_case, including records within arrays. Database columns retain their SQL names.

| Method | Path | Access | Response |
| --- | --- | --- | --- |
| GET | `/v1/payments/:paymentId` | Public | 200 with `{ "id", "booking_id", "price" }`, or `null` if missing. Gateway-independent internal payment lookup. |
| QUERY | `/v1/bookings` | Staff bearer JWT, JSON `{ "business_id": "...", "date": "2026-11-12" }` | 200 with `{ "rooms": [], "bookings": [] }`; Malaysia calendar day overlaps, excluding expired pending holds |
| GET | `/v1/bookings/:bookingId` | Public | 200 with `{ "id", "customer_id", "status", "created_at", "expire_at", "reservations" }`, or `null` if missing |
| GET | `/v1/demo-payment-orders/:orderId` | Public | 200 with `{ "id", "reference_id", "price", "status", "created_at" }`, or `null` if missing |
| GET | `/` | Public | `{ "name": "booking-api", "status": "ok" }` |
| PUT | `/v1/demo-payment-orders/:orderId` | Public, JSON `{ "status": "paid" }` | 200 with `{ "id", "reference_id", "booking_id", "price", "status" }`; also accepts `cancelled`/`rejected`. Unknown order is 404; invalid body/status is 400. The demo page displays the outcome with a visible “Redirecting in 3...” countdown and redirects after three seconds to `/customer/payments/{reference_id}` after either successful button submission. |
| POST | `/webhook/payment/demo` | Public, JSON `{ "order_id": "...", "reference_id": "...", "status": "paid" }` | 204 with no body; invalid payloads return 400. Demo statuses: `paid`, `cancelled`, `rejected`. Success inserts a new paid payment row, retains the original pending row, then confirms its booking; unknown payment IDs return 404. Cancelled/rejected outcomes insert a new payment row with the reported status, retain the pending row, then cancel the booking. |
| GET | `/v1/businesses/:id` | Public | `{ "id", "name", "open_at", "close_at" }`, or 404 if missing |
| PUT | `/v1/businesses/:id` | Staff bearer JWT, JSON `{ "name": "..." }` | Updated `{ "id": "...", "name": "..." }`; invalid input is 400, missing business is 404 |
| POST | `/v1/businesses` | Staff bearer JWT, JSON `{ "name": "..." }` | 201 with `{ "id": "...", "name": "..." }`; invalid input is 400 |
| POST | `/v1/customers` | Public, JSON `{ "name": "...", "phone": "..." }` | 201 with `{ "id": "...", "name": "...", "phone": "..." }`; invalid input is 400 |
| PUT | `/v1/customers/:id` | Staff bearer JWT, JSON `{ "name": "...", "phone": "..." }` | 200 with `{ "id": "...", "name": "...", "phone": "..." }`; invalid input is 400, missing customer is 404 |
| GET | `/v1/customers/:id` | Staff bearer JWT | 200 with one `{ "id": "...", "name": "...", "phone": "...", "created_at": "..." }` record, or `null` if missing |
| QUERY | `/v1/room-categories` | Public, JSON `{ "business_id": "..." }` | Ordered categories with room_ids |
| POST | `/v1/room-categories` | Staff bearer JWT, category JSON below | 201 with created category |
| PUT | `/v1/room-categories/:id` | Staff bearer JWT, category JSON below | 200 with updated category |
| QUERY | `/v1/rooms` | Public, JSON `{ "business_id": "..." }` | Array of physical rooms ordered by sort order, name, then ID; missing business is 404 |
| POST | `/v1/rooms` | Staff bearer JWT, room JSON below | 201 with the created room; invalid input is 400, missing category is 404 |
| PUT | `/v1/rooms/:roomId` | Staff bearer JWT, room JSON below | 204 with no body; invalid input is 400, missing category or room is 404 |
| QUERY | `/v1/room-category-rental-fees` | Public, JSON `{ "room_category_id": "..." }` | One fee for the category, or `null` if none matches |
| POST | `/v1/room-category-rental-fees` | Staff bearer JWT, fee JSON below | 201 with the created fee; invalid input is 400 |
| PUT | `/v1/room-category-rental-fees/:id` | Staff bearer JWT, fee JSON below | 200 with the updated fee; invalid input is 400, missing fee is 404 |
| POST | `/v1/bookings` | Public, booking JSON below | 201 with `{ "booking_id": "...", "payment_url": null }` (temporary upfront payment bypass); invalid input is 400 |
| QUERY | `/v1/reservations` | Public, JSON `{ "business_id": "...", "from": "...", "to": "..." }` or `{ "business_id": "...", "date": "2025-12-31T16:00:00Z" }` | 200 with an array of booking records; invalid input is 400 |
| QUERY | `/v1/payments` | Staff bearer JWT, JSON `{ "business_id": "...", "date": "2026-11-12" }` | Payment history for the Malaysia calendar day |
| PUT | `/v1/bookings/:bookingId` | Staff bearer JWT | 200 with updated reservation list in the booking response |
| POST | `/v1/auth/login` | Public, JSON `{ "username": "...", "password": "..." }` | Token pair |
| POST | `/v1/auth/refresh` | Public, JSON `{ "refresh_token": "..." }` | Replacement token pair |
| GET | `/v1/auth/me`, `/v1/auth/admin` | Staff bearer JWT | `{ "id": "...", "role": "developer" }` or role `manager` |
| QUERY | `/v1/users` | Staff bearer JWT, JSON `{}` | All users ordered by username, then ID |
| GET | `/v1/users/:id` | Staff bearer JWT | User or `null` |
| POST | `/v1/users` | Staff bearer JWT, JSON `{ "username": "...", "password": "..." }` | 201 with the new unbanned manager |
| PUT | `/v1/users/:id` | Staff bearer JWT, nonempty subset of `username`, `password`, and boolean `is_banned` | 200 with the updated user, or 404 for a missing user |
| POST | `/v1/web-push-subscriptions` | Staff bearer JWT, browser subscription JSON below | 200 with the caller's subscription ID |
| POST | `/v1/web-push-subscriptions/test` | `developer_secret` header | 200 with developer broadcast counts |
| DELETE | `/v1/web-push-subscriptions` | Staff bearer JWT, JSON `{"id":"..."}` | 204 with no body |

Auth and user responses set `Cache-Control: no-store`. A token pair contains `access_token`, `refresh_token`, `expires_at` and `refresh_expires_at` with UTC ISO expiry timestamps. Use the access token as `Authorization: Bearer <access_token>` on staff endpoints. A login starts a seven-day session with access tokens lasting up to 15 minutes. Refresh preserves the original role and deadline and caps access expiry at that deadline. Previously issued tokens remain valid until their respective expiries after password changes, bans or local logout. Bans block new sign-ins.

User responses contain `id`, `username`, `role` and boolean `is_banned`. Both roles can read users and create managers. Developers can edit either role. Managers can edit manager accounts and ban or unban other managers. Usernames are trimmed and lowercased. Password writes require 8–128 characters and preserve whitespace. Updates preserve omitted fields.

Errors use `{ "error": "..." }`. Malformed input returns 400, rejected credentials return 401, and prohibited role operations including a manager self-ban return 403. Duplicate usernames return 409.

Category writes require `{ "business_id": "business-1", "name": "Family", "sort_order": 0, "acronym": "FR" }`. Acronym is optional/null on create and nonblank on update. POST `/v1/room-categories` returns 201; PUT `/v1/room-categories/:id` returns 200 with the written fields and ID. QUERY with `{ "business_id": "..." }` returns categories with `id`, `business_id`, `name`, `acronym`, `sort_order`, `room_ids`, including empty categories. Categories and their nested room IDs sort by sort order, name, then ID.

Physical room writes require `{ "room_category_id": "category-1", "name": "FR1", "sort_order": 0 }`. POST `/v1/rooms` returns 201 with `id` and those fields; PUT `/v1/rooms/:roomId` retains 204. Missing categories or rooms return 404. QUERY `/v1/rooms` requires business_id, derives ownership through the category, and returns physical fields ordered by sort order/name/ID. Physical rooms have no business_id or acronym columns.

## Dependency injection

Booking creation stores the validated business_id on the booking. Booking creation accepts `{ "business_id": "business-1", "customer_id": "customer-1", "room_category_id": "category-1", "from": "2026-11-11T07:00:00.000Z", "duration": 90 }`. Duration remains any finite positive number of minutes. A missing or foreign category returns 404. Optional quantity must be an integer from 1–4 (omission defaults to 1); non-RACING categories accept only 1 or omission. The server resolves category ownership/acronym. RACING assigns distinct machines continuously free for the full interval, ordered by sort order/name/ID, even for quantity 1. Confirmed and unexpired pending bookings block overlaps; adjacent intervals, cancelled bookings and expired holds do not. Insufficient capacity returns 409 before writes. One booking has N reservation rows and one unchanged upfront payment flow. Other categories retain the temporary assignment bypass. The response still temporarily returns payment_url: null. Concurrency protection and atomicity remain deferred.

Both reservation query variants require business_id: `{ "business_id": "...", "from": "...", "to": "..." }` or `{ "business_id": "...", "date": "2026-11-10T16:00:00.000Z" }`. Responses include `id`, `room_id`, `room_category_id`, `customer_id`, `status`, `created_at`, `expire_at`, `from`, `to`. Business ownership follows assigned room → category. The stored requested category is returned. Range filtering retains `from >= lower AND to < upper`; date filtering returns all overlaps in the exact 24-hour window. Datetimes without offset use Asia/Kuala_Lumpur. Date requires UTC ISO with seconds and Z.

Apply migrations through `0013_room_categories.sql` locally with `pnpm --filter api exec wrangler d1 migrations apply DB --local`. Existing rooms initially become separate categories with deterministic IDs; grouping physical rooms under Family is a later configuration action. Fees and reservation history are preserved. See `.docs/SCHEMA.md` and `.docs/BOOKING_LIFECYCLE.md` for details.

`src/dependencies.ts` is the composition root. It supplies auth and user use cases through Hono context. Services receive dependencies through constructors; controllers read interfaces from context. `createApp(factory)` accepts an alternate factory for tests or future implementations. Mount `requireAccessToken` on each protected method.

Bookings without an upfront payment policy are immediately `confirmed`. Bookings requiring upfront payment remain `pending` until payment is confirmed.

Availability uses `existing.from < requested.to AND existing.to > requested.from`. Confirmed bookings and unexpired pending holds block; cancelled bookings and expired holds do not. Boundary meetings are permitted. MVP concurrency protection and atomicity remain deferred.

## Validation

Run `pnpm --filter api types` and `pnpm --filter api test`. Regenerate Worker runtime declarations after configuration changes with `pnpm --filter api cf-typegen`.

The treasure-hunt controllers, services, migrations, AI integrations, asset storage, KV exchange tokens and queues have been removed. The old frontend still calls retired endpoints and requires its own cleanup.

## Customers

Customer writes require nonblank string `name` and `phone` values. POST generates the customer ID and stores the current UTC time as `created_at`; client-supplied IDs and timestamps are ignored. PUT uses the path ID and preserves `created_at`. Write responses contain `id`, `name`, and `phone`. GET `/v1/customers/:id` returns one customer with `id`, `name`, `phone`, and `created_at`, or `null` if missing, always with status 200. Apply migrations through `0007_customer_created_at.sql` before creating customers.

## Category rental fees

QUERY `/v1/room-category-rental-fees` accepts `{ "room_category_id": "..." }` and returns the first fee by ID or null, including unknown categories. POST and PUT `/:id` require `{ "room_category_id": "...", "duration": 1, "price": 12.5 }` and return 201/200 with ID and those fields. Duration remains a nonnegative safe integer; price is finite and nonnegative. Missing fee updates return 404; category references rely on foreign keys. Multiple fees per category remain allowed. No quotation calculation is introduced. The former room-rental-fees routes are retired.

Booking creation stores a UTC ISO expiry timestamp in `booking.expire_at`, initially 10 minutes after creation. Both reservation query methods return this stored timestamp as `expire_at`. This deadline applies to pending bookings only; confirmed bookings remain reserved. Reservation queries include expired bookings; the booking day query excludes expired pending holds. Clients determine expiry using pending status and current time >= `expire_at`; no `isExpired` field is returned. Stored status remains unchanged. Availability checks ignore expired pending bookings; confirmed bookings continue to block rooms.

Demo webhook IDs are required nonblank strings: `order_id` is the gateway `demo_payment_order.id`, and `reference_id` is our internal `payment.id` (stored by the demo gateway as `reference_id`). The handler resolves the payment using `reference_id`; it does not query or update the gateway database using `order_id`.

To simulate a guest payment through the API, take the order ID from booking creation's `/payment/demo/{order_id}` URL and call `PUT /v1/demo-payment-orders/{order_id}` with `{"status":"paid"}`. The gateway updates its stored order and invokes the existing demo webhook handler in process with `{order_id, reference_id, status}`. A successful response means the payment was recorded and the booking confirmed. No outbound HTTP callback is sent. Cancelled/rejected outcomes cancel the booking. Atomicity, duplicate handling, and finalized-outcome enforcement remain deferred; if webhook processing fails, the gateway order may already have been updated. The demo payment page submits either outcome and displays the outcome with a visible “Redirecting in 3...” countdown and redirects after three seconds to `/customer/payments/{reference_id}` on API success (the developer-requested route value is the internal payment ID).

Booking lookup includes a `reservations` array (empty when there are none). Each entry contains `id`, `room_id`, `room_name`, `room_category_id`, `room_category_name`, `room_category_acronym`, `from`, `to`, and `duration` in minutes, calculated from the stored UTC timestamps without rounding. Entries are ordered by start time, room sort order, room name, then reservation ID. Room names reflect the current room record.

The gateway-independent `/customer/payments/{payment_id}` page fetches `GET /v1/payments/{payment_id}` in the browser, then redirects to `/customer/bookings/{booking_id}` using the returned booking ID. Failed or missing lookups display an error without redirecting.

`CreateBooking.exec` accepts a final `skipPayment` boolean (default `false`, after quantity, which defaults to 0 for non-Racing use-case calls; Racing requires an explicit integer from 1–4). When true, payment is unnecessary regardless of business policy: the booking confirms immediately, creates no payment or gateway order, and returns `payment_url: null`. Otherwise the configured upfront payment policy applies; a missing policy or a policy price of 0.00 requires no payment, including no gateway fee. The controller temporarily always passes `skipPayment = true` for all callers; future actor-role handling will derive this flag for admins rather than accepting it from the request body.

## Admin booking day grid

`QUERY /v1/bookings` accepts only `business_id` (nonblank string) and `date`
(strict valid `YYYY-MM-DD`, interpreted in Asia/Kuala_Lumpur). Invalid JSON,
non-object bodies, missing/invalid fields and range/unknown filters return 400.
The interval is Malaysia midnight to the next midnight, bound as UTC ISO strings:
reservation start < day end and reservation end > day start. Exact touching
boundaries are excluded. No parent existence lookup is required; an unknown
business returns empty arrays.

Daily reservations use stored booking.business_id; room reassignment does not
transfer booking history. The room roster still uses current room categories.

The response contains all physical `rooms` for the business, including unbooked
rooms, ordered by category sort_order, then room sort_order, with category name/ID and room name/ID as tie-breakers. Room fields are `id`, `room_category_id`,
`name`, `sort_order`, `room_category_name`, `room_category_acronym`. `bookings`
contains the existing single-booking lookup fields and only matching
`reservations`, with their existing room/category fields and duration in minutes.
Full intervals are retained. Ownership follows the current physical room category;
reservation category information describes the stored requested category.
Bookings/reservations are ordered by reservation start, room sort_order/name/id,
then reservation ID, with bookings in first-match order. Pending bookings are
returned only while `expire_at` is later than the current UTC time; expired pending
holds are excluded. Other stored statuses are returned unchanged.
Two direct SQL reads supply the result without per-booking queries or D1 metadata.
The existing GET booking lookup remains unchanged.

Read-only `/admin/bookings` uses the configured public API/business ID and one
query per selected date. The URL retains `?date=YYYY-MM-DD`; missing/invalid dates
default to today in Malaysia. The grid displays at least 24 hours, extending to
the whole hour after the latest matched reservation ends without querying the
extension. Blocks clip at selected-day midnight and stack overlaps in lanes.
Pending cards also disappear locally when their hold expires while the page is
open, without another API request. The collection query requires a staff access token.

The day query `QUERY /v1/bookings` includes `customer_name` and `customer_phone` on each booking, joined from its customer record, for the admin grid cards.

Temporary room conflict bypass: booking assignment ignores existing reservations for all categories, including RACING. Machines remain distinct within each booking and quantity cannot exceed the physical room count. Set `bypassRoomConflicts` to `false` in `QueryAvailableRooms.ts` to restore reservation overlap checks. Customer time-slot availability filtering remains active.

## Admin payment history

`QUERY /v1/payments` accepts only `{ "business_id": "...", "date": "2026-11-12" }`.
Both fields are required; malformed JSON, non-object bodies, unsupported fields,
blank business IDs and invalid/non-YYYY-MM-DD dates return 400. The collection query requires a staff access token. Returns an array of `{ id, booking_id, created_at, price, status,
customer_name, customer_phone }`, or `[]`. Every stored payment row/status is
retained, including pending history for completed or cancelled bookings.
Filter payment creation within the selected Malaysia day (inclusive midnight,
exclusive next midnight converted to UTC); order by created_at DESC, id DESC.
Business ownership uses stored booking.business_id, including bookings without
reservations. Room reassignment does not transfer payments; multiple reservations
do not duplicate payments.

`/admin/payments` initializes today in Malaysia time on mount and retains date
selection in component state. The horizontally scrolling table pins View actions
to its right edge; View opens the associated customer booking in the same tab.

## Replace booking reservations

Staff-authenticated `PUT /v1/bookings/:booking_id` replaces the complete reservation list:

```json
{"reservations":[{"room_id":"room-1","from":"2026-11-14T10:00:00+08:00","duration":90},{"room_id":"room-2","from":"2026-11-14T11:00:00+08:00","duration":60}]}
```

Returns 200 using the existing GET booking response, with new server-generated
reservation IDs. Every entry explicitly selects one physical room; no quantity
or automatic assignment applies. Rooms must belong to the stored booking business
through their current category, which is saved on each replacement reservation.
Missing bookings or missing/foreign rooms return 404.

Malformed JSON, unsupported fields (including nested fields), missing/empty lists,
invalid room IDs/datetimes, nonfinite/nonpositive durations, invalid calculated
ends and overlapping intervals for the same room in this list return 400.
Adjacent or separate intervals for the same room are allowed. Offset-free input
means Asia/Kuala_Lumpur; timestamps are stored as UTC ISO. Conflicts with other
bookings remain allowed under the MVP bypass.

All stored booking statuses are editable, including cancelled bookings and expired
pending holds. Booking ID, business, customer, status, creation time, expiry and
payment records are preserved. No payment or status transition flow runs. Complete
validation precedes writes; deletion and replacement execute in one transactional
D1 batch so a failed insert restores the original reservations. GET and daily
queries read the updated rows with their existing status/expiry filtering.

## Web push device registration and removal (0004)

`POST /v1/web-push-subscriptions` requires a staff access JWT and accepts exactly
`{"endpoint":"https://fcm.googleapis.com/subscription","keys":{"p256dh":"<base64url P-256 public key>","auth":"<base64url 16-byte secret>"}}`.
The API takes `user_id` from the JWT subject. New and repeated registrations
return 200 with only `{"id":"..."}`. Re-registering the same endpoint under
the same account preserves the subscription ID and creation time and updates
its encryption keys, VAPID identifier and UTC update time. Each browser push
subscription has its own server-generated ID, and a user can have several.
Registration returns 403 for an inactive account, including a banned account
with an unexpired token. It returns 409 when the endpoint is already stored
under another account or as a legacy unowned subscription. Replace that
browser subscription to enroll under the current account.
Unsupported fields, malformed/non-object JSON, bodies over 8 KiB, endpoints over
4096 characters, non-HTTPS or unsupported-provider URLs, non-default ports, credentials/fragments and invalid keys return
400 in the standard error envelope. Keys use canonical unpadded base64url.

Manually set `VAPID_PUBLIC_KEY` (65-byte uncompressed P-256 point),
`VAPID_PRIVATE_KEY` (32-byte scalar), both unpadded base64url, in ignored `.dev.vars` locally
and backend environment secrets for production. Temporary `REPLACE_ME` values
must be replaced before registration works. No credentials are generated by this
feature. Keep a stable pair per environment. Manually configure the same public
key in the client: a submitted subscription cannot prove which application-server
key was used. Rotation requires client re-subscription; re-register each endpoint
to refresh its stored SHA-256 public-key identifier. Do not rotate per request.
Missing/invalid configuration returns a sanitized 500 only on registration;
SQL/provider errors are discarded before logging to avoid subscription leakage.

`DELETE /v1/web-push-subscriptions` requires a staff access JWT and accepts
exactly `{"id":"<subscription UUID>"}`. Use the D1 row ID returned by
registration. The API hard-deletes the row matching both the ID and the JWT
subject. It returns 204 for deleted, missing and foreign subscriptions.

Migration 0021 adds nullable `user_id`. Existing demo rows remain unowned and
ineligible for test delivery. When a user is banned, a D1 trigger removes all
their subscriptions in the same statement. The JWT claims and session lifetime
are unchanged.

## Web push test delivery (0006)

The test sender uses the fixed payload `{"version":1,"type":"test","url":"/calendar"}`.
An atomic D1 update reserves one attempt per device every 60 seconds, including
failed transport attempts. Redirects are rejected. Provider responses of 404
or 410 hard-delete expired subscriptions. Other provider failures retain them.
Provider response bodies and subscription credentials stay private.

Registration and sending require HTTPS provider destinations with default port,
no credentials or fragments: exact `fcm.googleapis.com`, exact
`updates.push.services.mozilla.com`, or hosts beneath `.push.apple.com`.
Existing unsupported-provider rows stay stored but cannot receive tests.
The pinned `@block65/webcrypto-web-push` 2.0.0 encrypts payloads using RFC 8291 aes128gcm.
The API signs the RFC 8292 VAPID token without a contact claim. Provider TTL is 60 seconds; plaintext limit is
2048 bytes. Transport is injected for controlled tests.

Apply migrations in order through 0021:
`pnpm --filter api exec wrangler d1 migrations apply DB --local` for local D1.
Remote migration and deployment are separate rollout actions, not performed here.
Test sends are always enabled. Configure a stable matching
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` pair. Store private
keys as Wrangler secrets; never commit them. The admin `PUBLIC_VAPID_PUBLIC_KEY`
must match the API public key. Keep distinct HTTPS customer/admin origins and
`PUBLIC_API_URL` pointed at the API (localhost is supported for local testing).

### Developer broadcast

`POST /v1/web-push-subscriptions/test` sends the fixed test notification to
registered devices owned by active developers. Provide the Worker
`DEVELOPER_SECRET` value in the `developer_secret` header. Missing configuration or
invalid credentials return 401. The request takes no body. The shared sender
selects the device by `subscription_id` and encrypts `title`, `body`, and `url`
for the admin service worker.

```sh
curl -X POST http://localhost:8787/v1/web-push-subscriptions/test \
  -H "developer_secret: ${DEVELOPER_SECRET}"
```

The response is HTTP 200 with `matched`, `accepted`, and `failed` counts. The
`accepted` count comes from the push provider. Every request attempts delivery to
each matching device, and delivery attempts continue after a device failure.
Store the deployed value as a Wrangler secret named `DEVELOPER_SECRET`.

Key rotation needs explicit browser re-subscription. Keep
`/service-worker.js` at the same URL with the documented inert-worker lifecycle;
do not force activation or reload drafts. Previously displayed notifications
remain visible until dismissed.

Local-only Worker smoke: run `pnpm --filter api exec wrangler dev --config tests/wrangler.push-smoke.jsonc --port 8799` with its isolated config containing no bindings, then GET its root. The committed fixture generates ephemeral keys,
uses controlled transport, and never contacts providers. It validates the actual
installed package under workerd. Production provider delivery and device display
are separate pending checks.
