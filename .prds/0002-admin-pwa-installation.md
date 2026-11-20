# 0002 — Admin PWA installation

**Status:** Closed

## Description

Make only apps/admin installable as a standalone application. This is phase 1 of five.

## Problem Description

Admin has its own SvelteKit application and Cloudflare Worker, but no manifest, install icons or installation metadata. Its root redirects to /calendar.

## Implementation Plan

1. Add `/manifest.webmanifest` with stable id /, start_url /calendar, scope /, standalone display, lang en, name and short_name BUK BUK, description Booking App, theme_color #FFF000 and background_color #000000.
2. Reference `https://cdn.astra-cloud-solutions.com/bukbuk/icon-192.png` and `https://cdn.astra-cloud-solutions.com/bukbuk/icon-512.png` directly in the manifest. Declare both icons as `any`; no separate maskable or Apple touch icon is required.
3. Link the manifest using `%sveltekit.assets%` and set the theme color in the admin document head.
4. Document HTTPS hosting, localhost development and browser installation, including iOS Add to Home Screen. Verify distinct admin and customer production origins before enabling a root-scoped worker.
5. Keep PWA metadata in apps/admin; the two standard icons use the supplied CDN URLs. No custom install banner is required.

## What Success Outcome Looks Like

- Manifest resolves on the admin origin; standard icons resolve on the CDN, with correct content types and dimensions.
- Browser manifest inspection confirms stable identity, standalone display and /calendar launch.
- Installation is verified where supported; any service-worker prerequisite deferred to phase 2 is recorded.
- Admin type checking and production build pass. Customer source remains unchanged.

Implemented 13 Nov 2026. Admin check passed with zero errors/warnings and the
production build passed. Chrome DevTools manifest inspection found no parse or
installability errors and confirmed BUK BUK, standalone display, root scope/ID
and `/calendar` start URL. All manifest/icon URLs returned 200 with correct MIME
types; all PNG dimensions and maskable branding safe-circle bounds passed checks.
No service worker was registered. Actual installation/standalone launch and iOS
Add to Home Screen remain manual verification: headless Chrome does not expose
`PWA.install` or `PWA.launch`, and no iOS device was available. Chrome reported no
worker prerequisite; browsers requiring one await phase 0003. Customer source
is unchanged. See [admin installation guidance](../apps/admin/README.md#installing-buk-buk).

The standard 192px/512px icon references were subsequently switched to the supplied
CDN URLs at the developer’s request, removing their duplicate local copies.
The optional maskable icon, Apple touch icon and their respective manifest/head
entries were subsequently removed at the developer’s request; no replacement is
required. Only the two standard CDN icons remain.

## Dependencies

None. First phase of this sequence.

## Assumptions

Chosen name and short name: BUK BUK; description: Booking App. Admin must be
deployed on its own HTTPS origin. Actual admin/customer production origin
separation remains unverified and must be recorded before phase 0003 registers
a root-scoped worker. Localhost supports development. Offline functionality,
notification permission, custom install banners and deployment are outside this
phase; existing page titles and navigation labels remain unchanged.
