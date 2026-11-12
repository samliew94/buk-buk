# Booking API

A minimal Cloudflare Worker using Hono, constructor injection, and JWT authentication with role authorization.

From the repository root, run `pnpm install`. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`, set a random JWT secret of at least 32 characters and an admin password, then run `pnpm --filter api dev`. Local secrets are ignored by Git. Configure production secrets with `pnpm --filter api exec wrangler secret put JWT_SECRET` and `pnpm --filter api exec wrangler secret put ADMIN_PASSWORD` before deploying.

## HTTP contract

All request and response JSON object keys use snake_case, including records within arrays. Database columns retain their SQL names.

| Method | Path | Access | Response |
| --- | --- | --- | --- |
| GET | `/v1/bookings/:bookingId` | Public | 200 with `{ "id", "customer_id", "status", "created_at", "expire_at", "reservations" }`, or `null` if missing |
| GET | `/v1/demo-payment-orders/:orderId` | Public | 200 with `{ "id", "reference_id", "price", "status", "created_at" }`, or `null` if missing |
| GET | `/` | Public | `{ "name": "booking-api", "status": "ok" }` |
| PUT | `/v1/demo-payment-orders/:orderId` | Public, JSON `{ "status": "paid" }` | 200 with `{ "id", "reference_id", "price", "status" }`; also accepts `cancelled`/`rejected`. Unknown order is 404; invalid body/status is 400. |
| POST | `/webhook/payment/demo` | Public, JSON `{ "order_id": "...", "reference_id": "...", "status": "paid" }` | 204 with no body; invalid payloads return 400. Demo statuses: `paid`, `cancelled`, `rejected`. Success inserts a new paid payment row, retains the original pending row, then confirms its booking; unknown payment IDs return 404. Cancelled/rejected outcomes insert a new payment row with the reported status, retain the pending row, then cancel the booking. |
| GET | `/v1/businesses/:id` | Public | `{ "id", "name", "open_at", "close_at" }`, or 404 if missing |
| PUT | `/v1/businesses/:id` | Public, JSON `{ "name": "..." }` | Updated `{ "id": "...", "name": "..." }`; invalid input is 400, missing business is 404 |
| POST | `/v1/businesses` | Public, JSON `{ "name": "..." }` | 201 with `{ "id": "...", "name": "..." }`; invalid input is 400 |
| POST | `/v1/customers` | Public, JSON `{ "name": "...", "phone": "..." }` | 201 with `{ "id": "...", "name": "...", "phone": "..." }`; invalid input is 400 |
| PUT | `/v1/customers/:id` | Public, JSON `{ "name": "...", "phone": "..." }` | 200 with `{ "id": "...", "name": "...", "phone": "..." }`; invalid input is 400, missing customer is 404 |
| GET | `/v1/customers/:id` | Public | 200 with one `{ "id": "...", "name": "...", "phone": "...", "created_at": "..." }` record, or `null` if missing |
| QUERY | `/v1/room-categories` | Public, JSON `{ "business_id": "..." }` | Ordered categories with room_ids |
| POST | `/v1/room-categories` | Public, category JSON below | 201 with created category |
| PUT | `/v1/room-categories/:id` | Public, category JSON below | 200 with updated category |
| QUERY | `/v1/rooms` | Public, JSON `{ "business_id": "..." }` | Array of physical rooms ordered by sort order, name, then ID; missing business is 404 |
| POST | `/v1/rooms` | Public, room JSON below | 201 with the created room; invalid input is 400, missing category is 404 |
| PUT | `/v1/rooms/:roomId` | Public, room JSON below | 204 with no body; invalid input is 400, missing category or room is 404 |
| QUERY | `/v1/room-category-rental-fees` | Public, JSON `{ "room_category_id": "..." }` | One fee for the category, or `null` if none matches |
| POST | `/v1/room-category-rental-fees` | Public, fee JSON below | 201 with the created fee; invalid input is 400 |
| PUT | `/v1/room-category-rental-fees/:id` | Public, fee JSON below | 200 with the updated fee; invalid input is 400, missing fee is 404 |
| POST | `/v1/bookings` | Public, booking JSON below | 201 with `{ "booking_id": "...", "payment_url": null }` or a payment URL; invalid input is 400 |
| QUERY | `/v1/reservations` | Public, JSON `{ "business_id": "...", "from": "...", "to": "..." }` or `{ "business_id": "...", "date": "2025-12-31T16:00:00Z" }` | 200 with an array of booking records; invalid input is 400 |
| POST | `/v1/auth/login` | Public, JSON `{ "password": "..." }` | `{ "token": "...", "expires_at": "..." }` |
| GET | `/v1/auth/me` | Bearer JWT | `{ "id": "...", "role": "admin" or "user" }` |
| GET | `/v1/auth/admin` | Admin bearer JWT | Same identity response; demonstrates role authorization |

Errors use `{ "error": "..." }`: malformed login input is 400, wrong credentials or invalid/expired tokens are 401, insufficient role is 403, unknown routes are 404, and unexpected/configuration errors are 500 without internal details. Auth responses disable caching. JWTs expire after 24 hours and require HS256, the `booking-api` issuer, the `booking-web` audience, a subject, expiry and supported role.

Category writes require `{ "business_id": "business-1", "name": "Family", "sort_order": 0, "acronym": "FR" }`. Acronym is optional/null on create and nonblank on update. POST `/v1/room-categories` returns 201; PUT `/v1/room-categories/:id` returns 200 with the written fields and ID. QUERY with `{ "business_id": "..." }` returns categories with `id`, `business_id`, `name`, `acronym`, `sort_order`, `room_ids`, including empty categories. Categories and their nested room IDs sort by sort order, name, then ID.

Physical room writes require `{ "room_category_id": "category-1", "name": "FR1", "sort_order": 0 }`. POST `/v1/rooms` returns 201 with `id` and those fields; PUT `/v1/rooms/:roomId` retains 204. Missing categories or rooms return 404. QUERY `/v1/rooms` requires business_id, derives ownership through the category, and returns physical fields ordered by sort order/name/ID. Physical rooms have no business_id or acronym columns.

Admin login retains the original shared-password model with generic naming. There is no user registration, password database, refresh token or revocation store. The `user` role is supported for future identity providers but cannot be minted through admin login. Changing JWT_SECRET invalidates existing sessions. Before exposing login publicly, add rate limiting at the deployment boundary.

## Dependency injection

Booking creation accepts `{ "business_id": "business-1", "customer_id": "customer-1", "room_category_id": "category-1", "from": "2026-11-11T07:00:00.000Z", "duration": 90 }`. Duration remains any finite positive number of minutes. A missing or foreign category returns 404. The first continuously available room ordered by sort order/name/ID is assigned. Empty or unavailable categories return 409 before writes. Reservations store both the requested category and assigned room. Booking/payment behavior remains unchanged.

Both reservation query variants require business_id: `{ "business_id": "...", "from": "...", "to": "..." }` or `{ "business_id": "...", "date": "2026-11-10T16:00:00.000Z" }`. Responses include `id`, `room_id`, `room_category_id`, `customer_id`, `status`, `created_at`, `expire_at`, `from`, `to`. Business ownership follows assigned room → category. The stored requested category is returned. Range filtering retains `from >= lower AND to < upper`; date filtering returns all overlaps in the exact 24-hour window. Datetimes without offset use Asia/Kuala_Lumpur. Date requires UTC ISO with seconds and Z.

Apply migrations through `0013_room_categories.sql` locally with `pnpm --filter api exec wrangler d1 migrations apply DB --local`. Existing rooms initially become separate categories with deterministic IDs; grouping physical rooms under Family is a later configuration action. Fees and reservation history are preserved. See `.docs/SCHEMA.md` and `.docs/BOOKING_LIFECYCLE.md` for details.

`src/dependencies.ts` is the composition root. It supplies an `AuthenticationService` through Hono context. Services receive dependencies through constructors; controllers read interfaces from context. `createApp(factory)` accepts an alternate factory for tests or future implementations. Mount `authenticate` followed by `authorize(...roles)` on protected routes.

Bookings without an upfront payment policy are immediately `confirmed`. Bookings requiring upfront payment remain `pending` until payment is confirmed.

Availability uses `existing.from < requested.to AND existing.to > requested.from`. Confirmed bookings and unexpired pending holds block; cancelled bookings and expired holds do not. Boundary meetings are permitted. MVP concurrency protection and atomicity remain deferred.

## Validation

Run `pnpm --filter api types` and `pnpm --filter api test`. Regenerate Worker runtime declarations after configuration changes with `pnpm --filter api cf-typegen`.

The treasure-hunt controllers, services, migrations, AI integrations, asset storage, KV exchange tokens and queues have been removed. The old frontend still calls retired endpoints and requires its own cleanup.

## Customers

Customer writes require nonblank string `name` and `phone` values. POST generates the customer ID and stores the current UTC time as `created_at`; client-supplied IDs and timestamps are ignored. PUT uses the path ID and preserves `created_at`. Write responses contain `id`, `name`, and `phone`. GET `/v1/customers/:id` returns one customer with `id`, `name`, `phone`, and `created_at`, or `null` if missing, always with status 200. Apply migrations through `0007_customer_created_at.sql` before creating customers.

## Category rental fees

QUERY `/v1/room-category-rental-fees` accepts `{ "room_category_id": "..." }` and returns the first fee by ID or null, including unknown categories. POST and PUT `/:id` require `{ "room_category_id": "...", "duration": 1, "price": 12.5 }` and return 201/200 with ID and those fields. Duration remains a nonnegative safe integer; price is finite and nonnegative. Missing fee updates return 404; category references rely on foreign keys. Multiple fees per category remain allowed. No quotation calculation is introduced. The former room-rental-fees routes are retired.

Booking creation stores a UTC ISO expiry timestamp in `booking.expire_at`, initially 10 minutes after creation. Both reservation query methods return this stored timestamp as `expire_at`. This deadline applies to pending bookings only; confirmed bookings remain reserved. Queries include expired bookings. Clients determine expiry using pending status and current time >= `expire_at`; no `isExpired` field is returned. Stored status remains unchanged. Availability checks ignore expired pending bookings; confirmed bookings continue to block rooms.

Demo webhook IDs are required nonblank strings: `order_id` is the gateway `demo_payment_order.id`, and `reference_id` is our internal `payment.id` (stored by the demo gateway as `reference_id`). The handler resolves the payment using `reference_id`; it does not query or update the gateway database using `order_id`.

To simulate a guest payment through the API, take the order ID from booking creation's `/demo/payment/{order_id}` URL and call `PUT /v1/demo-payment-orders/{order_id}` with `{"status":"paid"}`. The gateway updates its stored order and invokes the existing demo webhook handler in process with `{order_id, reference_id, status}`. A successful response means the payment was recorded and the booking confirmed. No outbound HTTP callback is sent. Cancelled/rejected outcomes cancel the booking. Atomicity, duplicate handling, and finalized-outcome enforcement remain deferred; if webhook processing fails, the gateway order may already have been updated. The demo payment page is not wired by this change.

Booking lookup includes a `reservations` array (empty when there are none). Each entry contains `id`, `room_id`, `room_name`, `room_category_id`, `room_category_name`, `room_category_acronym`, `from`, `to`, and `duration` in minutes, calculated from the stored UTC timestamps without rounding. Entries are ordered by start time, room sort order, room name, then reservation ID. Room names reflect the current room record.
