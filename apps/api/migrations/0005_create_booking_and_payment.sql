CREATE TABLE customer (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL
);

CREATE TABLE booking (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customer(id),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX booking_customer_id ON booking (customer_id);
CREATE INDEX booking_created_at ON booking (created_at DESC);

CREATE TABLE room_reservation (
  id TEXT PRIMARY KEY NOT NULL,
  booking_id TEXT NOT NULL REFERENCES booking(id),
  room_id TEXT NOT NULL REFERENCES room(id),
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL
);

CREATE INDEX room_reservation_booking_id ON room_reservation (booking_id);
CREATE INDEX room_reservation_from ON room_reservation ("from");

CREATE TABLE upfront_payment_policy (
  business_id TEXT PRIMARY KEY NOT NULL REFERENCES business(id),
  price REAL NOT NULL
);

-- A row opts the business into the current demo payment gateway.
CREATE TABLE business_payment_gateway (
  business_id TEXT PRIMARY KEY NOT NULL REFERENCES business(id)
);

CREATE TABLE payment (
  id TEXT PRIMARY KEY NOT NULL,
  booking_id TEXT NOT NULL REFERENCES booking(id),
  price REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX payment_booking_id_created_at ON payment (booking_id, created_at DESC);

CREATE TABLE demo_payment_order (
  id TEXT PRIMARY KEY NOT NULL,
  external_order_id TEXT NOT NULL REFERENCES payment(id),
  price REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX demo_payment_order_external_order_id_created_at ON demo_payment_order (external_order_id, created_at DESC);
