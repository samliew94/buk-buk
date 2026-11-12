---
name: admin-frontend-design
description: Build or revise admin screens in apps/web, including /admin/bookings and /admin/payments, using the shared booking theme.
---

# Admin frontend design

- On `/admin/bookings` and `/admin/payments`, date picker controls have no border, a primary-yellow background (`var(--color-booking-primary)`, `#FFF000`) and black text (`var(--color-booking-black)`, `#000000`).
- These pages display a formatted date inside `.date-control` with a transparent native date input covering it. Apply visible colors and border to the wrapper; retain native date selection, the associated label and keyboard focus indication. Use the light color scheme for the native input.
