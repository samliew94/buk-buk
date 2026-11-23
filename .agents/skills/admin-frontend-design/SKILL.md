---
name: admin-frontend-design
description: Build or revise admin screens in apps/admin, including /bookings and /payments, using the shared booking theme.
---

# Admin frontend design

- Apply the `AGENTS.md` “Code as input” rule. Compare the affected screen with the
  closest admin screen and inspect the shared theme for typography, spacing,
  and component conventions.

- Use `var(--color-booking-muted)` for admin text-entry labels, including
  Username and Password on `/login`. Use `var(--color-booking-white)` for
  the entered text.
- For admin text-entry fields with a visible border, including `/login`, use
  `var(--color-booking-white)` at rest. On mouse or keyboard focus, change that
  same border to `var(--color-booking-primary)` and suppress any additional
  focus outline or ring on the field. Keep the border width constant.

- On `/bookings` and `/payments`, date picker controls have no border, a primary-yellow background (`var(--color-booking-primary)`, `#FFF000`) and black text (`var(--color-booking-black)`, `#000000`).
- These pages display a formatted date inside `.date-control` with a transparent native date input covering it. Apply visible colors and border to the wrapper; retain native date selection, the associated label and keyboard focus indication. Use the light color scheme for the native input.
- On `/bookings`, reservation time lines use 12-hour time with uppercase AM/PM and no space or leading hour zero, such as `10:00AM` and `4:00PM` (Luxon `h:mma`). Use the same time format within `/payments` Date / time values (`dd LLL yyyy h:mma`). Preserve each page's existing timezone handling.

- Admin owns only booking backoffice screens. Import theme CSS, FontHead, Button and TopNav from `@booking/ui`; maintain consistent design with customer web. Tailwind must scan `packages/ui`.
- Pass explicit Bookings, Payments, New Reservation links to TopNav. New Reservation uses same-origin `/bookings/new`. Payment booking links use `PUBLIC_CUSTOMER_URL` (development default `http://localhost:5173`, required HTTP(S) origin in production), in the same tab. Do not infer app ownership from URL prefixes.

- Admin also owns `/bookings/new` and `/bookings/new/contact-info`. Preserve customer-equivalent selection, availability, Racing quantity, errors and recovery using local reservation helpers and shared UI. Wrap these routes in `.customer-app` for theme styling. Both screens retain all three admin navigation links.
- Confirm saves `admin.booking-draft` and navigates to local contact-info. Keep customer drafts separate; show summary with optional quantity and a local recovery link for invalid/missing/inaccessible drafts.
- Contact fields start empty with MY (+60), also offering SG (+65). Values remain in page state. Enable Submit for nonblank name/phone and a valid draft. Prevent native form submission, including Enter. Submit performs no writes, contact persistence, loading state or redirects. Actual admin booking creation remains future work.

- Admin booking details link to `/bookings/edit/:booking_id`. Open one blank
  selection with today's Malaysia date; do not fetch or prefill existing booking
  reservations or status. Order shared controls: Select Date, Select Room
  Category, Select Room, Select Time, Select Duration. Category selection defaults
  to the first available room/time. Other changes do not silently pick replacements.
- Confirm replaces all existing reservations with only the new selection's
  physical rows, without an additional confirmation prompt. Standard availability
  rules apply to every new interval; no original-value exception remains.
- Scope availability to the configured business and explicit room/full interval,
  share date reads, exclude self, reject draft overlaps and recheck before a
  full-list PUT. Keep failed edits in page memory, block duplicate submissions,
  and return to local details after success. All statuses are editable without
  payment/status controls. Cancel links to details without writes.

- Reservation editing omits visible reservation legends, original-value summaries
  and restore buttons. Use the new-booking fixed action bar with Confirm aligned
  right on desktop and bold, borderless Cancel to its left. On mobile, stack
  Confirm above Cancel. Keep accessible reservation group names.

- Racing category room controls allow multiple explicitly selected physical
  machines per editor, sharing its interval. Expand them to individual replacement PUT rows;
  require availability across all selected machines and reject overlaps across
  editors. Other categories
  remain single-select; category changes clear incompatible selections.

- On category selection, choose the first configured room with a free standard
  interval and its earliest start, accounting for external and draft reservations.
  Retain a supported duration or use one hour. Racing defaults to one selected
  machine with multi-select still available. Leave room/time empty when none
  are available; guard asynchronous defaults against newer user selections.

- On initial editor load, automatically select the first available category in
  configured order, its first free room, earliest start and one-hour duration.
  Skip categories with no available standard intervals. This supersedes leaving
  category/room/time/duration blank on load; do not fetch existing reservations.
  Apply defaults after retries as well, without overwriting a chosen category.
