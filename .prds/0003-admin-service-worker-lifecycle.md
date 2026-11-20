# 0003 — Admin service worker lifecycle

**Status:** Closed

## Description

Establish the admin browser service worker and its update policy. This is phase 2.

Implementation was locally verified on 13 Nov 2026. Production rollout
and installed-app device checks remain pending. Changes apply only to
`apps/admin`; no customer `apps/web` source changes were made.

## Problem Description

Before this implementation, there was no browser service worker. Generated Cloudflare Worker types do not register one. Operational booking/payment data must stay fresh when adding PWA infrastructure.

## Implementation Plan

1. Use the supported SvelteKit service-worker entry/registration mechanism, verifying current framework behavior during implementation. Avoid an extra PWA plugin unless necessary.
2. Register only for admin, in supported secure contexts and production builds, with root scope on its separate origin. Document production-preview verification.
3. Start network-only: no fetch interception, response cache, offline navigation fallback, mutation queue or background replay. The normal browser offline error is acceptable.
4. Retain normal waiting-worker activation. Do not force activation or reload pages containing unsaved reservation drafts. Document when updates take control.
5. Keep one worker entry for later push handlers. Document unregister/rollback without deleting unrelated caches.

Implemented with `apps/admin/src/service-worker.ts`, including a build-version
installation diagnostic. Automatic SvelteKit registration is disabled in the
admin Vite configuration. The root layout manually registers `/service-worker.js`
with scope `/` and `updateViaCache: 'none'` only in production secure supported
contexts where the existing configured customer origin differs from the current
origin. Failures warn without blocking browsing. No fetch interception, caches,
replay, push, `skipWaiting()`, `clients.claim()`, prompts or reloads were added.
Preview, lifecycle, targeted unregister and inert-worker rollback instructions
are recorded in [the admin README](../apps/admin/README.md#admin-service-worker--0003).

## What Success Outcome Looks Like

- Production browser reports one active admin registration with the expected scope.
- Customer origin has no new registration.
- Booking/payment requests retain network behavior; no operational data enters Cache Storage and failed writes are never replayed.
- An updated worker waits and activates after controlled clients close; no forced form reload occurs.
- Admin checks/build pass and unsupported browsers retain ordinary browsing.

Local verification completed:

- Admin type checking passed with zero errors/warnings; Wrangler types,
  production builds, changed-source formatting and whitespace checks passed.
- Chrome reported one admin root registration with JavaScript MIME and no
  forced initial control. Customer preview and admin development registered none.
- Mocked booking/payment requests reached the browser network layer; Cache
  Storage stayed unchanged, offline requests failed and failed writes were not
  replayed after reconnecting.
- Across two builds, the replacement waited while an unsaved contact form and
  page-memory marker remained intact, then activated after the controlled page
  left the origin and reopened. Unsupported/insecure contexts and registration
  failure retained normal navigation.
- Developer manually confirmed the active worker at `http://localhost:4174/`,
  with `navigator.serviceWorker.controller?.scriptURL` returning
  `http://localhost:4174/service-worker.js`. DevTools also displayed
  `http://localhost:4174/calendar` as a client. Its Clients list intermittently
  appeared empty after reload while the controller check confirmed control.

Pending rollout verification:

- Confirm the intended production hosts serve the correct separate apps:
  `https://bukbuk-admin.astra-cloud-solutions.workers.dev` and
  `https://bukbuk-customer.astra-cloud-solutions.workers.dev`. Both returned
  Cloudflare 404s during planning. Verify registration isolation there.
- Verify lifecycle behavior with actual installed app windows on devices.
  No deployment or live booking/payment writes were performed.

## Dependencies

Complete [0002-admin-pwa-installation.md](0002-admin-pwa-installation.md) first.

## Assumptions

Offline booking is not required. Development does not install persistent workers by default. Push handlers are deferred to phase 4.
