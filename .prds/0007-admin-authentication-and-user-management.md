# 0007 — Admin authentication and user management

**Status:** Closed

## Description

Replace shared-password authentication with database-backed users. Add admin login, logout and user-management screens, protect staff API operations, and preserve public customer booking flows.

Use stateless, separately signed access and refresh JWTs. Access tokens last up to 15 minutes, and each login starts a 7-day session. Password changes leave issued sessions valid.

## Problem Description

The API currently supports shared-password login, but the admin app has no login flow and business endpoints are public. Individual staff accounts, role restrictions and renewable sessions are needed. Shared customer/admin endpoints must retain public customer booking behavior.

## Implementation Plan

### Users and authorization

- Add a migration creating `user` with GUID `id`, uniquely indexed `username`, salted `password_hash`, constrained `role` (`developer` or `manager`) and `is_banned` constrained to integer `0` or `1`.
- Trim and lowercase usernames on creation, update and login. Enforce uniqueness in D1; duplicate usernames return 409.
- Store versioned, salted scrypt hashes using `node:crypto`: `N=16384`, `r=8`, `p=5`, random 16-byte salt and 32-byte derived key. Use constant-time comparison. This follows [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) using [Workers-supported crypto APIs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).
- Implement and inject `QueryUsers.query`, `QueryUser.query(userId)`, `CreateUser.exec` and `UpdateUser.exec`.
- Both roles can query users and create managers. Developers can manage either role. Developer accounts are provisioned directly in the database. The API does not create developers or promote managers to developer. Managers can edit manager accounts and ban or unban other managers. A manager can edit their own username and password. Setting their own ban status returns 403. Managers have read-only access to developer accounts. Enforce these rules in use cases using the authenticated actor.
- New users start unbanned. Partial updates may change username, password or `is_banned`. Accept only JSON booleans for `is_banned`, mapping `true` to `1` and `false` to `0` in D1. Omitted fields remain unchanged. Banning and unbanning use PUT. Require nonblank usernames and passwords of 8–128 characters, preserving password whitespace.
- User responses expose only `{ id, username, role, is_banned }`, with `is_banned` returned as a JSON boolean. Never return or log passwords, hashes or tokens.

### API and token lifecycle

Keep `/v1` prefixes and snake_case JSON conventions.

| Endpoint | Contract |
|---|---|
| `QUERY /v1/users` | Authenticated; `{}` body; all users ordered by username, then ID |
| `GET /v1/users/:id` | Authenticated; user or `null`, matching existing lookup conventions |
| `POST /v1/users` | `{ username, password }`; created manager with 201 |
| `PUT /v1/users/:id` | Nonempty partial update; updated user with 200; missing user returns 404 |
| `POST /v1/auth/login` | `{ username, password }`; returns token pair |
| `POST /v1/auth/refresh` | `{ refresh_token }`; verifies the refresh JWT and returns a new pair with the original refresh deadline |
| `GET /v1/auth/me` | Validates access token; returns `{ id, role }` |

- Token-pair responses contain `access_token`, `refresh_token`, `expires_at` and `refresh_expires_at`, with UTC ISO expiry timestamps.
- Access tokens remain HS256 JWTs with validated issuer, audience, subject, role and expiry. Support only `developer` and `manager`; reject legacy shared-admin tokens. The existing `/v1/auth/admin` accepts both staff roles.
- Sign refresh JWTs with a separate `JWT_REFRESH_SECRET`. Validate the issuer, refresh audience, subject, role, expiry and token purpose. Protected routes accept access JWTs only. Refresh verifies the presented JWT without a D1 read or write.
- Issue a replacement pair on successful refresh and preserve the original 7-day refresh deadline. Cap the replacement access token expiry at that deadline. Earlier refresh JWTs remain usable until expiry.
- Login reads the current user and requires an unbanned account. Issued sessions retain their original role through refresh. Password changes, role changes, banning and browser logout do not revoke issued tokens.
- Wrong credentials, banned accounts at login and invalid refresh tokens return generic 401 responses. Malformed input returns 400; forbidden role operations return 403. Auth and user responses disable caching.
- Remove `ADMIN_PASSWORD` configuration; retain `JWT_SECRET` for access JWTs and configure `JWT_REFRESH_SECRET` independently. Use central typed errors and repository diagnostic conventions without exposing credentials.
- Require either staff role for booking/payment collection queries, booking reservation updates, customer lookup/updates, and business/room/category/rental-fee creation and updates.
- Preserve public business/configuration reads, availability queries, customer/booking creation, individual booking/payment reads, demo-payment operations, webhooks and push registration. Do not change booking payment behavior or add notification ownership.
- Verify CORS permits `Authorization`, `Content-Type` and `QUERY`.

### Admin application

- Add `/login`, `/users`, `/users/new` and `/users/:id/edit` using shared theme and UI components.
- Login accepts username/password. Store both tokens under the single `auth` localStorage key as `JSON.stringify({ access_token, refresh_token })`. Login and refresh use the same session writer to replace the complete pair with one `setItem` call. Successful login opens `/calendar`.
- Place existing admin screens and user management behind a shared browser authentication guard. Disable SSR for the protected route group and move API data loading into guarded browser loads, since localStorage credentials are unavailable to server loaders.
- Use one API client for all admin API requests, attaching bearer tokens only to the configured API origin.
- On a protected request's 401, the shared client's response handler POSTs to `/v1/auth/refresh`, saves the replacement pair, and retries the original request once with the new access token. Share one in-flight refresh among concurrent requests in the same tab. Login and refresh calls bypass this retry handler. Only login and refresh responses update the stored pair. A late 401 retries with the current access token if it has already been replaced. Logout and new sign-in discard pending refresh results.
- If refresh fails or the retried request returns 401, clear credentials and redirect to `/login`. A 403 neither refreshes nor redirects; display an access-denied error.
- Add Users navigation and Logout. Logout removes `auth` and opens `/login`.
- User management lists username, role and ban status. Creation takes username and password and creates a manager. Editing supports an optional password replacement and ban controls. Managers see developers as read-only and cannot ban themselves. Backend enforcement remains authoritative.
- Restore identity-dependent controls from the current access token via `/v1/auth/me`. Unavailable localStorage produces a visible login error.

### Setup and verification

- Seed `sam` as an unbanned `developer` in a D1 migration. Insert only a salted scrypt hash of the initial password `changeit`, using the same format as login. Preserve any existing `sam` account. Document changing the initial password before exposing the admin API publicly.
- Update API/admin documentation, the existing Postman collection and diary. Document migration, seeding, token storage and removal of shared-password login.
- Test SQLite persistence, normalized uniqueness, partial updates, omitted passwords, banned login, response secrecy, boolean ban validation, manager self-ban rejection and the full role-permission matrix.
- Test JWT expiry and claims, rejection of the wrong token type or signing key, refresh without D1, preservation of the original refresh deadline, and successful renewal after a password change.
- Test staff route protection and regression-check public customer booking/payment flows.
- Browser-test direct protected navigation, login persistence, user CRUD, logout, concurrent-request refresh, successful retry, failed refresh and 403 handling.
- Run API types/tests, admin checks/build and local Wrangler authentication checks to verify scrypt compatibility and resource usage. Preserve unrelated workspace changes.

## What Success Outcome Looks Like

- After migrating a fresh database, `sam` can log in with `changeit`, manage both roles and use existing admin screens. Both roles can create managers. Managers can ban or unban other managers, and a manager self-ban returns 403. Developer accounts are provisioned through the database.
- Duplicate usernames are rejected case-insensitively, banned accounts cannot start a new session, and user responses never expose password data.
- Access tokens last up to 15 minutes. Refresh succeeds until the original 7-day deadline, including after a password change. Earlier refresh tokens remain usable until that deadline.
- Login and refresh each replace both tokens together under `auth`. Admin requests refresh and retry once after 401, then clear the stored pair and redirect to `/login` on failure. A 403 remains on the current page.
- Protected staff operations reject unauthenticated requests while customer booking/payment flows retain their public behavior.
- Focused tests and affected checks/builds pass; runtime evidence and any verification limitations are recorded.

## Dependencies

None. Builds on existing API authentication primitives and the independent admin app. Notification ownership and delivery are not prerequisites.

## Assumptions

- The `manager` role represents the business owner. Both staff roles have global access. Business-specific permissions are outside scope.
- New logins use the current account state. Existing sessions can keep their issued role for up to 7 days, including after banning or a role change.
- Refresh tokens use localStorage by explicit user choice; no cookie-based session bridge is introduced.
- Password recovery, session-management UI, last-developer lockout protection, deployment and remote migration are outside scope.
- Existing public customer and notification contracts remain unchanged except where staff-only protection is explicitly listed above.

## Implementation and verification

Implemented migration `0020`, staff JWTs and the users API, method-specific staff
protection, admin sign-in and user management. Updated the API and admin READMEs
and the Postman collection. Manager accounts can update their own credentials.
The ban field is available to managers for other manager accounts.

API types and all 27 test files passed. Local Wrangler with disposable D1 and
ST3 fixture data applied the full migration chain and verified the seeded scrypt
login, token refresh, username conflicts, updates, role enforcement, CORS and
public booking and payment reads. Production deployment and remote migrations
remain outside scope.

Chrome against local Wrangler/D1 passed signed-out navigation, seeded sign-in,
blocked storage, reload, role controls, create and edit flows, form errors and
mobile logout. Controlled browser responses covered concurrent and late 401s,
save-before-retry, refresh failure, a second 401, 403 and discarding a stale
refresh after logout or a new login.
The admin Wrangler type check, Svelte check, production build and notification
tests passed. The browser acceptance run used Vite in development mode.
