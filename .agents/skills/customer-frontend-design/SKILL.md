---
name: customer-frontend-design
description: Build or revise customer booking screens in apps/web using the booking theme, typography, and shared Svelte button conventions. Applies to the /customer route family and its shared UI.
---

# Customer frontend design

- Use Tailwind directives and utilities. Define booking theme tokens in `apps/web/src/routes/customer/app.css`. Keep primary, secondary, ghost, info, success, danger, and warning colors there, along with h1, h2, h3, paragraph, and body sizes.
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
- On `/customer/bookings/new`, place the step heading and supporting description inside the date/time selection container, above the date buttons. Use matching internal padding (`px-5 pt-5 sm:px-7 sm:pt-7`).
- All four selection labels use 14px Montserrat Semibold (600), white: `class="text-[14px]! font-semibold text-booking-white"`. Place Select Date below the description with `mt-5`, above the date buttons. Place other labels above their controls. Omit timezone supporting text.
- The booking page's `<main>` uses `mx-auto max-w-5xl` with no outer padding at any breakpoint. Internal container and button padding remains.
- On `/customer/bookings/new`, use a 48px-high top navigation bar (`h-12`) with the container background (`#272727`) and `px-5 sm:px-7` horizontal padding. It has exactly two items spaced to opposite ends: the business name in white on the left and a hamburger button on the right. Do not display a business logo. Use the shared ghost Button with `icon="mdi:menu"`, `aria-label="Open menu"`, and `class="min-h-8! px-2!"` to keep it compact. The hamburger currently has no action.
- The outer date/time selection container has rounded corners and the container background, with no border. Internal dividers and button borders remain.
- Use these theme colors: primary `#FFF000`, container `#272727`, muted `#848484`, black `#000000`, and white `#FFFFFF`.
- Use black for the UI background. Containers have rounded corners and the container background color. Use white for ordinary text and muted for secondary text.
- Use Iconify's Svelte component and the `mdi:` icon set for every icon. Reuse `apps/web/src/lib/customer/Button.svelte` for buttons. For icon-only actions, pass an accessible label.
- Mix button variants according to their purpose:
  - Primary: primary background, black text, and no border. Use for major actions such as Confirm and for selected timeslots.
  - Secondary: thin primary-colored border, transparent background, and white text. Use for unselected timeslots.
  - Ghost: transparent background and no border.

- Fetch business details, QueryRoomCategories({business_id}) and QueryReservations({business_id,date}). Compute availability in the web app. Starts remain every 15 minutes; durations are whole hours stored internally in minutes. Hide starts with less than one hour available. Durations must end by closing and fit continuously in one physical room; never combine free intervals across rooms.
- Select Duration uses shared minus/plus buttons with `mdi:minus` and `mdi:plus`, accessible action labels and a value like “1 hour” or “2 hours”, styled bold in primary yellow (`font-bold text-booking-primary`). Default/minimum is 60 minutes; each click changes by 60 minutes. Disable minus at one hour and plus when another hour cannot fit.
- Retain category, time and duration across changes when valid; otherwise use the first available category/time and reset invalid duration to one hour, announcing adjustments. Keep category/date/full interval/duration summary and explicit empty states. Never show physical room choices. Customer details/submission/payment remain outside this slice.

- On `/customer/bookings/new`, use the shared primary Button labeled `Confirm`: primary yellow background, black 16px Montserrat text (`text-[16px]!`), no border, and 256px minimum width (`min-w-64`).
  - Keep it fixed to the viewport bottom and visible while scrolling. Center its wrapper with `inset-x-0 mx-auto max-w-5xl`, matching the booking container width. From `sm`, align the button to the container's right edge with `sm:justify-end`, without horizontal inset padding.
  - On mobile, center the button within a full-width container-colored background (`bg-booking-container`) with rounded top corners (`rounded-t-2xl`) and 20px top padding. From `sm`, use a transparent background, no top padding, and no wrapper rounding.
  - Use bottom padding `max(1.25rem, env(safe-area-inset-bottom))` and reserve space after the booking content (currently `h-28`) so the fixed container does not obscure the final controls. Keep wrapper pointer events disabled and button pointer events enabled.
  - Confirmation behavior is not implemented yet; these conventions describe presentation and placement.
