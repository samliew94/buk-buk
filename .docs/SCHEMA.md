Column types below match migrations `0001`–`0013`. Datetime values (`created_at`,
`from`, and `to`) are stored as UTC text.
Status enums are stored as `TEXT`; the values below come from the application
enum definitions and are not enforced by database `CHECK` constraints.

business
- id TEXT
- name TEXT
- open_at TEXT (nullable recurring UTC HH:mm, migration 0012)
- close_at TEXT (nullable recurring UTC HH:mm, migration 0012)

room_category
- id TEXT
- business_id TEXT → business.id
- name TEXT
- acronym TEXT (nullable)
- sort_order INTEGER

room
- id TEXT
- room_category_id TEXT → room_category.id
- name TEXT
- sort_order INTEGER

room_category_rental_fee
- id TEXT
- room_category_id TEXT → room_category.id
- duration INTEGER
- price REAL

customer
- id TEXT
- name TEXT
- phone TEXT
- created_at TEXT

booking
- id TEXT
- customer_id TEXT
- status TEXT (`pending`, `confirmed`, `cancelled`)
- created_at TEXT
- expire_at TEXT (absolute UTC ISO deadline)

room_reservation
- id TEXT
- booking_id TEXT
- room_id TEXT → room.id (assigned physical room)
- room_category_id TEXT → room_category.id (original request, required)
- from TEXT
- to TEXT

upfront_payment_policy
- business_id TEXT
- price REAL

business_payment_gateway
- business_id TEXT

payment
- id TEXT
- booking_id TEXT
- price REAL
- status TEXT (`pending`, `paid`, `cancelled`, `rejected`)
- created_at TEXT

demo_payment_order
- id TEXT
- reference_id TEXT
- price REAL
- status TEXT (`pending`, `paid`, `cancelled`, `rejected`)
- created_at TEXT

Migration 0013 creates one category per old room using the same ID and copies its business/name/acronym/order. Physical IDs and order remain; names become the old acronym when present, otherwise the old name. Fee IDs, durations and prices are copied unchanged. Reservations retain their IDs, booking IDs, assigned rooms and intervals and record the corresponding original category. Booking/payment tables are unchanged. Rebuilt foreign keys are checked by local tests. Grouping rooms under Family is a later explicit configuration step.

Indexes cover category/business ordering, room/category ordering, fee/category lookup, reservation room/interval lookup and existing booking/start lookups.
