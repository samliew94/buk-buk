---
name: api-design
description: Design, implement, or review this booking repository's API routes and payloads using its Hono, D1, use case, and snake_case JSON conventions.
---

# API design

Use this skill for API work in `apps/api`. Read `AGENTS.md` and the affected controller, use cases, dependencies, migrations, tests, and `apps/api/README.md` before changing a contract. Apply these conventions alongside applicable API engineering tools without introducing external setup for an ordinary local change.

## Routes and methods

- Use resource paths under `/v1`, such as `/v1/rooms`, rather than nesting rooms under businesses. Supply business scope in the JSON body as `business_id`.
- Use `QUERY` for new data query endpoints, with filters in a JSON object body. Register with Hono's `.query()`. Do not read query filters from URL query parameters or silently fall back to them.
- Use `POST /v1/:resources` for creation and `PUT /v1/:resources/:id` for updates. Keep record IDs in the path and generate new IDs on the server with `Guid.new()`.
- Wire only requested use cases. The room API exposes `QUERY /v1/rooms`, `POST /v1/rooms`, and `PUT /v1/rooms/:roomId`. `QueryRoom` exists without API wiring; do not add single-record endpoints automatically.
- Existing business and auth endpoints have their own contracts. Do not convert unrelated endpoints merely because a new endpoint uses `QUERY`.

## JSON contract

- All request and response object keys must use snake_case, including nested objects and entries in arrays: `business_id`, `sort_order`, `created_at`. Database columns can remain snake_case.
- Select explicit response fields. Select existing snake_case columns directly, without redundant aliases. Use meaningful snake_case aliases for joined or derived fields; never expose D1 result metadata.

- Categories own business_id, name, acronym, sort_order; physical rooms own room_category_id, name, sort_order. QUERY /v1/room-categories with business_id returns id/business_id/name/acronym/sort_order/room_ids including empty categories. Sort categories and nested rooms by sort order, name, then ID.
- Category creation allows omitted/null acronym; updates require a nonblank acronym. POST returns 201 and PUT returns 200 with the record. Physical room POST returns 201 and PUT retains 204. Missing referenced category returns 404.
- QUERY /v1/rooms remains a staff/internal collection scoped through room → category → business. QueryRoom and ownership checks use that same join. Never expose removed room.business_id/acronym fields.
- Category rental fees use /v1/room-category-rental-fees and room_category_id. QueryRoomCategoryRentalFee returns the first record by ID or null. Writes require category ID, nonnegative safe integer duration and finite nonnegative price; rely on FK checks. Keep original fee values and cardinality; no quote calculation.
- CreateBooking accepts one room_category_id, verifies business ownership, and assigns the first room free continuously for the exact interval ordered by sort order/name/ID. Return 404 for foreign categories and 409 without writes if unavailable. Store requested category and assigned room on the reservation. Positive-minute API durations remain supported independently of 15-minute customer controls.
- Both reservation query variants require business_id. Use stored category for requested category output, current physical/category joins for business scope. Date queries use overlap across 24 hours; range queries retain contained intervals. Confirmed and live pending holds block with `existing.from < requested.to AND existing.to > requested.from`; cancelled/expired holds do not. Concurrency and atomicity remain deferred for MVP.

## Controllers and use cases

- Define routers in `src/<resource>/<resource>.controller.ts` using `Hono<AppEnv>` and mount them in `src/index.ts`.
- Controllers validate transport input, construct existing value objects such as `Guid`, `Name`, and `Acronym`, invoke injected use cases, and shape HTTP responses.
- Register use cases in `src/dependencies.ts`, exposing needed methods through `Pick<UseCase, 'exec'>` or `Pick<UseCase, 'query'>`, and obtain dependencies from Hono context. Keep D1 access in constructor-injected use case classes.
- Use `exec` for commands and `query` for reads. Bind SQL values through parameterized D1 statements and `.bind(...)`.
- Keep this small API direct. Do not add a separate entity file such as `room/Room.ts`, a generic serializer, or another architecture layer solely to rename response keys.

## Validation, scope, and errors

- Parse JSON as `unknown`; reject malformed JSON, null, arrays, and invalid fields with 400. Require nonblank `business_id` and `name` where applicable. Room/category `sort_order` must be a safe integer; a provided acronym must be nonblank or `null`.
- Room list queries validate business existence and filter by category `business_id`. Physical room writes validate category existence; updates match room ID and may set a different existing category. Category writes validate business existence. Zero changed rows on update returns 404.
- Avoid redundant existence checks when the query itself establishes the result. Return the contract's empty result (`[]` for collections or `null` for single records) rather than adding a parent lookup and 404 unless explicitly required by that endpoint.
- Business filtering does not replace authorization. Follow the affected route's existing authentication and authorization requirements rather than inventing an access policy.
- Throw existing typed errors from `src/errors.ts`. Follow `AGENTS.md`'s pipe-separated diagnostic context:

```ts
throw new NotFoundError('business not found | id: ' + business_id.value)
```

- Use the central error handler and `{ "error": "..." }` envelope. Do not expose unexpected database errors or credentials.

## D1 and verification

- Keep schema names consistent with migrations. For physical rooms use singular `room` and `ORDER BY sort_order, name, id`; acronyms do not change ordering.
- Add migrations for schema changes. Consolidate unapplied migrations only when their unapplied state is established; do not routinely rewrite applied migrations. Apply locally with `pnpm --filter api exec wrangler d1 migrations apply DB --local` when the task calls for it.
- Update `apps/api/README.md` when HTTP contracts change.
- Run `pnpm --filter api types` and `pnpm --filter api test`. Cover changed public behavior: exact snake_case response shapes, JSON filters, persistence, ordering, validation, business isolation, and relevant null/omission semantics. Reuse SQLite-backed room tests for real SQL behavior.
- For `QUERY`, verify CORS preflight permits the method and `Content-Type` header. Installed Hono supports both; check before adding configuration or upgrading dependencies.
- Report actual checks and distinguish local SQLite evidence from live D1 verification. Do not apply remote migrations or deploy as incidental verification.
