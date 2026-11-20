# 0006 — Public demo push delivery

**Status:** Closed

The developer confirmed local booking notification delivery on 20 Nov 2026. See the implementation notes in [the diary](../.docs/DIARY.md) for the final sender and registration behavior.

## Description

Implement the approved public demo test sender and admin Send test notification.
This explicitly supersedes earlier authentication, ownership and per-owner throttle
prerequisites. No account management or automatic booking/payment notifications.

## Problem Description

Saved subscriptions and provider acceptance do not establish displayed delivery.
The demo needs a bounded, safe test send using a current stored browser subscription.

## Implementation Plan

Implemented public POST /v1/web-push-subscriptions/:id/test with exactly {}, stored
D1 destinations/keys, pinned webcrypto-web-push 2.0.0, fixed version-1 calendar
payload, 2048-byte bound, TTL 60, eight-second timeout and redirect rejection.
Registration and sending enforce FCM/Mozilla/Apple provider host restrictions.
Migration 0019 adds nullable last_test_attempt_at; conditional UPDATE atomically
reserves one attempt per subscription per 60 seconds. Sending is always enabled
and uses a matching VAPID key pair. The token omits the optional contact claim. Old-key records require
re-subscription. Provider expiry deletes only the selected record; other failures
retain it. Errors are sanitized and retries are explicit.

Admin retains ID in memory, recovers by re-registering on reload, disables concurrent
actions, shows acceptance/cooldown/errors and offers explicit registration recovery.
Existing worker display/click behavior and browser-only unsubscribe are preserved.

## What Success Outcome Looks Like

Public browser registration enables Send; provider acceptance returns 202 without
claiming display. Only approved stored destinations receive the fixed test payload.
Cooldown, expiry, temporary failure and key-rotation recovery have local coverage.

## Dependencies

0004 registration and 0005 controls/worker handlers. Apply 0018 then 0019 before
enabling sends. API/admin READMEs document configuration and rollback.

## Assumptions

Legacy rows retain no ownership. Unsupported rows remain stored but unsendable.
No remote migration or deployment is included. Real provider delivery, Android,
iPhone/iPad Home Screen and installed desktop display/calendar-click checks remain
pending. Local synthetic checks cannot establish these outcomes.

## Verification

96 API tests passed, including real SQLite reservation concurrency, independent
subscriptions, strict body/destination validation, payload decryption and VAPID
signature/audience verification, redirects, timeout, expiry and failure retention.
Notification tests passed; admin check has zero errors/warnings and production
build passed. Actual installed 2.0.0 package accepted via controlled transport under
local Wrangler workerd; no provider request was made.

Local migration 0019 applied successfully. Synthetic production-preview checks at
390px/1440px passed for Enable, no initial prompt, reload registration recovery,
Send/busy disabling, accepted wording, temporary failure, 429 cooldown and expired
subscription re-registration, without horizontal overflow. Browser subscriptions,
worker readiness and API responses were mocked; no provider delivery established.
