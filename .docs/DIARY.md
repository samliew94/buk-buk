# 07 Nov 2026

- Renamed Wrangler projects to `bukbuk-customer` (apps/web), `bukbuk-admin`
  (apps/admin), and `bukbuk-api` (apps/api) on 14 Nov 2026, aligning the
  frontend Worker names with the intended production hosts. No deployment performed.

- Shared customer TopNav hamburger now opens a right-side black drawer with a
  white overlay at 33% opacity. Its only link is New Reservation, pointing to
  `/customer/bookings/new`, in white 14px Montserrat Regular with primary-yellow
  text while pressed. Native modal focus handling, Escape, overlay dismissal and
  a close button are supported; selecting the link closes the drawer.
- From the desktop (`md`, 768px) breakpoint, hide the hamburger and display
  New Reservation directly in TopNav using 16px Montserrat Regular, white text
  and primary-yellow text while pressed. Mobile retains the 14px drawer link.
- Fixed desktop hamburger visibility by applying responsive hiding to its wrapper,
  avoiding the shared Button's inline-flex display override. The desktop link uses
  an automatic left margin to stay at the far right.
- Desktop New Reservation text also turns primary yellow on hover.
- Desktop New Reservation lifts 2px on hover with a 200ms transition, respecting
  reduced-motion preferences.
- Mobile navigation drawer now spans the full viewport width at the top, uses
  only its content height, and centers option labels horizontally. This replaces
  the full-height right-side drawer; black background and white/33 overlay remain.
- Mobile drawer snaps directly below the shared nav bar, using its measured
  bottom edge when opened and limiting overflow to the remaining viewport height.
- Added a downward black shadow beneath shared TopNav, with relative positioning
  and stacking so the shadow appears above adjacent page content.
- Limited the navigation drawer's white/33 backdrop to below the measured nav
  bottom edge, keeping the nav bar undimmed while the drawer is open.
- Changed the navigation drawer overlay to #626262 at 14% opacity, retaining
  its below-navbar placement.
- Removed the mobile drawer close icon and its row. Hamburger now toggles the
  drawer; a nonmodal panel keeps the hamburger interactive. Overlay taps, Escape
  and selecting New Reservation close it. Panel and overlay hide on desktop.
- Added 4px backdrop blur to the mobile navigation overlay, retaining #626262
  at 14% opacity and its placement below the navbar.

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

- Added a white 1.75rem “Contact Info” heading above the Name field on
  `/customer/bookings/new/customer-info`.

- Updated the customer frontend design skill to reflect the implemented shared
  navigation, three-row icon summary, customer form, selector arrow spacing,
  centered Submit, draft persistence and disabled primary button behavior.
  Removed superseded heading, divider and selection-summary guidance.

- Disabled primary buttons now use primary yellow at 30% background opacity,
  retain full text opacity and suppress hover fading. Confirm requires a valid
  displayed date and matching selected category/time with an available duration;
  existing automatic valid selections remain. Submit requires non-whitespace
  name and mobile input, and disables again if either is cleared.

- Horizontally centered the customer-info Submit button below the form fields.

- Added a shared primary yellow Submit button below the customer-info mobile
  number controls. The form still prevents submission; booking creation remains
  outside this presentation change.

- Reused a shared TopNav on selection and customer-info pages: the same 48px
  dark bar, business name and MDI menu button. Customer info loads the configured
  business name independently so the bar also works after refresh or direct entry.

- Vertically centered each customer-info summary icon with its text and removed
  the icons' top offset.

- Inset the country selector arrow 12px from its right border using an MDI
  chevron, with reserved text padding and the native select interaction retained.

- Added separate MDI icons to each customer-info summary row: calendar for date,
  door-open for room category, and clock-outline for start time and duration.

- Split the customer-info yellow booking summary into three lines: date, category,
  then start time and duration separated by a middle dot (e.g. `10:00AM · 1 Hour`).
  Duration labels now use `Hour`/`Hours` in this summary.

- Confirm now saves the valid date, selected category as `room: { id, name }`,
  Malaysia start time and duration in minutes under `customer.booking-draft`, then
  navigates to `/customer/bookings/new/customer-info`. Invalid selections disable
  Confirm; storage failures keep the selection page open with an inline error.
- Customer info reads and validates the draft client-side across refreshes. A
  full-width yellow calendar summary precedes Name and inline country/mobile
  controls on black. Country defaults to MY (+60), with SG (+65) available.
  Missing, malformed or inaccessible storage shows recovery guidance and a link
  back. Contact details stay in page state; no submit, API or database changes.
- Verification: production web build passes; source-only Svelte checking has zero
  errors and five existing warnings. Standard checking still follows generated
  build code (1369 errors in this run). Browser checks passed Confirm save/navigation
  and blocked writes, missing/malformed/blocked reads, refresh, MYT summary and
  singular/plural hours, country switching, focus styling, inline phone controls
  and overflow checks at 390px and 1440px.

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

## Customer-info booking submission

- Customer-info Submit now uses an enhanced SvelteKit form action. Validate contact
  fields, supported MY/SG calling codes and the saved booking draft before API
  requests. Trim name/mobile, concatenate calling code and mobile, await
  `POST /v1/customers`, then use its returned ID in `POST /v1/bookings` with
  `business_id`, `customer_id`, `from`, `duration` and `room_category_id`.
  Convert Malaysia-local draft date/time to UTC ISO; duration stays in minutes.
- Disable contact controls and Submit during submission and guard repeated submits.
  Failures show an accessible inline error while retaining inputs and draft for retry.
  Success restores the existing form without a modal, message, navigation or draft
  removal; ignore the returned payment URL. No rollback or automatic retry: a
  subsequent submission creates a new customer and booking. Backend contracts and
  automatic physical room assignment are unchanged. This supersedes earlier notes
  describing customer-info submission as unimplemented.
- Verification: local-fixture Chrome checks passed sequential exact payloads,
  MY/SG calling codes, UTC conversion across midnight, duplicate submission guard,
  disabled controls, unchanged success page and retained draft, both API failure
  paths retaining inputs, and blank contacts/invalid drafts preventing requests.
  No live API writes were used.
  Final source-only Svelte checking passes with zero errors and five existing
  warnings. Wrangler type freshness check and the production Vite build pass.

- Switched customer-info submission to direct browser fetches at the developer's
  request, superseding the SvelteKit action above. Submit now awaits
  `POST /v1/customers`, then `POST /v1/bookings` directly against the configured
  public API URL. The page loader supplies that URL and business ID; its business
  name lookup remains. Removed the form action and enhancement. Client validation,
  UTC conversion, duplicate guard, inline errors, retained inputs/draft and silent
  success behavior remain. Existing backend CORS already permits browser calls.
  Verification: browser network checks confirm all submission POSTs go directly
  to the API, with sequential exact payloads, MY/SG codes, UTC rollover, duplicate
  prevention, retained failure inputs and unchanged success/draft behavior passing.
  Production build passes; source Svelte check has zero errors and five existing warnings.

- Renamed `/customer/bookings/new/customer-info` to
  `/customer/bookings/new/contact-info` and updated Confirm navigation. This
  supersedes the old route in the customer frontend design skill, which is
  read-only in this workspace. SvelteKit route sync and formatting checks pass.

- Added reusable customer ErrorModal: white rounded card, overlapping 80px black
  circle, primary-yellow mdi:exclamation-thick, 22px Montserrat Bold title and
  18px Poppins Regular description. Native dialog supports Escape and backdrop
  dismissal. Existing selection-storage and contact submission errors now use it,
  retaining specific messages and inputs. Incomplete Selection is the default
  title; existing disabled Confirm behavior remains.

- Updated the customer frontend design skill to require reuse of ErrorModal,
  recording its icon, typography, configurable copy, description-driven opening,
  error-state clearing on dismissal and preserved customer inputs. Replaced the
  outdated inline storage-error guidance with the shared modal convention.

- Changed the shared error modal backdrop to white (#FFFFFF) at 33% opacity,
  retaining its 2px blur. Updated the customer frontend design skill accordingly.

- Contact-info now saves trimmed name, country_code and mobile as JSON under
  `customer.contact-info` in localStorage when a valid booking is submitted,
  before API requests. Returning customers have those fields prefilled on mount.
  Unsupported calling codes, malformed saved data and unavailable storage are
  ignored; optional contact persistence never blocks booking submission. This
  supersedes the earlier instruction to keep contact details only in page state.

## Demo payment gateway page

- Added `/demo/payment/[orderId]`, matching booking `payment_url`. Loads the demo
  order using the configured public API URL and displays Order ID and MYR Amount
  with Approve and Cancel side by side. Buttons PUT `paid` or `cancelled` directly
  to the demo order API, which runs existing booking/payment webhook processing.
- Disable both buttons while submitting and for completed orders; show the result
  in place. Ambiguous request failures ask the user to reload to check status and
  disable further submissions. Missing orders return 404; loading failures show
  an error page. Contact-info submission still ignores payment_url as previously
  requested; no automatic redirect was added.
- Verification: production build and Wrangler type freshness check pass. Standard
  Svelte checking remains blocked by generated-code errors (1388 errors, five
  existing warnings); no diagnostics point to the new route's source files.
  Browser interactions and live payment writes were not exercised.

## Temporary booking conflict bypass

- At the developer's request, `AssignRoom.exec` now has a literal `if (true)`
  branch that selects the first category room by sort order/name/ID without
  checking reservations. POST `/v1/bookings` accepts overlapping bookings,
  including confirmed reservations and live pending holds. Set the branch to
  `false` to restore the existing conflict-aware assignment query.
- Category existence/business ownership and empty-category rejection remain.
  Availability query behavior is unchanged. Updated API documentation and existing
  booking/assignment tests to reflect the temporary behavior.
- Verification: API TypeScript checking and all 14 test files pass locally.

- Corrected the demo payment URL to `/payment/demo/{orderId}` and moved the
  frontend page to `/payment/demo/[orderId]`. This supersedes the earlier
  `/demo/payment` path. Updated the booking response assertion and API docs.
  Verification: booking schema test file and production web build pass.

- Styled `/payment/demo/[orderId]` with a blue Approve button and white text,
  a borderless ghost Cancel button with black text, and a horizontally centered
  amount value without the Amount label.

- Set the demo Approve button's blue background and white text explicitly in
  scoped CSS after the utility styling did not appear in the rendered page.

- Added 12px top and bottom padding to both demo payment buttons for a more
  spacious appearance consistent with the customer booking controls.

- Changed the demo payment page to a black background with white text, including
  the Order ID label, Cancel button and status/error messages. Removed the white
  card background; Approve retains its blue background and white text.

- Reverted the demo payment dark theme at the developer's request. Restored the
  light slate background, white card, dark text and black ghost Cancel label;
  retained the blue Approve button and 12px vertical button padding.

- Horizontally centered the demo payment status description below the buttons,
  including the Payment approved message.

- Set the demo payment Order ID label to 12px.

- Matched the Payment approved status text to the Approve button's blue (#1d4ed8).

- Set the demo payment Order ID label to the muted color #848484 using scoped CSS.

- Added the repository `payment-demo-design` agent skill documenting the final
  light theme, amount/Order ID presentation, button spacing/colors and centered
  status styling, alongside existing payment interaction behavior.

- Updated `payment-demo-design` to specify the Order ID label's muted gray
  #848484 and scoped `.order-id-label` color rule.

- Successful Approve/Cancel submissions now redirect to
  `/customer/bookings/{booking_id}`. Demo payment PUT responses include the
  booking ID joined through the original payment; failures retain reload
  guidance. The destination booking detail route is not implemented yet.
  Updated the API docs, Postman assertions and payment demo skill. Verification:
  API TypeScript checking, all 14 test files and production web build pass.
  Ran tests with `node --import tsx --test` because the tsx CLI IPC socket is
  restricted in the sandbox. Installed Postman CLI still lacks `status`.

- Moved demo payment order GET to a browser fetch. The server loader now supplies
  only public API configuration and order ID. Loading and inline failure/missing
  order states hide payment controls until lookup succeeds; obsolete loads are
  aborted on navigation. Approve/Cancel and success redirects remain unchanged.
  Updated the payment demo skill; supersedes server-side order error handling.
  Verification: formatting, skill validation and production web build pass.
  Svelte checking remains blocked by generated-code diagnostics (1385 errors,
  five existing warnings); no diagnostics target the edited source files.

- After successful demo payment submission, append “Please wait...” to the
  outcome and wait three seconds before redirecting to
  `/customer/bookings/{reference_id}`. At the developer's explicit request the
  route parameter now uses `reference_id`, which is the internal payment ID,
  rather than the response's actual `booking_id`. Cancel pending redirect timers
  on navigation. Existing completed orders still show status when loaded directly.

- Added gateway-independent `/customer/payments/[paymentId]`. It fetches
  `GET /v1/payments/{paymentId}` from the browser using the existing QueryPayment
  use case and redirects with history replacement to
  `/customer/bookings/{booking_id}`. Missing payments and lookup failures display
  an error without redirecting; obsolete loads are aborted on navigation.
- Demo Approve/Cancel now wait three seconds before redirecting to
  `/customer/payments/{reference_id}`, retaining the outcome and “Please wait...”
  message. This supersedes using a payment ID directly in the booking URL.
  Booking detail page implementation remains outstanding. Added lookup contract
  tests, API docs, Postman request and updated payment demo skill.
  Verification: API TypeScript checking, all 14 test files, production web build
  and skill validation pass. No live payment writes or browser checks performed.

- Demo payment outcomes now show “Payment approved. Redirecting in 3...” or
  “Payment cancelled. Redirecting in 3...”, counting down to the customer payment
  page. Start the countdown after successful submission and on loading an
  already paid/cancelled order; retain the three-second delay and timer cleanup.
  Supersedes “Please wait...” and status-only display for completed orders.
  Clarified that every non-pending status, including rejected, starts the same
  countdown on initial lookup. Production web build passes.

## Customer booking details

- Implemented read-only `/customer/bookings/[booking_id]` using shared TopNav,
  Montserrat and customer theme/status colors. The loader supplies the booking ID
  and public API URL and loads the configured business name with a nonblocking
  failure fallback, following the contact-info convention.
- Browser lookup consumes the existing snake_case booking response with an
  eight-second timeout and navigation abort/stale-result protection. Includes
  accessible loading, missing-booking and request-failure states with reload
  guidance, a descriptive title and noindex metadata.
- Displays booking reference/status and all reservations' category, assigned room,
  Malaysia date/start/end times and minute-aware duration. Cross-midnight end times
  include their date; empty reservations have explicit guidance. Pending holds
  display Expired after expire_at, updating while open without changing stored
  status or polling the API. No backend or payment-flow changes.
- Verification: formatting and production web build pass; Wrangler type freshness
  passes. Standard Svelte checking reports 1398 generated-JavaScript errors and
  five existing warnings; none target the new route source. A temporary check
  disabling checkJs passes with zero errors and the same five warnings.
- Mocked Playwright/Chrome checks cover confirmed/cancelled/live pending/expired
  pending, expiry while open, direct entry/reload, payment-lookup arrival, client
  navigation between booking IDs and obsolete responses, missing/null booking,
  failed request, timeout, empty/multiple reservations, Malaysia midnight rollover
  and 90-minute duration. Reviewed 390px/1440px screenshots and long-reference
  wrapping; no horizontal overflow. No live booking/payment writes performed.

- Restyled customer booking details with a white rounded container, muted labels
  and black values, including status. Removed visible Booking details/Reservations
  headings and timezone note. Each label appears above its value in a single
  column: Booking reference, Status, then Date, Room, Time and Duration for each
  reservation. Room includes category and assigned room; Time shows only the
  Malaysia start time, with duration displayed separately.
- Verification: formatting and production build pass. Mocked Chrome checks at
  390px/1440px confirm stacked labels/values, black values, white container,
  requested field order, start-time-only display and no horizontal overflow.

- Added a horizontal divider immediately after booking status, using evenly
  spaced pale muted round dots matching the supplied reference. Uses a semantic
  horizontal rule with a repeating CSS radial gradient. Formatting check passes.

- Reduced booking detail label-to-value spacing from 4px to zero, preserving
  spacing between fields. Formatting check passes.

- Displayed the booking reference GUID in a primary-yellow rectangle with black
  text and internal padding. It fits its content and wraps within the container
  on narrow screens. Formatting passes.

- Updated the customer frontend design skill with the booking details page's
  white container, stacked muted labels/black values, yellow reference rectangle,
  dotted divider, compact spacing, start-time-only display and read-only lookup
  behavior. Scoped the white-container exception to this route. Skill validation
  and whitespace checks pass.

- Temporary POST `/v1/bookings` response bypass always returns `payment_url: null`.
  Booking creation, pending status and payment/gateway order creation are unchanged.
  Restore `result.payment_url` in the controller to remove the bypass. Updated
  API documentation and booking/payment workflow assertions.

## Admin booking day grid

- Added read-only `/admin/bookings` with a neutral white spreadsheet grid,
  physical room rows and 120px hourly columns. One native date input supports
  past/future dates, defaults to today in Asia/Kuala_Lumpur, and persists the
  selected date in the URL (missing/invalid dates redirect to today's date).
  Uses existing public API/business configuration defaults and exactly one
  `QUERY /v1/bookings` per selected date, without business/room/reservation calls.
- Reworked the copied `QueryBookings` into `query(businessId, date)`; left
  `QueryBooking` unchanged. Two direct SQL reads return all physical rooms and
  matching booking/reservation data. Ownership follows physical room → current
  category → business; reservation category details retain the requested category.
  Malaysia calendar-day boundaries are bound as UTC with strict overlap, preserving
  full intervals and all stored statuses. Includes unbooked rooms, deterministic
  ordering and empty arrays; no per-booking queries or D1 metadata.
- New public MVP `QUERY /v1/bookings` accepts only nonblank `business_id` and
  valid `YYYY-MM-DD` `date`. Malformed JSON/bodies/dates and range/unknown filters
  return 400. Registered dependency, documented contract and added QueryBookings
  request/assertion to the existing Postman collection. No schema/auth changes.
- Grid displays at least 24 hours, extending to the next whole hour after the
  latest matching reservation end, with subsequent dates labeled. Extension
  does not broaden the query. Previous-day starts clip at midnight with an arrow;
  accessible labels and keyboard/touch popovers retain full reference, room,
  actual MYT start/end and minute duration. Overlaps occupy separate lanes.
  Status text/colors distinguish confirmed, pending, expired pending and cancelled;
  expiry updates locally each second without polling or changing stored status.
  Loading, explicit retry, timeout, no-room/no-booking states and abort/stale
  response protection are included. Sticky room/time headers and keyboard/mobile
  horizontal scrolling keep the grid usable on narrow screens.
- Verification: API types and all 57 tests pass, including real SQLite day-query
  isolation/order/boundary/status/history/shape/validation/CORS cases and layout
  quarter-hour/clipping/adjacent-lane/extension/expiry boundaries. Production web
  build passes. Standard Svelte check has 1418 generated-JavaScript errors and
  five pre-existing warnings; a temporary source check with checkJs disabled
  passes with zero errors and those same five warnings.
- Chrome exercised the real controller/use case against an isolated SQLite-backed
  HTTP API: 30px quarter hours, overlapping lanes, midnight spillover and clipping,
  popover details, no extension-only bookings, live expiry without new requests,
  sticky labels, 390px/1440px rendering and no page overflow, date/reload/default
  URLs, obsolete responses, failure/retry, timeout and empty states. Reviewed
  desktop/mobile screenshots. No live booking/payment data or remote D1 used.
- Saved Postman QueryBookings request passed against the isolated local HTTP API
  (200 and response-array assertion). CLI 1.73.0 has no `status` command; no cloud
  publication/authentication was needed or performed.

- Restyled `/admin/bookings` to match the customer theme at the developer's
  request: black background, white text, Montserrat, dark sticky headers,
  muted category labels, yellow focus/scrollbar accents and dark date controls.
  Reservation blocks retain distinct status tints/borders with white text;
  detail popovers and retry controls now use the same dark palette. Removed
  the visible Malaysia time note and the status legend/instruction paragraph.
  This supersedes the original light-grid presentation. Production web build
  passes; Chrome confirms removed copy, theme colors/font, white block text
  and mobile layout without page overflow.

- Confirmed admin booking blocks now use solid primary yellow (#FFF000) with
  black text and a matching yellow border, superseding their green tint/white text.
- Admin grid now begins at the earliest matching reservation's hour rounded down
  (10:15 starts at 10:00). Previous-day continuations still clip at midnight;
  empty days start at midnight. Blocks use this display origin, retaining 120px
  hours and overlap lanes. At least 24 hours remain visible; next-day labels now
  follow actual midnight rather than column index. The API day filter is unchanged.
- Verification: three layout regression tests and production web build pass.
  Chrome confirms primary-yellow/black confirmed blocks, 10:00 initial header
  for a 10:15 start, 30px offset/90px width to 11:00, next-day midnight label
  and mobile scrolling without page overflow.

- Admin booking grid cards now display only customer name and customer phone on
  two lines, replacing the abbreviated booking reference/status and continuation
  arrow. Full booking/status/time details remain available in the popover and
  accessible label, now including customer contact details. Existing status colors
  and grid geometry remain unchanged; long contact text truncates within blocks.
- `QUERY /v1/bookings` now joins customer records and includes `customer_name`
  and `customer_phone` per booking, retaining one browser query per selected date.
  Updated API documentation, saved Postman contract assertions and SQLite response
  coverage. Verification: API TypeScript checking, all 16 test files and production
  Vite build pass (five existing Svelte warnings). Postman CLI has no `status`
  command. No live writes or browser verification performed.

- Admin grid now presents stored booking statuses directly: pending remains
  pending after its hold expires. Removed the derived expired pending label,
  expired styling and expiry timer from this page. Cards retain customer name
  and phone only; status remains in the details. Backend hold expiry behavior
  and customer booking details are unchanged. Removed obsolete derivation test
  assertions. Admin layout tests, formatting and production web build pass.

- Clarified admin visibility: display pending bookings only while their hold is
  valid; hide the entire booking once current time reaches `expire_at`. This
  supersedes the earlier note about retaining expired pending cards.
- `QueryBookings` now filters expired pending holds in SQL using the current UTC
  timestamp, independent of the selected reservation date. Other statuses, room
  roster and stored booking status remain unchanged. The admin grid also removes
  pending cards locally within one second of expiry while open, with no polling;
  its empty state reflects visible bookings. No Expired label is displayed.
- Updated API docs and saved Postman description. SQLite tests cover live holds,
  exact expiry and elapsed expiry, retained confirmed/cancelled bookings, room
  roster and unchanged stored pending status. Layout tests cover disappearance
  at expiry and empty rooms. API types, all 16 test files and production web build
  pass. Installed Postman CLI still lacks `status`; no live data writes performed.

- Admin bookings date filter now displays English `ccc, dd LLL yyyy` (for
  example, Thu, 12 Nov 2026) over the native date picker, retaining ISO date
  values for navigation and queries. Table hour headers now show only `HH:mm`,
  removing dates at the first column and midnight.
- Removed the admin date control's yellow focus-within outline so clicking the
  date picker retains its muted border.
- Admin bookings now reuses customer `TopNav` above the grid, retaining its
  business name, dark styling/shadow, desktop New Reservation link and mobile
  hamburger menu/overlay dismissal behavior. Business name loads from the
  configured business endpoint with a nonblocking failure fallback. This adds
  a business lookup alongside the existing single booking query per date.
- Removed the visible Bookings heading from the admin bookings page; date
  controls now follow the top navigation directly.
- Superseding URL date persistence: admin bookings initializes today's Malaysia
  date in onMount and keeps date selection in component state. Removed server
  date redirects and query parsing; changing the filter leaves the URL alone.
  The booking query waits for the initial mounted date.

- Customer `/customer/bookings/new` now hides starts earlier than the current
  time, preserving the existing 15-minute intervals: at 14:27 MYT, the first
  possible start is 14:30. Server availability filters past starts and the page
  removes elapsed starts every second while open, reusing selection adjustment
  and empty-state behavior. Future dates retain their full opening hours.
- Availability regression checks cover 14:27, the exact 14:30 boundary, elapsed
  starts, closing time and future dates; all customer availability tests pass.


## Racing quantity booking (12 Nov 2026)

Racing quantity booking: show Select Quantity between Room and Time only for exact acronym RACING. Use duration stepper styling, number 1–4, reset on category changes and retain across dates. Filter times/durations by continuously available machine counts; keep quantity controls visible with no eligible times and disable Confirm. Save optional quantity only for Racing, including 1; preserve older drafts. Contact summary shows category × quantity; POST includes quantity only when present. A 409 shows availability guidance and retains contact details.
Optional quantity must be an integer from 1–4 (omission defaults to 1); non-RACING categories accept only 1 or omission. The server resolves category ownership/acronym. RACING assigns distinct machines continuously free for the full interval, ordered by sort order/name/ID, even for quantity 1. Confirmed and unexpired pending bookings block overlaps; adjacent intervals, cancelled bookings and expired holds do not. Insufficient capacity returns 409 before writes. One booking has N reservation rows and one unchanged upfront payment flow. Other categories retain the temporary assignment bypass. The response still temporarily returns payment_url: null. Concurrency protection and atomicity remain deferred.
Migration 0016 adds ST3 R1–R4 locally; no stored quantity or pricing multiplier.

Verification: 63 API/SQLite/web-utility tests pass; API type checking, web build,
and changed frontend Prettier checks pass. Mobile (390px) and desktop (1440px)
browser checks cover section order, Racing-only visibility, quantity limits,
category reset/date retention, draft summary/submitted quantity and 409 contact
retention. A temporary local reservation verified unavailable-quantity controls
and recovery; the fixture was removed. Local D1 applied pending 0015 and new
0016; R1–R4 and PRAGMA foreign_key_check verified. No remote migrations applied.
The existing full web check reports 1423 generated .svelte-kit JavaScript errors
and five unrelated shared-form warnings; changed source files have no errors.
Installed Postman CLI does not support the skill's `postman status` command;
the saved collection was updated locally without publishing.

- Temporarily bypassed Racing room overlap checks in `AssignRoom`, extending the
  existing non-Racing bypass. Existing reservations no longer prevent booking
  assignment. Quantity validation, distinct machines per booking and physical
  room count checks remain. Restore Racing checks by setting
  `bypassRoomConflicts` to false. Customer slot filtering remains unchanged.

- Moved the temporary payment bypass into `CreateBooking`: `bypassUpfrontPayment`
  skips the configured policy and treats upfront payment as unnecessary. New
  bookings confirm immediately, create no payment/gateway orders and return a
  naturally null payment URL. The controller returns the use case URL unchanged.
  Set `bypassUpfrontPayment` to false to restore normal policy handling. This
  supersedes the controller-only URL bypass; a zero business fee would still
  incur the gateway fee and require payment.

- Contact-info submission now reads the successful booking response and navigates
  directly to `/customer/bookings/{booking_id}` when `payment_url` is null.
  A nonempty payment URL redirects to payment instead. Invalid response fields
  show recovery guidance; existing contact retention and 409 handling remain.

- Removed the global favicon link and unused favicon ICO/SVG assets.

- Added `/admin/payments` with the shared dark TopNav, configured business and
  Malaysia date initialized on mount. Date selection stays in component state.
  Shows every stored payment row with Malaysia date/time, customer contact,
  RM amount to two decimals and stored status. Opaque sticky rightmost Actions
  cells keep same-tab View links to customer booking details visible on scroll.
- Added `QueryPayments` and public MVP `QUERY /v1/payments`, requiring only
  business_id and strict YYYY-MM-DD date. Filters payment creation using Malaysia
  midnight inclusive/next midnight exclusive in UTC; sorts created_at DESC, id
  DESC. EXISTS scopes through reservations, assigned physical rooms and current
  categories without duplicating multi-room payments. Empty matches return [].
  Payment history/statuses remain intact. Updated API docs and local Postman
  collection; no schema or payment-flow changes.
- Verification: API type checking and all 65 tests pass, including SQLite payment
  response shape/history, ordering/ties, business isolation/current room scope,
  multiple reservations, day boundaries, empty results, validation and QUERY CORS.
  Final production web build and changed frontend formatting pass. Chrome checks
  with intercepted payment responses pass at 1440px/390px: sticky Actions and no
  page overflow, Malaysia/RM formatting, date state, empty/error/retry, timeout,
  stale response protection and same-tab View navigation. Reviewed screenshots.
  Five pre-existing shared-form Svelte warnings remain. Postman CLI has no status
  command; collection updated locally, without cloud publishing or live writes.

- Shared TopNav now detects `/admin` routes and displays Bookings
  (`/admin/bookings`), Payments (`/admin/payments`), then New Reservation
  (`/customer/bookings/new`) in both desktop navigation and the mobile menu.
  Customer routes retain their existing New Reservation menu. Production web
  build and formatting pass; Chrome verifies both admin pages at desktop/mobile
  widths, link order/destinations, menu dismissal on navigation, no mobile page
  overflow and the customer menu.

- Replaced admin payments' visible View text/button styling with a 24px
  `mdi:eye` icon in primary yellow and no border. Retained the accessible View
  booking label, keyboard focus outline and same-tab booking link. Changed-file
  formatting, production web build and diff whitespace checks pass.

- Customer booking details now group Racing machines with the same requested
  category ID and exact start/end interval into one reservation summary, showing
  `Racing × 4 · R1, R2, R3, R4` rather than repeating Date/Room/Time/Duration four
  times. Single Racing machines show × 1. Other categories and different intervals
  stay separate; stored/API reservation rows remain unchanged.
- Verification: all 67 tests pass, including grouping, single-machine, different
  category/interval and empty-result regression cases. Changed frontend formatting,
  production web build and diff checks pass. Chrome with an intercepted booking
  response confirms one date/time/duration summary and all four machine names at
  1440px and 390px without page overflow.

- Updated date picker controls on `/admin/payments` and `/admin/bookings` to
  use no border, primary-yellow backgrounds and black text. Preserved formatted
  dates and native date input interaction, using the light color scheme. Added
  the `admin-frontend-design` agent skill to retain this convention.

- Root `/` now redirects to `/customer/bookings/new` with HTTP 307, replacing
  the previous `/info` destination.

- Admin booking room roster now sorts by category sort_order, then physical
  room sort_order, with category name/ID and room name/ID as tie-breakers. This keeps Racing R1–R4 sequential after
  VIP instead of interleaving categories with overlapping room sort orders.


## Customer/admin app split (13 Nov 2026)

- `apps/web` owns customer `/bookings/new`, `/bookings/new/contact-info`,
  `/bookings/[booking_id]` and `/payments/[paymentId]`; root redirects to
  `/bookings/new`. A pathless customer layout preserves the booking theme while
  GM/player/device/info/auth and the light `/payment/demo/[orderId]` stay in web.
- `apps/admin` is now an independent `admin` package/Worker with only `/bookings`
  and `/payments`; root redirects to `/bookings`. Removed the old `/customer/*`
  and `/admin/*` URLs without compatibility redirects. API paths and booking
  draft storage are unchanged. Customer submission/recovery and demo payment
  return/payment lookup links use the promoted routes.
- Added `@booking/ui` Svelte source exports for theme CSS, FontHead, Button and
  TopNav. Both apps scan the shared components with Tailwind. TopNav receives
  explicit links; admin shows Bookings, Payments and New Reservation. Admin's
  New Reservation and payment-row links use `PUBLIC_CUSTOMER_URL`, defaulting
  to http://localhost:5173 in development and required as an HTTP(S) origin in
  production, with clear missing/invalid configuration errors. Links stay in
  the same tab. Existing shared styling and yellow native date controls remain.
- Workspace discovery includes packages/*; Turbo discovers unique web, admin,
  api and @booking/ui packages. Both frontends run together on strict ports
  5173/5174 and preview at 4173/4174. Added root build and frontend types aliases,
  dependency-aware build/types tasks, PUBLIC_* task environment handling and
  SvelteKit output caching. Regenerated admin Worker types and lockfile.
- Both frontend design skills and README guidance now describe app ownership,
  shared design, routes, development commands and customer-origin configuration.
- Verification: both production builds and workspace types pass; admin has zero
  warnings and web retains five existing shared-form warnings. Explicitly included
  shared Svelte source and disabled checkJs: neither app has authored JavaScript,
  and Wrangler's generated Worker declarations import deployment JavaScript that
  previously produced hundreds of unrelated diagnostics.
- Existing suite: 65/68 tests pass, including the moved admin grid utility tests.
  Three existing booking/Racing tests expect upfront-payment bypass, while the
  unchanged HEAD CreateBooking already sets bypassUpfrontPayment=false. No API
  implementation was changed to address that separate mismatch.
- Chrome checks at 390px/1440px cover both roots, shared fonts/buttons/navigation,
  mobile menu/overlay, admin date styling and no page overflow. Old routes return
  404, as do admin copies of demo/GM routes. Isolated mock API checks cover
  selection -> contact -> booking and demo approval -> payment lookup -> booking;
  demo keeps its light theme. Admin payment-row navigation reaches the customer
  app in the same tab, and changing the native date updates state without changing
  the URL. No live booking writes, deployments or migrations.

## Admin local reservation flow (13 Nov 2026)

- Admin now owns `/bookings/new` and `/bookings/new/contact-info`; New Reservation
  stays on the admin origin. Both screens retain Bookings and Payments navigation.
  Payment-row links still use the configured customer origin.
- Copied customer selection/loaders, availability helpers, TimeButton, ErrorModal
  and draft helpers into admin, preserving date/category/time/duration, Racing
  quantity and responsive controls. A local route layout applies the shared theme.
- Confirm saves `admin.booking-draft` and opens local contact-info. Draft validation,
  refresh recovery and Racing quantity summaries match customer behavior.
- Contact starts empty with MY (+60), also offers SG (+65), and enables Submit
  for nonblank name/phone. Submit prevents native submission and otherwise does
  nothing, including Enter: no contact persistence, writes, loading or redirects.
  Actual admin booking creation remains future work. No API/payment changes.
- Admin type checking passes with zero errors/warnings; production build,
  changed source formatting and diff whitespace checks pass.
- Chrome verification at 390px/1440px confirms same-origin navigation, no page
  overflow, missing-draft recovery, refresh summary including Racing × 4, empty
  contact defaults, Submit/Enter retaining values and URL with zero write requests
  and no contact persistence. Confirm saves the selected category/time/duration
  to the admin key and reaches local contact-info; customer draft stays untouched.
  Availability helpers and selection behavior match the copied customer source.

- `CreateBooking.exec` now accepts a final `skipPayment` boolean after quantity,
  defaulting to false. True means no payment is needed regardless of the business
  upfront payment policy: confirm immediately, reserve rooms, create no payment
  or gateway order, and return `payment_url: null`. Removed the local hardcoded
  switch. The controller retains the default for now; future controller wiring
  will derive the flag from actor.role (admin/customer), not request JSON.
- Verification: API type checking and new SQLite-backed payment tests pass for
  true, false and omitted flags with a configured policy and multiple reservations.
  Full suite passes 18/20 test files; booking-schema and racing-quantity retain
  the previously recorded expectations of the old global payment bypass.

- Zero upfront policy price now means no payment needed: `UpfrontPayment.fromRowResult`
  returns null for price 0.00, so CreateBooking confirms immediately with no
  payment/gateway orders or gateway fee. This supersedes the earlier rule that
  a zero business fee still requires the RM1.50 gateway fee. Positive policies
  continue adding that fee unless skipPayment is true.
- Payment regression tests cover zero/positive policy prices with skipPayment
  true, false and omitted. API types and these tests pass; booking-schema retains
  its existing old-bypass expectation failure in the full suite.

- `CreateBooking.exec` quantity now defaults to 1 directly instead of using an
  optional parameter and a separate fallback variable. Omission still reserves
  one room; explicit zero remains invalid under the existing 1–4 rules.

- CreateBooking quantity now defaults to 0 (not applicable to non-Racing).
  Only Racing validates the integer 1–4 range; non-Racing ignores quantity
  and always assigns one room. The HTTP controller preserves its existing
  omitted-quantity default of 1 and transport validation. Direct Racing calls
  must supply quantity. Supersedes the previous use-case default of 1.

- Renamed `RequireRoomCategory.exec` to
  `QueryRoomCategory.query(roomCategoryId: Guid, businessId?: Guid)`, updating
  booking creation, room validation and dependency wiring. Existing business
  scoping and missing-category NotFoundError behavior remain unchanged.

- Renamed `AssignRoom` to `QueryAvailableRooms` with
  `query(roomCategoryId, from, to, quantity)`, returning room IDs. Updated booking
  creation and dependency wiring; removed the unused single-room wrapper and
  Racing flag. The temporary conflict bypass remains enabled. Turning it off
  now applies reservation overlap filtering to every category. Physical room
  count checks and deterministic selection order remain unchanged.

- Design rationale for keeping `QueryAvailableRooms` together: choosing physical
  room IDs requires knowing which rooms are available for the requested interval.
  Selecting IDs first and checking conflicts separately could reject a booking
  when the selected rooms are occupied even though other rooms in the category
  are free. Keep availability filtering within room selection, then return the
  requested number of available IDs. A separate `EnsureRoomsAvailable` use case
  makes sense when the caller already specifies particular physical room IDs.
  This explains the combined responsibility if splitting it is reconsidered later;
  the current temporary conflict bypass is a separate MVP decision.

- Admin contact-info Submit now creates the customer with POST /v1/customers,
  then creates the booking with POST /v1/bookings and redirects to local
  /bookings/:booking_id. Added admin booking details with admin navigation and
  grouped Racing summaries. Contact fields still start empty and stay in page
  state; submission disables controls, blocks duplicate clicks and shows errors.
- Booking controller temporarily always passes skipPayment=true for every caller,
  including customer web, confirming bookings without payment/gateway records
  regardless of policy. The use-case default remains false. This supersedes the
  earlier placeholder submission and controller-default notes.
- Verification: admin check reports zero errors/warnings; API types and all 74
  API tests pass, including confirmed bookings with a positive payment policy
  and no payment/gateway records. No live booking writes.

- Renamed the admin booking calendar route from /bookings to /calendar.
  Admin navigation now labels it Calendar, the page title is Admin calendar,
  and the admin root redirects to /calendar. Reservation creation and detail
  routes remain under /bookings. Updated workspace route documentation.

## Admin daily bookings list (13 Nov 2026)

- Added `/bookings` as a read-only daily table, keeping `/calendar` and the root
  redirect unchanged. Navigation is Calendar, Bookings, Payments, New Reservation.
  Reuses one `QUERY /v1/bookings` per selected date or retry; no per-row requests.
- Defaults to today's Malaysia date on mount; the yellow native date filter stays
  in page state. Rows show customer, phone, grouped reservation summaries, stored
  status and yellow eye links to local `/bookings/[booking_id]` details. Sorts by
  earliest returned reservation start then booking ID. Shared Racing grouping
  preserves distinct intervals and includes all machine names; full Malaysia
  start/end dates and times retain cross-midnight intervals and minute durations.
- Pending bookings disappear locally at expiry without polling; confirmed and
  cancelled rows remain. Includes loading, empty, retry, eight-second timeout and
  stale-response protection, keyboard-scrollable table and sticky headers/actions.
- Verification: admin type checking has zero errors/warnings; production build,
  changed source formatting and whitespace checks pass. Mocked Chrome checks at
  1440px/390px cover layout without page overflow, grouping/different intervals,
  cross-midnight times, cancelled/pending expiry, scrolling/local details links,
  date state, empty/error/retry/timeout, rapid date changes and exact query counts.
  No API changes, live booking writes, deployments or migrations.

- Admin daily booking reservation summaries now show only the Malaysia start
  date/time and duration in minutes, omitting the end date/time. Stored intervals
  and Racing grouping remain unchanged.
- Admin daily booking durations now use hours and remaining minutes (60 becomes
  1 hour; 90 becomes 1 hour 30 minutes), keeping sub-hour durations in minutes.
- Admin daily bookings now render reservation starts in the browser local timezone
  without a MYT suffix. The daily query/date filter retains Malaysia day semantics.
  Customer name and phone share the Customer column on the first and second lines.
- Admin booking reservation cells use four lines in order: local start date,
  room category/quantity and machine names, local start time, then duration.
- Admin payments now combines customer name (first line) and phone (second
  line) in one Customer column, matching the bookings list.
- Removed the date line from admin booking reservation cells; the date picker
  provides the selected day. Summaries now show room, local start time and duration.

## Stored booking business ownership (13 Nov 2026)

- Migration 0017 adds required, indexed booking.business_id referencing business.
  Backfill uses assigned physical rooms and their current categories and requires
  exactly one distinct business per booking; missing/conflicting owners abort.
  Rebuilds booking/reservation/payment/demo order tables with foreign keys enabled,
  preserving fields, defaults, IDs, relationships and indexes in D1's transaction.
- CreateBooking persists its validated businessId. Payment history and daily
  booking reservations now use stored booking ownership, retaining history after
  room reassignment. Payment history includes bookings without reservations and
  never duplicates multi-reservation payments. Room rosters and availability still
  follow current physical categories. HTTP fields/payment/assignment behavior and
  public MVP access remain unchanged; concurrency work remains deferred.
- Applied locally only after SQLite backup at
  /tmp/booking-before-0017-20261113-112008.sqlite and guarded deletion of pending
  orphan 01a19f9b-0813-726f-8f02-cb7f36f3a432 (no reservations or payments).
  Verified all remaining bookings resolved to exactly one business before applying.
  Afterwards: 25 bookings, 34 reservations, 20 payments, 15 demo orders; all original
  fields and dependent records match backup apart from the approved deletion.
  Migration history, required foreign key, indexes and empty foreign_key_check verified.
- Verification: API type checking and all 78 tests pass, including populated
  migration success/rollback, single/multiple reservations, missing/conflicting
  ownership, creation persistence, reassignment scope, payment without reservations,
  overlap boundaries, expiry, ordering and unchanged response shapes.
  Local API started with updated creation code. No remote migration or deployment.

- Admin payments now displays the full booking ID in a column immediately before
  Date / time, using the existing payment response's booking_id.
- Admin bookings now also displays the full booking ID immediately before the
  Customer column, using the existing booking response's id.

- Removed the Booking ID columns from admin bookings and payments at the
  developer’s request, superseding the two column additions above.

## Edit booking reservations (13 Nov 2026)

- Added public PUT /v1/bookings/:booking_id with a complete, nonempty reservations
  list of explicit room_id/from/duration entries. Returns the existing GET shape
  with new reservation IDs, UTC timestamps and derived current room categories.
- Uses stored booking.business_id to reject missing/foreign rooms with 404.
  All statuses remain editable; booking fields, expiry and payments are preserved.
  No creation/payment/status flow runs. Offset-free starts mean Malaysia time.
- Rejects malformed/unsupported input, invalid intervals and overlapping entries
  for the same room with 400 before writes. Adjacent intervals are allowed;
  conflicts with other bookings retain the public MVP bypass. No quantity applies.
- Replacement uses one transactional D1 batch, an explicit atomicity requirement
  for this endpoint despite broader MVP concurrency/atomicity deferrals.
- Updated API README and local Postman request. API types and all 81 tests pass,
  including SQLite-backed replacement, status/expiry/payment preservation,
  ownership, validation, GET/day readback and injected insert failure rollback.
  No live writes, migrations or deployment. Installed Postman CLI does not support
  `postman status`; local collection JSON and request scripts were validated locally.

## Admin reservation editor (13 Nov 2026)

- Added `/bookings/edit/:booking_id`, linked from admin booking details. Each raw
  reservation gets a separate fixed-count card, including each Racing machine.
  Controls are date/category/physical room/time/duration with shared admin UI.
- Configured business roster/hours and per-Malaysia-date overlap queries drive
  explicit physical-room availability. Shared date requests exclude the edited
  booking; confirmed and live pending rows block changed intervals. Same-room
  draft overlaps are rejected; adjacent intervals remain valid.
- Original intervals retain exact timestamps and minute durations, including
  past/nonstandard choices and external conflicts. Restoration is explicit;
  unavailable roster rooms require replacements. Changed intervals use seven
  Malaysia dates, quarter-hour starts and whole hours ending by closing.
- Save rechecks availability and PUTs the complete raw list, blocks duplicate
  submission, retains edits on failure and navigates to refreshed local details.
  All statuses can be edited; no status/payment changes or persistent drafts.
  Empty bookings cannot add reservations. Requests have eight-second timeouts,
  per-date cache isolation and unmount cancellation. API conflict bypass and
  concurrency limitations remain unchanged.
- Verification: admin Svelte checking has zero errors/warnings, Worker types are
  current, production build and whitespace checks pass. All 23 API test files
  pass, including new editor interval/payload/availability tests. Mocked Chrome
  at 390px/1440px confirms independent Racing cards, no horizontal overflow,
  disabled unchanged Save, one shared date read, fresh pre-save read, one full
  replacement PUT and return to details. No live booking writes or deployment.

- Simplified admin reservation editing: removed visible reservation legends,
  original-value summaries, their separator lines and the restore-original button.
  Reservation groups retain accessible names. Confirm now uses the new-booking
  fixed action-bar placement: desktop right alignment with Cancel to its left;
  mobile Confirm above Cancel. Cancel is bold and borderless. Original options
  and unchanged-interval handling remain available through the existing controls.

- Racing room controls in the admin reservation editor now support multiple
  explicitly selected machines per editor. Each machine uses that editor's date,
  time and duration and expands to one raw row in the full replacement PUT.
  This supersedes the fixed physical reservation count for Racing; existing
  editors remain separate and non-Racing categories still select one room.
  Common time/duration choices require all selected machines to be free, while
  original-interval exceptions apply only to the original physical reservation.
  Empty selections disable Confirm; overlaps across editors remain rejected.
- Verification: editor helper tests and admin type checking pass with zero
  diagnostics; production build and whitespace checks pass. Mocked Chrome at
  390px/1440px confirms multiple pressed Racing room buttons without overflow.
  Selecting R1+R3 in one editor saves both physical rows and preserves the
  separate untouched R2/90-minute row, with a fresh availability check and
  navigation to details. No live booking writes.

- Selecting a category in the admin reservation editor now auto-selects the
  first configured physical room with an available standard interval and that
  room's earliest start time. Other draft reservations also block this default
  selection. Retain the duration if supported, otherwise default to one hour.
  Racing starts with one selected machine and still supports manual multi-select.
  This supersedes the earlier no-auto-selection rule for category selection;
  manual room/date/time changes retain their existing behavior. No availability
  leaves room/time empty with feedback. Per-row selection versions prevent late
  availability responses from overwriting newer selections.
- Verification: editor helper tests, admin type checking (zero diagnostics),
  production build and whitespace checks pass. Mocked mobile/desktop browser
  checks confirm category selection defaults to R1/10:00/60 minutes, subsequent
  Racing multi-selection still works, and Confirm submits the full physical-room
  list and returns to details. No live writes.

- Matched admin reservation editor labels to customer apps/web: unselected date
  button months use primary yellow and selected months use black. Duration
  values use primary yellow, bold centered text and the same minimum width as
  the customer duration control. Selection behavior and stored values are unchanged.
- Removed the generic per-reservation “Choose a configured room and an available
  standard interval.” message from the admin editor. Validation and Confirm
  eligibility remain unchanged.

- Admin reservation editing now opens exactly one blank selection, defaulting
  only the Malaysia date to today. It no longer fetches the booking or reads its
  reservation rows, status or original options. This supersedes prefilled cards,
  historical-value preservation and the empty-booking restriction in this UI.
- Category selection still defaults room/time; Racing still permits multiple
  machines. Confirm PUTs only the newly selected physical rows as the complete
  replacement list without another confirmation prompt. Availability continues
  excluding this booking, and each new interval must meet standard availability
  rules. Cancel, retry/draft retention and refreshed details navigation remain.
- Verification: admin type checking has zero errors/warnings; production build,
  whitespace checks and all 23 API test files pass. Mocked Chrome at 390px/1440px
  confirms one blank selection, zero booking GET requests, disabled initial
  Confirm, no overflow, category defaults, Racing multi-select and a PUT containing
  only the new selected machines followed by details navigation. No live writes.

- The fresh admin reservation editor now automatically selects the first
  category in configured order with an available standard interval, followed by
  its first free room, earliest time and one-hour duration. Empty/full categories
  are skipped. This supersedes leaving category/room/time/duration blank on load;
  existing booking reservations are still not fetched. Defaults also work after
  availability/configuration retry and do not replace a manually chosen category.
- Verification: editor helper tests, admin type checking (zero diagnostics),
  production build and whitespace checks pass. Mocked Chrome at 390px/1440px
  confirms Family/FR1/earliest available time/60 minutes selected automatically,
  no booking GET, and working Racing multi-select and replacement saving.
- Admin reservation editor duration values now display hours (1 hour, 2 hours)
  matching apps/web. API payloads and availability calculations retain minutes.

- Admin bookings reservation time lines and payments Date / time values now use
  12-hour times with uppercase AM/PM and no space, such as 10:00AM and 4:00PM.
  Existing dates and timezone handling are preserved.
- Recorded both pages' time formatting in the admin frontend design skill.
- The admin bookings table displays the stored start and end on the reservation
  time line, for example `10:45AM-11:45AM`, with duration on the following line.
- Removed the Bookings date control's focus outline so it stays borderless
  when clicked, matching Calendar and Payments.


## Admin PWA and VAPID PRDs (13 Nov 2026)

- Added proposed sequential PRDs 0002–0006: admin installation; network-only
  worker lifecycle; VAPID/subscription backend; notification controls, minimal
  session bridge and push handlers; then test delivery and rollout verification.
- PWA applies only to apps/admin on its own origin. Customer apps/web remains
  unchanged. Offline operational caching and mutation replay are outside scope.
- Existing API auth primitives are available, but admin has no session UI. New
  push features require authenticated ownership and explicit server-side business
  authorization; current shared admin identity does not identify individual staff.
- Automatic booking/payment notifications and durable queues remain future work.
  Documentation only: no runtime implementation, secrets, migration or deployment.

## Admin PWA installation — 0002 (13 Nov 2026)

- Implemented admin-only installation metadata: name/short name BUK BUK,
  description Booking App, English, stable ID/scope /, standalone /calendar
  launch, #FFF000 theme and #000000 background. This supersedes PRD 0002's
  proposed Booking Admin/Admin identity. Existing page titles/navigation remain.
- Added local supplied 192px/512px branding PNGs, a separate 512px maskable
  variant with 384px source and 64px yellow padding, and a 180px Apple touch icon.
  Head links use SvelteKit asset placeholders. Admin README documents HTTPS,
  localhost, browser installation and iOS Add to Home Screen.
- Admin check has zero errors/warnings and production build passes. Chrome
  DevTools parses the expected manifest metadata with no manifest/installability
  errors. All five public resources return 200 with correct content types;
  PNG dimensions and maskable dark-branding safe-circle bounds verified.
- Actual installation/standalone launch remains manual: this headless Chrome
  lacks PWA.install/PWA.launch commands, and no iOS device was available.
  Chrome reports no worker prerequisite and zero registered workers. Versions
  requiring a worker await 0003. Actual distinct admin/customer HTTPS production
  origins must be verified and recorded before root-scoped worker registration.
- No customer source changes, service worker, API/database changes, permissions,
  offline behavior or deployment. Existing diary and proposed later PRDs retained.

- At the developer’s request, the admin manifest now references the supplied
  CDN icon-192.png and icon-512.png URLs directly. Removed duplicate local
  originals; derived maskable and Apple touch icons remain local. This
  supersedes the local-original-icon decision above.
- CDN switch verification: both URLs return 200 image/png with expected
  192×192/512×512 dimensions; manifest references and duplicate removal checked.
  Admin production build and whitespace checks pass.

- Removed the optional admin maskable 512px icon and its manifest entry at the
  developer’s request. No replacement branding is needed; the manifest retains
  the two CDN icons with purpose any. The local Apple touch icon remains.
  This supersedes the earlier maskable-icon requirement in 0002.

- Removed the local Apple touch icon and its document-head link at the
  developer’s request. The maskable icon was already removed. Admin now uses
  only the two CDN manifest icons; no local icon assets remain. This supersedes
  the earlier decision to retain the Apple touch icon. Manifest/head references
  and whitespace checks pass.

## Admin service worker lifecycle — 0003 (13 Nov 2026)

- Added one admin-only SvelteKit worker entry with build-version installation
  diagnostics. Disabled automatic registration in Vite; root layout registers
  once on mount in production secure supported browsers only when the existing
  validated customer origin differs. Registration errors warn without blocking UI.
- Network-only: no fetch/cache/offline/replay/push behavior, skipWaiting, claim,
  reload or update prompt. Browser-managed waiting preserves unsaved drafts.
- README documents preview on 4174 with separate customer preview on 4173,
  lifecycle, targeted scope/script unregister, and rollback retaining an inert
  worker URL. Customer source, dependencies, APIs and database unchanged.
- Local checks: current Wrangler types, zero Svelte errors/warnings and two
  production builds passed. Used installed binaries because pnpm's engine-store
  lock was read-only. Chrome verified one root registration, JavaScript MIME,
  initial page unclaimed, zero customer-preview/development registrations,
  offline failures and unchanged Cache Storage including an unrelated sentinel.
  A replacement waited while the unsaved contact form and page-memory marker
  survived, then activated after the controlled page left and reopened.
- Mocked booking/payment POSTs reached the browser network layer; offline
  failures produced zero replay requests after reconnecting. Simulated rejected
  registration warned while navigation remained available. Changed admin source
  and README formatting checks and whitespace checks passed.
- Missing service-worker support and insecure-context simulations also retained
  normal navigation without registration.
- Developer manually verified 0003 on localhost:4174: active admin worker,
  controller script URL http://localhost:4174/service-worker.js, and calendar
  displayed as a controlled client. DevTools Clients intermittently appeared
  empty after reload while the controller check confirmed control. Updated PRD
  0003 to record implementation/local verification and pending production and
  installed-app device checks. Admin only; customer source remains unchanged.
- Intended admin/customer production hosts are respectively
  https://bukbuk-admin.astra-cloud-solutions.workers.dev and
  https://bukbuk-customer.astra-cloud-solutions.workers.dev. Both returned 404
  during planning; app identity and isolation on these hosts remain rollout
  checks. Installed-window/device verification remains manual. No deployment
  or live booking/payment writes.

## Public web push registration — 0004 (13 Nov 2026)

- Revised 0004 to public POST /web-push only, superseding the original admin
  ownership/key-lookup/removal proposal. No business/principal columns, frontend,
  authentication or delivery. Ownership, business authorization and scoped removal
  remain requirements before expanding staff notifications.
- Migration 0018 stores unique exact endpoints, encryption keys, SHA-256 VAPID
  public-key identifiers and UTC timestamps. Upsert preserves ID/creation time;
  separate endpoints support multiple devices. Strict bounded input validates
  HTTPS URLs and P-256/base64url subscription keys without echoing secret values.
- Manually supply stable per-environment VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and
  VAPID_SUBJECT. Existing ignored local settings are preserved; missing settings
  receive REPLACE_ME placeholders only. No credentials were generated for setup.
  Client public key must manually match backend; subscriptions cannot prove that
  match. Rotation requires re-subscription. Configuration validates on registration
  only, including signing/verifying to check the pair; errors are sanitized before
  central logging, including database failures that could contain subscriptions.
- Updated README, local Postman request and ticket. API type checks and all 24
  test files pass, including new SQLite persistence/validation/configuration and
  secret-safe failure tests. Local Wrangler D1 migration 0018 applied successfully.
  pnpm store-lock restriction required installed compiler/Node tsx loader; local
  Wrangler runtime required sandbox escalation for its listening socket.
  No remote migration, deployment or live push-provider requests.
- Final focused registration tests and type checks pass after review; whitespace
  checks pass. The installed Postman CLI reports `unknown command 'status'`;
  the local collection was parsed/updated but not executed against a live API.

- Renamed the public registration endpoint to POST /register-web-push at the
  developer’s request; supersedes /web-push above. Updated route, tests, README,
  Postman request and ticket.

## Admin notification controls and worker handlers — 0005 (13 Nov 2026)

- Implemented the agreed reduced scope: Notifications in shared admin navigation
  and `/settings/notifications`, using public POST `/register-web-push`. No login,
  ownership, D1 deletion, sender or automatic booking/payment notifications.
  This supersedes 0005's original session bridge and backend removal proposal.
- Manually configure `PUBLIC_VAPID_PUBLIC_KEY` to match the API public key and
  existing `PUBLIC_API_URL`. Validate P-256 key/configuration and active worker
  readiness before enabling. Readiness waits are bounded; old or waiting workers
  show save-drafts/close-all-admin-windows/reopen guidance without forcing updates.
- Page load never prompts or creates a subscription. Existing matching browser
  subscriptions are re-registered; persistence requires success with an ID.
  Retry reuses the subscription. Explicit key replacement leaves the old D1
  record. Turn off unsubscribes and verifies absence, retaining browser permission,
  D1 records and already displayed notifications; failures remain visible.
- Worker retains network-only/browser-managed lifecycle and adds a version-1
  readiness handshake, waitUntil/showNotification with fixed generic BUK BUK test
  text, and safe click navigation/focus/open behavior. Payload contract is
  `{ "version": 1, "type": "test", "url": "/calendar" }`; empty, malformed,
  unsupported or over-2048-byte payloads use calendar. Only literal `/calendar`,
  `/bookings` and `/payments` destinations are accepted, including on click.
  No subscription values are logged or written to application storage.
- Revised 0005 and documented configuration, browser/Home Screen recovery,
  worker updates and browser-only unsubscribe in the admin README. Added 0006
  prerequisites: authentication, explicit business authorization, ownership and
  ownership-scoped removal before delivery controls.
- Verification: five focused Node tests pass for payload/click validation,
  persistence shape and response ID, key matching, readiness timeout/update and
  actual worker handlers with existing/new/failed-window behavior. Admin
  type checking has zero errors/warnings, Wrangler types are current, production
  build and changed-file formatting/whitespace checks pass using installed tools.
- Headless Chrome production-preview checks at 390px/1440px passed: no initial
  prompt, Enable, failed persistence/Retry reusing one subscription, permission
  dismissal/denial, explicit key replacement, unsubscribe failure/success and no
  automatic subscription after revisiting off settings. Checked keyboard focus,
  live status semantics, no horizontal overflow, old-worker recovery, missing
  push capability and iPhone Home Screen guidance. Real active worker readiness
  passed; synthetic PushEvents in the production worker displayed fixed generic
  notifications with valid and malformed-payload destinations.
- Real Android/iPhone/iPad/installed desktop permission, installation, system
  announcements and end-to-end delivery remain manual. Synthetic/mocked push
  checks do not establish provider or real-device delivery. No deployment,
  remote migration, live API writes or push-provider sends. Customer source is
  unchanged and contains no permission/subscription requests.

- Removed the VAPID_SUBJECT requirement from registration at the developer’s
  request, superseding the earlier contact-setting requirement. Removed its
  local placeholder and Env field. Registration still validates the VAPID key
  pair; SQLite regression tests now run without a contact subject. Contact and
  any provider-specific delivery requirements belong to 0006. No sender or
  deployment added.
- Verification for contact removal: API TypeScript check, three focused web-push
  tests, all 24 API test files and whitespace checks pass. Installed Postman CLI
  still does not support `status`; no live API or push delivery was tested.

- Reverified 0005 and updated its PRD with completed scope and pending checks.
  Existing local VAPID keys form a valid P-256 pair and the admin public key
  matches the API; no values exposed or replaced. Admin API URL is localhost:8787;
  production preview still needs a distinct PUBLIC_CUSTOMER_URL supplied.
  Five notification tests, direct Svelte check (zero errors/warnings) and direct
  Vite production build pass. Standard build currently fails stale Wrangler
  generated types; pnpm check also encountered its read-only engine-store lock.
  Earlier browser evidence is distinguished from checks rerun today. Current
  preview/API/D1 integration, installed devices and provider delivery remain
  unverified in this pass. No deployment or live writes.

## Public demo push delivery — 0006 (14 Nov 2026)

- Implemented the approved public demo scope, superseding 0006's authentication,
  ownership and per-owner throttle prerequisites. Registration stays public;
  no owners assigned to legacy rows, account work or automatic booking/payment sends.
- Added public POST /v1/web-push-subscriptions/:id/test accepting exactly {}.
  D1 supplies all destinations/keys; no caller content or destination accepted.
  Pinned @block65/webcrypto-web-push 2.0.0 supplies RFC 8291 aes128gcm and modern
  VAPID. Payload remains exactly version 1/test/calendar, bounded to 2048 bytes,
  with TTL 60, eight-second timeout and redirect rejection.
- Registration and sending allow only HTTPS/default-port FCM and Mozilla exact
  hosts and hosts beneath .push.apple.com, without credentials/fragments.
  Unsupported legacy rows remain stored but unsendable. Sending requires valid
  VAPID_SUBJECT plus matching keys; registration still needs no subject.
  WEB_PUSH_SEND_ENABLED defaults false; no local secrets replaced or exposed.
- Migration 0019 adds nullable last_test_attempt_at. Conditional UPDATE RETURNING
  atomically reserves one test attempt per subscription per 60 seconds. Local D1
  migration succeeded; remote migration/deployment remain pending. Provider 404/410
  deletes expired records; other failures retain them. Sanitized 202/404/409/410/
  429/502/503/504 outcomes, Retry-After on throttle, and no automatic retry.
- Admin retains successful registration ID in page memory, recovers it on reload
  by re-registering without prompting, and enables Send only after persistence.
  Actions disable while busy; cooldown, recoverable errors and explicit expired/
  old-key re-subscription are visible. Browser-only Turn off and existing worker
  readiness/display/calendar-click behavior remain unchanged.
- API regressions passed including SQLite atomic cooldown and independent IDs,
  strict input/allowlist, payload decryption, VAPID signature/audience, redirects,
  timeout, expiry cleanup and failure retention. Notification tests passed;
  API type check passed. Admin check reports zero errors/warnings and production
  build passed; regenerated stale Wrangler admin types. Actual installed package
  passed a local workerd smoke with controlled transport and ephemeral fixture
  keys. No real provider contacted. Reusable isolated smoke fixture is included.
- Headless production-preview checks at 390px/1440px passed for no initial prompt,
  Enable, reload registration recovery without another prompt, accepted wording,
  busy-state Send disabling, temporary failure, 429 cooldown and explicit expired
  subscription replacement. No horizontal overflow; desktop screenshot inspected.
  Used mocked browser subscriptions/worker readiness and API responses. Preview
  required explicit distinct PUBLIC_CUSTOMER_URL=http://localhost:4173.
- Updated 0006, API/admin READMEs and local Postman collection with request ID
  chaining, configuration, migration order, key rotation and rollback. Disable
  sending first and preserve worker URL; browser unsubscribe leaves D1 rows.
  Android, iPhone/iPad Home Screen and installed-desktop provider delivery, device
  display and calendar click remain pending. No production deployment/live writes.

## Admin authentication and user management — 0007 (19 Nov 2026)

- Added migration 0020 with immutable user IDs, unique normalized usernames,
  salted scrypt hashes and role and ban constraints. The seed preserves an
  existing `sam` account. Change the initial password before public exposure.
- Staff login uses independent `JWT_SECRET` and `JWT_REFRESH_SECRET` settings
  for access and refresh JWTs. Access expires within 15 minutes. Refresh keeps
  the original role and seven-day deadline. Bans block new login, while issued
  tokens survive bans, password changes and local logout through their deadlines.
- Both staff roles can read users and create managers. Managers can edit their
  own credentials and other managers. Manager ban or unban requests can target
  other managers. Developer provisioning is through D1.
- Applied access middleware to staff methods on the mixed booking, payment,
  customer and configuration routes. Customer booking and payment operations
  and the public demo push API retain public access. Confirmed CORS preflight
  for QUERY, Authorization and Content-Type.
- Added the admin browser guard, login, user pages and logout. The shared API
  client stores the token pair in one localStorage write, coordinates refresh
  in the current tab, and retries the original request once after a 401.
- Updated both READMEs and validated the 39 requests in the existing Postman
  collection for JSON and script syntax. API TypeScript and all 27 API test
  files passed. Local Wrangler applied the full migration chain with disposable
  ST3 fixture data. The seeded scrypt login took 672 ms round trip in one
  workerd check. D1 verified role and ban enforcement, conflicts, updates,
  refresh and public booking and payment reads. This was a local runtime check.
- Chrome against local Wrangler/D1 passed direct signed-out navigation, blocked
  storage messaging, seeded sign-in, reload, form validation, duplicate username,
  user creation and editing controls, banning another manager, and mobile logout.
  With controlled browser responses, Chrome verified concurrent and late 401s,
  one retry after saving the pair, refresh failure and second-401 redirects,
  on-page 403 handling, and stale refresh responses after logout or a new login.
- Admin Wrangler types, Svelte check with zero errors and warnings, production
  build, notification tests and whitespace checks passed. Browser verification
  used the Vite dev server. Production deployment and remote migrations remain
  outside this implementation.
- On `/login`, username and password inputs use a white border at rest and a
  primary-yellow border on focus. Both labels use the shared muted text color.

- Scoped the admin `GET /v1/auth/me` request to `/users` and its subroutes,
  where the UI uses the principal. The shared browser guard checks for a stored
  token pair. Protected API requests verify the access token and handle refresh.

- Shared the admin text-entry styling across sign-in and user management.
  Labels use the muted theme color, entered values use white, and the white
  field border turns primary yellow on focus without an extra outline.

## Authenticated admin web push

- Registration, test sends and device removal require an admin access token.
  The verified subject supplies `user_id`. The server-generated subscription UUID
  identifies the D1 record for test sends. The browser's push endpoint identifies
  its current subscription for removal, including after a page reload.
- Migration 0021 adds ownership. Existing unowned demo rows are ineligible for
  authenticated test sends. Endpoints are unique and re-enrollment on the same
  account preserves the UUID. An endpoint associated with another account or
  with a legacy demo row requires explicit browser subscription replacement.
- Turn off deletes only the signed-in user's subscription for this endpoint,
  then unsubscribes the browser. The ban update deletes all subscriptions for
  the affected user in the same D1 statement via a trigger. Registration checks
  active account status inside its write so an issued token cannot re-enroll
  during a ban. Unbanning allows fresh registration.
- API types and 107 tests passed. The focused push tests cover owner isolation,
  DELETE preflight, targeted removal and ban cleanup. An isolated local D1
  database accepted migrations 0018–0021. Admin notification tests, Svelte
  check and production build passed. Real-device delivery remains pending.

## Admin booking links and service worker origin

- Payment rows now open the existing admin booking details on the same origin.
  Admin no longer reads or validates `PUBLIC_CUSTOMER_URL`.
- The admin layout registers its worker in production secure contexts with
  browser support. The registration is scoped to the admin origin. The customer
  app does not register a worker.

## Admin web push sender configuration

- Removed the test-send flag and the VAPID contact setting. Staff can send
  tests with a registered device and matching VAPID keys. The API signs an
  RFC 8292 token with audience and expiry, and the existing library encrypts
  the notification payload.

- Added a secret-protected developer broadcast at POST
  /v1/web-push-subscriptions/test. It sends to active developers' registered
  devices through SendTestWebPush.exec and returns aggregate delivery outcomes.
  Renamed the existing local API_SECRET setting to DEVELOPER_SECRET.

- Moved the registration route to POST /v1/register-web-push. Updated the
  admin client, local Postman request, and API contract examples.

- Consolidated registration and owner-scoped hard deletion under
  /v1/web-push-subscriptions. DELETE takes the row ID returned by registration.
  POST /v1/web-push-subscriptions/test uses the developer secret and broadcasts
  to developers' registered devices. Removed the per-device test route and
  admin send button.

- The developer broadcast reads the API's DEVELOPER_SECRET value from the
  developer_secret request header.

- Removed the developer web push test cooldown in all environments. Repeated
  broadcasts attempt delivery each time and return matched, accepted, and failed
  counts. Migration 0022 removes the unused last-attempt timestamp.

- Failed developer web push sends now log the subscription ID, safe failure
  reason, and provider HTTP status when available.

- Web push transport failures now log the provider hostname and redacted
  exception details before the broadcast records the failed send.

- Fixed the default web push transport to call fetch with the global receiver
  required by Workers. The previous call failed before reaching the provider.

- Developer test broadcasts now use SendWebPushNotification.exec with a flat
  subscription_id, title, body and url input. The admin worker renders the
  supplied text and still accepts the original test format.

- SendBookingConfirmedNotification sends to active developer and manager
  devices on auto-confirmed creation and payment confirmation. The MVP rule
  also applies to admin-created bookings. Replayed confirmations of an
  already-confirmed booking skip the push. Clicking opens admin booking details.

- The developer confirmed local booking push delivery through the admin preview
  and requested closure of PRDs 0001–0007.

- Admin booking details display the original creation timestamp in Malaysia time
  under “Created at” and load the customer's name and phone through the staff customer endpoint.
  Booking and reservation details remain visible if the customer lookup fails.

- Customer and admin booking details pair Date with Room and Time with Duration
  below 640px. Admin also pairs Status with Created at and Customer name with
  Customer phone. Both apps display the stored reservation start and end in
  Malaysia time.

- Migration 0023 sets the ST3 Wonderland Racing category acronym to `Racing`.
  Booking logic compares the acronym case-insensitively so both spellings
  support quantity selection, machine assignment, and reservation grouping.
  Booking category labels still read from the separate name column.

# 20 Nov 2026

- Added an env.production block to each existing Wrangler config for the
  customer, admin and API Workers using bukbuk-web, bukbuk-hello88 and bukbuk-api under
  astra-cloud-solutions.com. These supersede the earlier workers.dev production
  hostnames. Production disables workers.dev and preview URLs.
- The API binds DB to the planned bukbuk D1 database. Replace the ID placeholder
  after creating it. The production API config omits the unused KV binding.
  Frontend API URLs are Wrangler vars. Both frontends use their existing ST3
  business ID default. Production credentials use Wrangler secrets. No remote
  changes performed.
- Added a commit-safe API .dev.vars.example with changeit placeholders for all
  local variables. Copy it to .dev.vars for local setup.
- Added the supplied 32×32 PNG as the browser-tab favicon in both frontends.
- Gave the admin browser-tab favicon a root-relative, versioned URL for preview.
- Set the production API `DB` binding to the newly created `bukbuk` D1 database
  and restored the default `booking` binding for local development.
- Removed the unused API KV binding from the Wrangler config and regenerated
  the Worker types.
- Made migration 0015 bootstrap ST3 Wonderland and its upfront payment policy
  on an empty D1 database while preserving existing business settings.
  All 23 migrations passed on fresh SQLite with foreign keys enabled. The
  production `bukbuk` D1 retry applied migrations 0015–0023 successfully.
- Configured the admin production `PUBLIC_VAPID_PUBLIC_KEY` to match the public
  key uploaded to the production API Worker. Admin deployment is pending.
- Added migration 0024 to backfill the original Family, Open and VIP categories
  and their eight rooms in fresh production databases. It uses the existing
  local IDs and sort orders and preserves existing rows on ID conflicts.
  The calendar roster query returned the same 12 rooms in the same order on
  fresh SQLite and existing local D1. Applying 0024 to a copy of local D1
  wrote zero rows. Rental fees were outside the requested backfill.

# 23 Nov 2026

- Admin `/bookings` uses a shared Bits UI date range picker. Both dates default
  to today in Malaysia and stay in page state. A first selection stays in the
  picker until the second valid selection. Closing the picker discards the draft.
  A changed range triggers one staff query. The filter is labeled Date, and
  each reservation starts with a separate local date line above the room
  details. Overnight reservations show both local dates on that line.
- Staff `QUERY /v1/bookings` accepts inclusive Malaysia `from` and `to` dates.
  The end must precede the start's one-year anniversary. For a leap-day start,
  27 February of the following year is the last allowed end. The overlap query
  preserves full reservation intervals and pending-hold expiry. Admin `/calendar`
  continues to send a legacy `date`. Updated the API README and Postman examples.
- API type checking, all 112 API tests, admin Svelte check and production build
  passed. Shared SQLite test setup omits the site-specific room backfill because
  its ST3 business seed is also omitted. Chrome at 320px verified same-day,
  cross-month and reverse selection, dismissal, keyboard focus, the year limit,
  and reservation date labels against local D1 through the API.
- Admin `/payments` uses the same Date range picker as `/bookings`, defaulting
  both dates to today in Malaysia. Staff payment queries filter creation times
  across the inclusive range, preserving the legacy single-date filter and
  newest-first payment history.
- Admin Notifications uses the same 24px heading as Users, with 15px status
  text and 14px supporting copy. The page overrides the customer typography
  rules that previously took precedence over its text-size utilities.
- Admin `/calendar` uses a reusable Bits UI single-date picker. Selecting a
  date closes the popup. The page still defaults to today in Malaysia and
  queries bookings for the selected day.
- Admin `/bookings/new` uses a full-width navbar and the same page gutters as
  the bookings list. The fixed Confirm button aligns with the form's right
  edge on desktop and stays centered on mobile.
