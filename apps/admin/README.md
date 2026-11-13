# admin

See [workspace guidance](../../README.md#frontend-apps) for routes, shared UI, configuration and commands.

Run `pnpm --filter admin dev`, `pnpm --filter admin build`, or `pnpm --filter admin types` from the workspace root.

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
