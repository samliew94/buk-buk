---
name: payment-demo-design
description: Build or revise the demo payment gateway page at /payment/demo/[orderId] in apps/web using its light theme, button styling and payment status conventions.
---

# Demo payment page

Use `apps/web/src/routes/payment/demo/[orderId]/+page.svelte` and its adjacent
`+page.server.ts`. This gateway page uses a light theme separate from the
customer booking screens.

## Appearance

- Keep a light slate background (`bg-slate-100`), dark slate text
  (`text-slate-900`) and sans-serif typography. Center the payment card vertically
  and horizontally in a full-height viewport with 16px outer padding.
- Use a white card, `max-w-md`, rounded corners, 24px inner padding and a subtle
  shadow. Keep the heading “Demo payment gateway” at 20px semibold.
- Show “Order ID” at 12px in muted gray `#848484` above the wrapping order ID
  value. Keep its color in the scoped `.order-id-label` CSS rule.
- Format the amount as MYR using `Intl.NumberFormat('en-MY')`. Center the value
  horizontally at 24px semibold, without an Amount label.
- Place Approve and Cancel side by side in two equal columns with a 12px gap
  and 24px top spacing. Both use rounded corners, semibold text, 16px horizontal
  padding, 12px top/bottom padding and a minimum height of 44px.
- Approve uses blue `#1d4ed8` with white text; its hover background is `#1e40af`.
  Retain the page's scoped CSS for these colors, introduced when utility styling
  did not appear in the rendered page.
- Cancel is a borderless ghost button with transparent background, black text
  and light slate hover background. Preserve visible keyboard focus indicators
  and disabled styling for both buttons.
- Center status descriptions below the buttons. “Payment approved.” uses the
  same blue `#1d4ed8` as Approve; other status descriptions retain ordinary text
  color. Keep errors in red with `role="alert"`.

## Preserve payment behavior during styling changes

- Fetch the order directly from the browser through the configured public API
  URL when the page mounts or the order ID changes. The server loader supplies
  only the API URL and order ID. Show loading and inline error/not-found states;
  hide payment controls until the order loads. Abort obsolete loads on navigation.
- Approve sends `paid` and Cancel sends `cancelled` via a direct browser PUT to
  `/v1/demo-payment-orders/{orderId}`. Preserve existing API contracts.
- Disable both buttons during submission, for non-pending orders and after an
  ambiguous submission failure. Keep the duplicate-submit guard, timeout and
  reload guidance. After a successful Approve or Cancel response, append
  “Redirecting in 3...” to the outcome, count down each second and redirect after three seconds to
  `/customer/payments/{reference_id}` using the response’s `reference_id`, as
  explicitly requested (this value is the internal payment ID). The gateway-independent payment page
  fetches `GET /v1/payments/{payment_id}` client-side and redirects using the
  returned `booking_id` to `/customer/bookings/{booking_id}`.
  Clear redirect timers on navigation. Loading an already finalized (non-pending) order
  also starts the same visible countdown using its `reference_id`.
- Keep status announcements in `role="status"` with `aria-live="polite"`.
- Verify visual edits with formatting checks and, when available, a local
  preview or build. Avoid live payment writes for visual verification.
