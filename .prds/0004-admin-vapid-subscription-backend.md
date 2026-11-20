# 0004 — Device registration with manually configured VAPID keys

**Status:** Closed

## Description

Implement public POST /register-web-push only. This revised scope supersedes the original authenticated admin subscription proposal.

## Problem Description

Persist device subscriptions without requiring admin sessions or business association. Manually configured stable VAPID credentials must be validated only when registration is requested.

## Implementation Plan

- Accept endpoint and nested keys (p256dh/auth); return 200 with only id for both new and repeat registrations.
- Strict object/field, 8 KiB body, 4096-character HTTPS endpoint and canonical base64url key validation; reject credentials/fragments and invalid P-256 points or non-16-byte auth secrets.
- Migration 0018 stores server-generated ID, unique exact endpoint, encryption keys, SHA-256 VAPID key identifier and UTC timestamps. Upsert preserves ID and creation time.
- Inject the registration use case with parameterized D1 SQL. Sanitize configuration and database errors before logging.
- Manually configure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. Preserve existing ignored local values; add missing placeholders only. No key generation helper.
- Keep stable keys per environment and manually match the client public key. Subscription data cannot establish this match. Rotation requires re-subscription.

## What Success Outcome Looks Like

Public unauthenticated registrations persist and repeat with stable IDs; multiple endpoints remain distinct. Invalid input is 400; missing/invalid configuration is a sanitized 500 without affecting other routes. Private credentials and subscription values never enter errors or logs.

## Dependencies

API/D1 only; no frontend integration is included.

## Assumptions

No lookup, authentication, business/principal columns, removal, delivery, remote migration or deployment. Ownership, server-side business authorization and ownership-scoped removal remain deferred requirements before staff notifications expand.

## Implementation status

Registration, migration, local configuration placeholders, README and Postman request implemented. SQLite/API tests cover validation, repeat registration, key rotation, multiple devices, constraints and secret-safe errors. See diary for verification results.

Registration does not require a VAPID contact subject. Contact configuration and
any provider-specific requirements are deferred to the sending implementation.
