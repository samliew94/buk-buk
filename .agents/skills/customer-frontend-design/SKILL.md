---
name: customer-frontend-design
description: Build or revise customer booking screens in apps/web using the booking theme, typography, and shared Svelte button conventions. Applies to the customer booking route family and its shared UI.
---

# Customer frontend design

- Use Tailwind directives and utilities. Define booking theme tokens in `packages/ui/theme.css`. Keep primary, secondary, ghost, info, success, danger, and warning colors there, along with h1, h2, h3, paragraph, and body sizes.
- Use Montserrat by default, including form controls and buttons. Date button text uses Poppins from Google Fonts: weekday 14px regular (400), date 18px bold (700), month 12px regular (400). Reuse the font imports in the customer layout and the `font-poppins` theme utility.
- Date, room category, and time selection buttons share these hover rules:
  - Unselected: primary yellow background at 30% opacity (`hover:bg-booking-primary/30!`). Apply opacity to the background only; keep text and borders at their normal opacity.
  - Selected/active: retain the solid primary background and normal text/border styling with no hover effect. Never apply the unselected hover background to selected buttons, including Family.
  - Override the shared Button's whole-button hover fade with `hover:opacity-100!`. For selected Time Buttons, use `hover:bg-booking-primary! transition-none!` so selecting a hovered time immediately shows solid primary without an animation.
- Date buttons are the custom booking date controls. Display today and the next six days in Malaysia time in a single horizontally scrolling row, without wrapping. Use `w-14 max-w-14 shrink-0` (56px), rounded corners, 4px padding on all sides, and 2px vertical spacing between the three centered texts. With the current unlayered shared button CSS, use `p-1!` and `gap-0.5!` so these overrides take effect.
  - Stack uppercase weekday (`WED`), two-digit date (`01`), and abbreviated month (`Nov`) vertically, using the Poppins sizes and weights above.
  - Selected: primary background, black date and month text. Unselected: transparent background, thin white border, white date text, primary month text. Weekday text stays muted in both states. Override the secondary button border with `border-booking-white!`.
  - Reuse the shared Button component with primary/secondary variants and expose the full date through an accessible label and selection through `aria-pressed`.
- For booking step headings, use `STEP <number>: <action>` (for example, `STEP 1: Select Date and Time`) in 20px Montserrat Bold (700). Apply the size locally so the default h1 size does not override it; with the current theme, use `class="text-[20px]! font-bold"`.
- Booking step 1 has four vertically stacked sections: Select Date, Select Room, Select Time, and Select Duration. Room means category; show category names on shared buttons, primary yellow when selected, and only categories with at least one available one-hour booking.
  - Room buttons match date button borders: unselected uses a thin white border (`border-booking-white!`); selected retains the primary variant.
  - Use fixed 120px by 48px room buttons (`w-30 h-12 shrink-0`) with centered labels that can wrap inside each button. Keep the buttons in one horizontal row at every breakpoint; use `flex gap-2 overflow-x-auto pb-2` without row wrapping. Reuse `date-button-row` for the same primary yellow scrollbar as Select Date.
- Time buttons use `apps/web/src/lib/customer/TimeButton.svelte`, wrapping the shared Button. Show each start time once for the selected category, without a category code or divider.
  - Arrange times in four columns on mobile and six from `sm` (`grid grid-cols-4 gap-2 sm:grid-cols-6`).
  - With more than eight times on mobile, initially show seven and an eighth More button; clicking reveals all times. Collapse on date or category changes. From `sm`, show all times.
  - Format as `10:00AM` using Poppins Latin 14px, regular (400) unselected and semibold (600) selected. Selected: primary yellow with black text. Unselected: transparent, 0.5px primary yellow border at 30% opacity, white text. More uses the same border, yellow text and 16px regular Poppins. Expose `aria-pressed` and accessible time/category labels.
- On `/bookings/new`, start with Select Date using `px-5 pt-5 sm:px-7 sm:pt-7`. Do not add a step heading or introductory description.
- All four selection labels use 14px Montserrat Semibold (600), white: `class="text-[14px]! font-semibold text-booking-white"`. Place Select Date above the date buttons without an extra top margin. Place other labels above their controls. Omit timezone supporting text.
- The booking page's `<main>` uses `mx-auto max-w-5xl` with no outer padding at any breakpoint. Internal container and button padding remains.
- On `/bookings/new` and `/bookings/new/contact-info`, reuse `@booking/ui/TopNav.svelte`: a 48px dark navigation bar with business name on the left, desktop New Reservation link on the right and a mobile hamburger toggling the navigation panel. Preserve overlay click, Escape and link-selection dismissal, responsive visibility and the shadow. Pass explicit customer links as described below. Do not display a business logo.
- The outer date/time selection container has rounded corners and the container background, with no border. Keep section padding and button borders; omit dividers between selection sections.
- Use these theme colors: primary `#FFF000`, container `#272727`, muted `#848484`, black `#000000`, and white `#FFFFFF`.
- Use black for the UI background. Containers have rounded corners and the container background color. Use white for ordinary text and muted for secondary text, except for the white booking details container described below.
- Use Iconify's Svelte component and the `mdi:` icon set for every icon. Reuse `@booking/ui/Button.svelte` for buttons. For icon-only actions, pass an accessible label.
- Reuse `apps/web/src/lib/customer/ErrorModal.svelte` for customer error modals instead of duplicating modal markup per page.
  - Use a centered white rounded card with black text and a white backdrop at 33% opacity (`#FFFFFF/33`, `backdrop:bg-booking-white/33`) with 2px backdrop blur. Overlap its top edge with an 80px black circle containing a 48px primary-yellow (`#FFF000`) `mdi:exclamation-thick` icon.
  - Titles use 22px Montserrat Bold (700); descriptions use 18px Poppins Regular (400). Keep both centered and preserve the component's local font-size overrides.
  - Pass `title`, `description`, and `onclose`. The default title is `Incomplete Selection`; choose context-specific copy for other errors. A nonempty description opens the native dialog; an empty description closes it. Clear the caller's error state in `onclose` so the same error can open again.
  - Preserve native modal focus behavior, accessible title/description associations, Escape dismissal and backdrop-click dismissal. Retain form inputs and booking selections when an error is dismissed.
- Mix button variants according to their purpose:
  - Primary: primary background, black text, and no border. Use for major actions such as Confirm and for selected timeslots.
  - Secondary: thin primary-colored border, transparent background, and white text. Use for unselected timeslots.
  - Ghost: transparent background and no border.
  - Disabled primary buttons: primary background at 30% opacity (`bg-booking-primary/30`), full text opacity, no hover fading and `cursor-not-allowed`. Use the native `disabled` attribute, with styling in customer `app.css`; do not fade the whole button.

- Fetch business details, QueryRoomCategories({business_id}) and QueryReservations({business_id,date}). Compute availability in the web app. Starts remain every 15 minutes; durations are whole hours stored internally in minutes. Hide starts with less than one hour available. Durations must end by closing and fit continuously in one physical room; never combine free intervals across rooms.
- Select Duration uses shared minus/plus buttons with `mdi:minus` and `mdi:plus`, accessible action labels and a value like “1 hour” or “2 hours”, styled bold in primary yellow (`font-bold text-booking-primary`). Default/minimum is 60 minutes; each click changes by 60 minutes. Disable minus at one hour and plus when another hour cannot fit.
- Retain category, time and duration across changes when valid; otherwise use the first available category/time and reset invalid duration to one hour, announcing adjustments. Keep explicit empty states and adjustment announcements. Do not show a summary below Select Duration or physical room choices. Customer details appear on the next route; booking submission and payment remain unimplemented.

- On `/bookings/new`, use the shared primary Button labeled `Confirm`: primary yellow background, black 16px Montserrat text (`text-[16px]!`), no border, and 256px minimum width (`min-w-64`).
  - Keep it fixed to the viewport bottom and visible while scrolling. Center its wrapper with `inset-x-0 mx-auto max-w-5xl`, matching the booking container width. From `sm`, align the button to the container's right edge with `sm:justify-end`, without horizontal inset padding.
  - On mobile, center the button within a full-width container-colored background (`bg-booking-container`) with rounded top corners (`rounded-t-2xl`) and 20px top padding. From `sm`, use a transparent background, no top padding, and no wrapper rounding.
  - Use bottom padding `max(1.25rem, env(safe-area-inset-bottom))` and reserve space after the booking content (currently `h-28`) so the fixed container does not obscure the final controls. Keep wrapper pointer events disabled and button pointer events enabled.
  - Enable Confirm only for a valid displayed date and matching selected category/time with an available duration. Existing automatic valid selections count. Disable it when availability is missing or the selection is invalid.
  - Save only `{ date, room: { id, name }, time, duration }` as JSON under `customer.booking-draft` before navigating to `/bookings/new/contact-info`. Room is the category, date/time are Malaysia local values, and duration is minutes. If storage fails, stay on the selection page and show the shared ErrorModal.

- On `/bookings/new/contact-info`:
  - Reuse the centered `max-w-5xl` page width and TopNav. Load the configured business name for refresh/direct entry without fetching availability.
  - Read and validate the booking draft client-side, retaining it across refreshes. Missing, malformed or inaccessible storage shows recovery guidance and a link to `/bookings/new`.
  - Show a full-width primary-yellow summary with black text and `px-5 py-4 sm:px-7`. Use three rows: `Thu 12 Nov`, category name, then `10:00AM · 1 Hour` (plural `Hours`). Use Malaysia time and English date labels.
  - Give the rows separate MDI icons: `mdi:calendar`, `mdi:door-open`, and `mdi:clock-outline`. Use `flex items-center gap-3` with `size-6 shrink-0` icons and no top offset. Allow text to wrap.
  - Place the form on black with `px-5 py-7 sm:px-7`, Montserrat typography and muted labels. Inputs use transparent backgrounds, white text/borders, rounded corners and primary borders on focus. Associate labels with controls; use `autocomplete="name"` and telephone autocomplete attributes.
  - Keep country and telephone controls inline. Default to `MY (+60)` with value `+60`; also offer `SG (+65)` with value `+65`. Hide the native arrow and use a pointer-events-none `mdi:chevron-down`, vertically centered and inset 12px (`right-3`), with `pr-10` text clearance. Preserve native select interaction.
  - Center a shared primary Submit button below Mobile Number (`min-w-64 text-[16px]!`). Disable it until both name and phone contain non-whitespace text; disable again when either is cleared. Country code alone does not satisfy the phone requirement.
  - Keep contact details in page state; persist only the booking draft. The current Submit button has no booking creation, API or payment behavior.

## Booking details

On `/bookings/[booking_id]`:

- Reuse TopNav, Montserrat and the centered `max-w-5xl` main without outer padding. Keep the page background black. The details container is white with black text, rounded corners and `mt-5 p-5 sm:p-7`.
- Show a single column at every screen size. Each muted (`#848484`) label sits directly above its black value with zero grid gap; keep `1rem` between fields. Use semantic `dl`/`dt`/`dd` markup.
- Field order is Booking reference, Status, then Date, Room, Time and Duration for each reservation. Room combines category and assigned room with ` · `. Format dates in Malaysia time as `Thu 12 Nov 2026`; Time shows only the start time, e.g. `10:00AM`. Format duration in hours and remaining minutes.
- Display the reference GUID inside a primary-yellow (`#FFF000`) rectangle with black text, `px-3 py-2`, content-fitting width and no corner rounding. Use `max-w-full` and `break-all` so long references wrap within the container.
- Keep status values black, including Confirmed, Cancelled, Pending and Expired. Pending becomes Expired when its hold expires while the page is open; this is display-only. Preserve the polite live announcement.
- Immediately after status, place a semantic horizontal rule with pale muted round dots: 8px height, `1.25rem` vertical margins, no border, and a repeating radial gradient with a dot centered at `(4px, 4px)`, solid through 3.5px and transparent at 4px. Use muted at 15% opacity and a `21px 8px` background tile repeated horizontally.
- Omit visible Booking details/Reservations headings and timezone supporting text. Keep the descriptive document title, `noindex` metadata and accessible container/reservation labels.
- Preserve multiple-reservation and empty states, browser lookup with an eight-second timeout, navigation abort/stale-result protection, and loading/missing/failure guidance. Business-name lookup failure must not block details. The page remains read-only, without polling or payment/contact fields.


## Racing quantity booking (12 Nov 2026)

Racing quantity booking: show Select Quantity between Room and Time only for exact acronym RACING. Use duration stepper styling, number 1–4, reset on category changes and retain across dates. Filter times/durations by continuously available machine counts; keep quantity controls visible with no eligible times and disable Confirm. Save optional quantity only for Racing, including 1; preserve older drafts. Contact summary shows category × quantity; POST includes quantity only when present. A 409 shows availability guidance and retains contact details.

## App ownership and shared design

Customer booking lives in `apps/web` under the pathless `(customer)` layout. Routes are `/bookings/new`, `/bookings/new/contact-info`, `/bookings/[booking_id]` and `/payments/[paymentId]`. Demo gateway remains `/payment/demo/[orderId]`, outside that layout. Legacy GM/player/device/info/auth routes remain in web. No old URL redirects.

Reuse `@booking/ui/theme.css`, `FontHead.svelte`, `Button.svelte` and `TopNav.svelte`; keep customer and admin design consistent. Pass explicit TopNav links: `[{ href: "/bookings/new", label: "New Reservation" }]`. Preserve the responsive desktop links and mobile toggle/overlay menu. Shared fonts live in FontHead.
