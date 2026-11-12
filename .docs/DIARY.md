# 07 Nov 2026

## Confirmed MVP decisions

- `QueryBooking` now includes `reservations` with reservation ID, `roomId`,
  current `roomName`, `from`, `to`, and `duration` in minutes calculated from
  the stored interval without rounding. Multiple rooms produce separate entries;
  a booking without reservations returns an empty array. Missing bookings still
  return `null`. Ordered by start, room sort order/name, then reservation ID.


- Added `.docs/v1.postman_collection.json`, an importable Postman v2.1 collection
  named `api`, covering all 22 distinct mounted API routes with 25 request examples.
  Uses `url` for the server URL and use case request names (e.g. `CreateBooking`).
  Includes JSON QUERY bodies, response ID chaining, booking/payment guidance,
  and empty credential placeholders. Validated route coverage and scripts locally;
  requests were not executed against the live API.

- Implemented `GET /v1/bookings/:bookingId` via `QueryBooking.query(bookingId)`
  and `GET /v1/demo-payment-orders/:orderId` via
  `QueryDemoPaymentOrder.query(demoPaymentOrderId)`. Both return one camelCase
  record or `null` with 200 when missing. Booking lookup exposes the stored
  status and `expireAt`; demo order lookup exposes `referenceId`, price and status.
- The intended MVP availability view combines `QueryRooms` and `QueryReservations`.
  Both reservation methods now return `roomId` per row; multiple rooms in a
  booking produce separate rows. The controller exposes `roomId` to consumers.
  Queries still select fully contained intervals; reservations crossing query
  boundaries are excluded, so overlap coverage remains a limitation.

- Use cases alias selected snake_case database columns to camelCase in SQL.
  Implemented the missing aliases in `QueryRoom`, both `QueryReservations` methods,
  `QueryUpfrontPaymentPolicy`, `SelectPaymentGateway`, and `EnsureRoomsAvailable`.
  Updated reservation controller reads and availability conflict handling to use
  the camelCase result fields.

- Renamed `demo_payment_order.external_order_id` to `reference_id` via migration
  `0011_demo_payment_order_reference_id.sql`, with matching `referenceId` names
  in code. It references our internal `payment.id`; the demo order retains its
  separate gateway order `id`. The webhook contract is recorded below.

- The immediate goal is an MVP demonstration for the client. Atomicity and
  concurrency protection are deferred.
- Gateway selection defaults to the demo PG when no `business_payment_gateway`
  row exists. Existing configuration rows also select demo until other gateways
  are implemented. ST3 Wonderland needs no gateway seed row for demo payments.
- Migration `0010_st3_wonderland_upfront_payment_policy.sql` configures the
  existing ST3 Wonderland business (`01a19f40-3132-76b0-8d17-3a042ee0cad6`)
  with an RM0.00 upfront business fee. `UpfrontPayment` still adds the RM1.50
  gateway fee. This migration does not configure a payment gateway.
- A payment is finalized whenever its status is not `pending`. Finalized payment
  outcomes cannot be reversed. Enforcement of this rule is explicitly deferred
  to a later date; the current webhook implementation does not enforce it yet.
- `booking.expire_at` stores an absolute UTC ISO timestamp, not a duration.
  Booking creation sets it to 10 minutes after creation. This supersedes the
  earlier decision to store integer minutes. Migration `0009_booking_expiry_timestamp.sql`
  converts existing durations into timestamps.
- Both `QueryReservations` methods expose the stored timestamp as `expireAt`.
  Select `b.expire_at AS expireAt` in SQL; the controller reads the aliased field.
  This supersedes the earlier decision to map `expire_at` in the controller.
  Clients deduce expiry from pending status and current time >= `expireAt`;
  no `isExpired` field is returned. Queries include expired rows and leave stored
  status unchanged. Availability compares the current time directly with
  `expire_at` as strings in the guaranteed UTC ISO format
  (`YYYY-MM-DDTHH:mm:ss.SSSZ`); confirmed bookings always block overlapping reservations.
  Bind `MyDateTime.now().toUtcIso()` for the current time; no SQL date conversion is needed.
- `EnsureRoomsAvailable` uses one SQL placeholder per room ID in its `IN` clause,
  binding each ID separately instead of passing a JSON array through `json_each`.
  Generate placeholders and map bound values inline; neither needs a local variable.
- Implemented `EnsureRoomsBelongToBusiness` immediately before `EnsureRoomsAvailable`
  in booking creation. Every supplied room must exist and belong to the supplied
  business; otherwise creation returns 404 before availability checks or writes.
- Implement `ConfirmPayment` by inserting a new `payment` row with status `paid`,
  retaining the existing pending row. It only records payment; confirming the
  booking remains the caller's responsibility through a separate `ConfirmBooking`
  call. `ConfirmPayment.exec(paymentId)` looks up the original payment internally,
  returns its booking ID, and throws 404 if the payment does not exist.
  `CancelPayment.exec(paymentId, status)` follows the same pattern for cancelled
  and rejected outcomes; `handleFail` passes its returned booking ID to
  `CancelBooking` separately. The webhook no longer depends on `QueryPayment`.

These are recorded decisions for subsequent implementation; this documentation
change does not implement API changes.

## Remaining API work and unresolved policies

- Public `POST /webhook/payment/demo` directly invokes the demo webhook handler.
  Each gateway will have its own endpoint; no payload gateway discriminator or
  gateway identification class is needed. The demo handler
  requires nonblank `orderId` (`demo_payment_order.id`) and `referenceId`
  (`payment.id`) alongside `status`. It resolves internal payments using
  `referenceId`; `orderId` is gateway metadata and is not looked up in the
  gateway database by this handler. It dispatches
  `paid` to `handleSuccess`, and `cancelled`/`rejected` to `handleFail`.
  Valid requests return 204; invalid payloads return 400. `handleSuccess` passes `referenceId` to `ConfirmPayment`, then
  passes the returned booking ID to `ConfirmBooking` as a separate call. Payment
  confirmation inserts a new paid row with the original amount and booking,
  retaining the pending row. Unknown payments return 404. Failure handling passes `referenceId` and the outcome to `CancelPayment`, which
  resolves the payment and inserts a new cancelled/rejected payment row retaining
  its booking and amount, then calls `CancelBooking` with the returned booking ID separately.
  The original pending payment is retained. Unknown payments return 404 for all
  outcomes. Gateway authentication and duplicate notification handling remain pending.

- Implemented `PUT /v1/demo-payment-orders/:orderId` with `status` (`paid`,
  `cancelled`, or `rejected`). It resolves the stored reference, updates the demo
  order, and invokes the existing webhook handler in process (no HTTP callback).
  Returns the order ID, reference ID, price, and status after webhook success.
  Atomicity and duplicate/finalized outcome enforcement remain deferred.
  Demo order lookup is implemented; connecting the demo payment page remains to be done.
- Demo webhook booking cancellation is wired; define allowed booking status transitions.
- Define how late payment notifications should be handled after a pending
  booking hold expires and its rooms become available again.
- Rejected/cancelled demo payments cancel the booking. Define payment retries
  and gateway failure recovery.
- Add room availability queries that account for overlapping reservations and
  expose room identity.
- Add upfront payment policy and gateway configuration management if needed for
  the demo; otherwise use seeded configuration.
- Define rental duration units, fee selection, rounding, and quote calculation.
- Decide whether the unused `CreateOrder` use case is needed.
- Refresh outdated statements in `BOOKING_LIFECYCLE.md` about existing routes,
  availability checks, migrations, and rental-fee management. Its payment flow
  must also reflect the separate responsibilities of `ConfirmPayment` and
  `ConfirmBooking` recorded above.
- Keep live gateway integration and refunds as later work.

# 11 Nov 2026

- Set unselected Time Button and `More` borders to 0.5px primary yellow at 30% opacity
  to make them visibly lighter; supersedes the 0.1px experiment. `More` text uses
  primary yellow. Updated the skill.

- Reduced the unselected Time Button and matching `More` button borders to 0.1px.
  The internal divider remains 0.5px. Updated the design skill.

- Mobile time slots initially show seven buttons plus a 16px `More` button when
  there are more than eight slots. Clicking reveals the remaining slots. Dates
  start collapsed; larger screens show all slots. Updated the design skill.

- Selected Time Buttons use semibold (600) time text; unselected time text and
  all room codes remain regular (400). Updated the design skill accordingly.

- Requested the Latin subset in the customer Google Fonts import; Time Button
  text uses Poppins Latin Regular (400).

- Set time buttons to four slots per row on mobile and six from the `sm`
  breakpoint; recorded the responsive layout in the customer frontend design skill.

- Added reusable customer `TimeButton` with Poppins Regular (400), 14px 12-hour time,
  a horizontal divider, and regular 12px available room acronyms (room name
  fallback). Selected buttons use yellow with black text/divider; unselected
  buttons use white text/divider and a 0.5px white border. Each button represents
  one available room/time pair, so start times repeat for different rooms.
  Selection tracks date, time, and room ID. Recorded this convention in the
  customer frontend design skill.

- Updated the customer frontend design skill with the matching 14px semibold white
  date/time labels, their wording and placement, and removal of timezone supporting text.

- Increased both `Select Date` and `Select Time` labels to semibold weight (600),
  retaining their 14px size and white color.

- Matched `Select Time` to the `Select Date` label's 14px regular-weight white styling.

- Renamed `Start time` to `Select Time` and removed the `Malaysia time (MYT)`
  supporting text on the customer booking screen.

- Added a 14px regular-weight white `Select Date` label below the step description and above the
  date buttons on `/customer/bookings/new`.

- Recorded the compact customer booking navigation bar convention in the
  customer frontend design skill, including its layout, colors, and inactive MDI menu.

- Reduced the customer booking navigation bar to 48px high and switched customer
  icons to MDI, including the shared Button icon type and design convention.

- Replaced the logo on `/customer/bookings/new` with a container-colored top
  navigation bar: white business name at the far left and a hamburger button
  at the far right. The menu button has no action yet.

- Updated the customer frontend design skill to record the heading and description
  placement inside the booking container, zero main padding, and borderless outer
  container while retaining internal padding, dividers, and button borders.

- Removed the outer date/time selection container's border.

- Removed all outer padding from the customer booking page's main element
  at every screen size.

- Moved the STEP 1 heading and description inside the date/time selection
  container, above the date buttons, using matching responsive padding.

- The date button row scrollbar uses primary yellow with a transparent track.

- Documented the full date button convention in the customer frontend design
  skill: seven-day scrolling row, dimensions, padding, spacing, Poppins text,
  selected/unselected colors, CSS overrides, and accessible selection labels.

- Added Google Fonts Poppins for date button text: weekday 14px regular (400),
  date 18px bold (700), month 12px regular (400). This supersedes Montserrat for date button text;
  Montserrat remains the default elsewhere. Updated the design skill accordingly.

- Call the custom calendar controls `date buttons`. Each date button uses 4px
  padding on all sides, a 56px width (`w-14 max-w-14`), and 2px vertical
  spacing between the three texts (`gap-0.5!`). Use `p-1!` and `gap-0.5!` to
  override the unlayered shared button CSS, which otherwise wins over utilities.

- Replaced the customer date picker and day navigation with seven calendar
  buttons from today in Malaysia time, in one horizontally scrolling row.
  Buttons are capped at 56px wide. Selected dates use primary backgrounds;
  unselected dates are transparent with white borders. Weekdays stay muted,
  date numbers use black when selected and white otherwise, and months use
  black when selected and primary otherwise. Dates outside the seven-day
  window fall back to today.

- Removed the `Availability` heading and formatted date label from the customer
  booking screen; the date picker remains available.

- Updated the customer frontend design skill to standardize booking step
  headings as `STEP <number>: <action>` in 20px Montserrat Bold (700), with a
  local size override for the default h1 styling.

- Changed the customer booking heading to `STEP 1: Select Date and Time`, using a local
  20px override with Montserrat Bold.

- Applied the customer design skill to the booking UI: Montserrat, black page
  background, rounded dark containers, muted supporting text, and primary and
  secondary timeslot buttons through the shared customer Button component.
  Date inputs use the dark color scheme; semantic status colors suit the dark UI.

- Updated the customer frontend design skill: Montserrat throughout, black UI
  background, rounded `#272727` containers, `#848484` muted text, and `#FFF000`
  primary. Primary buttons and selected timeslots use yellow with black text;
  secondary buttons and unselected timeslots use a thin yellow border,
  transparent background, and white text. White is `#FFFFFF`.

- The customer MVP starts at `/customer/bookings/new`. This slice shows rooms
  and availability by date and start time. It fetches the business, rooms, and
  reservations in parallel. The display uses Malaysia time and hourly start
  times, including the configured closing time. Availability is evaluated at
  each start time against confirmed reservations and unexpired pending holds.
- Migration `0012_business_hours.sql` adds nullable `business.open_at` and
  `close_at` as recurring UTC `HH:mm` values, exposed as `openAt` and `closeAt`
  by business lookup. ST3 Wonderland gets `02:00` and `14:00` UTC. Other
  businesses can have unset hours.
- The customer-facing reservation date query now returns all intervals that
  overlap the selected 24-hour window, including reservations that cross
  midnight. The range query retains its existing contract.

## Room categories and automatic assignment

- Implemented migration 0013 without rewriting prior migrations: each existing room initially owns a same-ID category; business/name/acronym/order move to it, physical names become old acronyms (name fallback), IDs/fee values/reservation and payment relationships are preserved. Grouping FR1/FR2/FR3 into Family remains an explicit later configuration step.
- Categories own rental fees and business scope; physical rooms contain category ID/name/order. Category management and category rental fee routes replace the corresponding customer room/pricing contracts. Staff room management remains available with roomCategoryId.
- CreateBooking now takes one roomCategoryId and assigns the first physical room continuously free for the exact interval by sort order/name/ID. Store both original category and assigned room. Missing/foreign categories return 404; no eligible room returns 409 before writes. Existing positive-minute duration, payment and ten-minute hold behavior remains. MVP atomicity and concurrency protections are still deferred.
- Both reservation query variants now require businessId. Responses expose assigned roomId and stored requested roomCategoryId. Date queries include all overlaps including midnight; range queries retain contained intervals. Confirmed/live pending bookings block; cancelled/expired holds do not; adjacent boundaries are allowed. These supersede earlier diary entries on room selection and reservation scope.
- Customer controls use category/time pairs with 15-minute starts and durations, bounded by closing and one room's continuous availability. Default to first pair/15 minutes, retain valid duration across selection changes or announce reset. Duration options and category/full interval summary replace physical room list; mobile More and existing styles remain. Customer details/submission/payment screens are unchanged in scope.

- Verification: API types and 51 SQLite/API/availability tests pass. Migration 0013 preserves populated history with foreign keys enabled inside a transaction; all migrations also apply to isolated local D1 under /tmp. Production web build passes. Browser review at 390px and 1440px covered More expansion, category labels, duration adjustment, category changes and retained duration/date collapse. Source-only Svelte checking reports zero errors and five existing warnings; the standard web check currently follows Wrangler's generated main-module import into build JavaScript and reports generated-code diagnostics. All 28 local Postman examples parse and their scripts compile; the installed Postman CLI lacks the `status` command. No remote migration, deployment or Postman publication was performed.

# 12 Nov 2026

- Explicitly locked selected Time Button hover backgrounds to solid primary and disabled their transitions so selecting a hovered time does not animate from the unselected hover color.

- Applied primary/30 hover backgrounds to unselected Time Buttons. Selected Time Buttons keep their solid primary background and full opacity on hover, matching selected date and room buttons.

- Applied primary/30 hover backgrounds to unselected date buttons as well as room buttons. Selected date and room buttons (including Family) retain their solid primary background and full opacity on hover. Supersedes the previous all-room hover styling.

- Matched unselected Select Room button borders to the date buttons' white border. Room buttons now use a primary/30 background on hover, overriding the shared whole-button opacity effect. Updated the customer design skill.

- Added migration 0015 introducing ST3 Wonderland category `RACING`, acronym `RACING`, sort order 4. No physical rooms or rental fees are configured for it yet. Verified the migration on an in-memory copy of local D1 with foreign keys enabled; migration is not yet applied to local or remote D1.

- Grouped ST3 Wonderland categories as Family (`FAMILY`), Open (`OPEN`) and VIP (`VIP`) through migration 0014, applied to local D1. Family contains FR1–FR3; Open contains OS1–OS4. Physical room IDs/names, reservation IDs/intervals and rental fee IDs/values are preserved; category references are consolidated. This completes the previously deferred grouping configuration. Verified all eight rooms, five reservations, the existing 60-minute RM18 fee and clean foreign keys. No remote database changes were made.

## Booking JSON contracts use snake_case

- Switched every booking backend request/response JSON field, including auth expiry,
  nested booking reservations, and demo payment webhook IDs, to snake_case with no
  camelCase compatibility layer. This explicitly supersedes all earlier camelCase
  JSON and SQL-alias decisions above (`roomId`, `expireAt`, `referenceId`, etc.).
- SQL now selects existing snake_case columns directly; joined/derived names retain
  meaningful snake_case aliases. QueryRoomCategories exposes business_id,
  sort_order and room_ids, including empty arrays for categories without rooms.
- Updated payment orchestration and customer availability consumers, API docs,
  local Postman collection, and API/customer design skills. TypeScript local
  variables, positional parameters, methods, class names, framework/library
  options, standard JWT claims, and retired game frontend contracts retain their
  existing conventions. Routes, schema, status codes and booking/payment behavior
  are unchanged; no migration or deployment was performed.
- Generic SQLite test fixtures now apply schema migrations through 0013, excluding
  site-specific 0014/0015 configuration that assumes ST3 seed data. The previous
  all-migrations fixtures failed foreign keys on 0015's absent business (and the
  pre-0013 fixture could not run 0014 against the older schema).
- Verification: API types and all 52 tests pass, including exact nested shapes,
  empty category room arrays, snake_case validation and camelCase-only rejection,
  and demo webhook processing. Production web build passes. Source-only Svelte
  checking reports zero errors and five existing warnings; standard web checking
  still follows Wrangler generated imports and reports 54 generated-code errors.
  All 28 Postman request examples parse and 28 scripts compile locally; the
  installed CLI does not support `postman status`. Chrome verification against
  local snake_case API fixtures passed availability loading, mobile More,
  category/time selection, duration changes and date selection. No live service
  calls or Postman publication were used for verification.

## Booking step 1: four selection sections

- Split the customer booking page into vertically stacked Select Date, Select Room, Select Time and Select Duration sections with matching 14px semibold white labels. Room means category; physical room assignment remains automatic. Category buttons show names and only categories with at least one one-hour booking. Times are unique within the selected category, without category code/divider.
- Supersedes the earlier 15-minute duration policy: starts remain every 15 minutes, but durations default to one hour and increase/decrease in whole hours, stored in minutes. The shared MDI minus/plus stepper is bounded by closing and continuous availability in one physical room. Starts with less than an hour free are hidden; partial hours cannot extend a duration.
- Retain valid category/time/duration across changes; fall back to the first available category/time and reset invalid duration to one hour with a status announcement. Date navigation retains component state. Mobile More collapses on date/category changes. Category/date/full interval/hourly duration summary remains. No API, database, assignment, customer details, submission or payment changes. Updated the customer design skill.
- Verification: four availability tests pass, covering hourly durations, partial hours, quarter-hour starts, closing/conflict boundaries, hold expiry and continuous single-room availability. Source-only Svelte check passes with zero errors and five existing warnings; standard web checking still follows generated Cloudflare/build imports and fails on generated code. Final production web build passes. Browser checks at 390px and 1440px passed category filtering, More expansion/collapse, duration bounds and reset announcement, date/category duration retention, stacked layouts and no horizontal overflow.

- Removed the STEP 1 heading and introductory “Choose a date…” description from `/customer/bookings/new`. Select Date now starts the container without the former extra top margin. This supersedes the design skill’s heading placement guidance; the skill file is read-only in this workspace.

- Matched Select Duration minus/plus buttons to unselected time buttons: 0.5px primary yellow borders at 30% opacity and primary/30 hover backgrounds with full content opacity. Existing duration bounds remain.

- Removed the horizontal dividers between Select Date, Select Room, Select Time and Select Duration on `/customer/bookings/new`, retaining section padding and button borders.

- Restyled Select Duration minus/plus buttons to match unselected Select Room buttons: standard thin white borders and primary/30 hover backgrounds with full content opacity. Supersedes their time-button border styling; duration bounds remain unchanged.

- Changed duration stepper hover styling to solid primary yellow backgrounds and black icons/text, keeping white borders. Supersedes the previous primary/30 hover background.

- Hid duration stepper borders on hover using transparent borders to preserve button dimensions, retaining solid primary backgrounds and black icons.

- Removed the category/date/time/duration summary below Select Duration on `/customer/bookings/new`, superseding the earlier summary requirement. Duration controls and adjustment announcements remain.

- Added a shared primary Confirm button on `/customer/bookings/new`: yellow background, black text and no border. Fixed to the viewport bottom, centered on mobile and right-aligned from `sm`, with safe-area spacing and room below the selection container so it cannot obscure the final controls. This change adds the button presentation only; confirmation behavior remains unspecified.

- Set the Confirm button label to 16px.

- Aligned the fixed Confirm button with the booking container's right edge on desktop by centering its viewport-fixed wrapper at the same `max-w-5xl` width. Mobile remains centered.

- Widened the Confirm button from 128px to a 192px minimum width, retaining its alignment and 16px label.

- Increased the Confirm button minimum width again to 256px.

- Added a container-colored full-width background and top padding around the fixed Confirm button on mobile. Desktop retains its transparent wrapper and right alignment.

- Rounded the mobile Confirm container's top corners with `rounded-t-2xl`, matching the booking container's corner radius.

- Updated the customer frontend design skill with the final Confirm styling, width, responsive alignment, rounded mobile container, safe-area spacing and content clearance.

- Styled the Select Duration value (such as “1 hour” or “2 hours”) in primary yellow and bold.

- Set Select Room category buttons to a consistent fixed 144px width and 48px height, retaining wrapping rows and allowing category labels to wrap within each button.

- Changed Select Room to one horizontally scrolling row with non-shrinking fixed-size buttons and the same primary yellow scrollbar as Select Date. Supersedes wrapping room button rows.

- Updated the customer frontend design skill with fixed room button dimensions, the single horizontally scrolling row and matching scrollbar, and bold primary-yellow duration values.

- Reduced Select Room button width from 144px to 120px (`w-30`), retaining the fixed 48px height and horizontal scrolling. Supersedes the skill's 144px width.

- Updated the customer frontend design skill to specify 120px by 48px room buttons.
