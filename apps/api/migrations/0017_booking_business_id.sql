-- D1 runs this migration in a transaction with foreign keys enabled.
-- A NULL owner deliberately fails NOT NULL for missing or conflicting ownership.

CREATE TABLE booking_new (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customer(id),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
, expire_at TEXT NOT NULL DEFAULT '',
 business_id TEXT NOT NULL REFERENCES business(id)
);

INSERT INTO booking_new SELECT old."id", old."customer_id", old."status", old."created_at", old."expire_at", (SELECT CASE WHEN COUNT(DISTINCT category.business_id) = 1 THEN MIN(category.business_id) END
 FROM room_reservation reservation
 JOIN room ON room.id = reservation.room_id
 JOIN room_category category ON category.id = room.room_category_id
 WHERE reservation.booking_id = old.id) FROM booking old;

CREATE TABLE room_reservation_new (
 id TEXT PRIMARY KEY NOT NULL,
 booking_id TEXT NOT NULL REFERENCES booking_new(id),
 room_id TEXT NOT NULL REFERENCES "room"(id),
 "from" TEXT NOT NULL,
 "to" TEXT NOT NULL,
 room_category_id TEXT NOT NULL REFERENCES room_category(id)
);

INSERT INTO room_reservation_new SELECT old."id", old."booking_id", old."room_id", old."from", old."to", old."room_category_id" FROM room_reservation old;

CREATE TABLE payment_new (
  id TEXT PRIMARY KEY NOT NULL,
  booking_id TEXT NOT NULL REFERENCES booking_new(id),
  price REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO payment_new SELECT old."id", old."booking_id", old."price", old."status", old."created_at" FROM payment old;

CREATE TABLE demo_payment_order_new (
  id TEXT PRIMARY KEY NOT NULL,
  reference_id TEXT NOT NULL REFERENCES payment_new(id),
  price REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO demo_payment_order_new SELECT old."id", old."reference_id", old."price", old."status", old."created_at" FROM demo_payment_order old;

DROP TABLE demo_payment_order;

DROP TABLE payment;

DROP TABLE room_reservation;

DROP TABLE booking;

ALTER TABLE booking_new RENAME TO booking;

ALTER TABLE room_reservation_new RENAME TO room_reservation;

ALTER TABLE payment_new RENAME TO payment;

ALTER TABLE demo_payment_order_new RENAME TO demo_payment_order;

CREATE INDEX booking_customer_id ON booking (customer_id);

CREATE INDEX booking_created_at ON booking (created_at DESC);

CREATE INDEX room_reservation_interval ON room_reservation(room_id, "from", "to");

CREATE INDEX room_reservation_booking_id ON room_reservation(booking_id);

CREATE INDEX room_reservation_from ON room_reservation("from");

CREATE INDEX payment_booking_id_created_at ON payment (booking_id, created_at DESC);

CREATE INDEX demo_payment_order_reference_id_created_at
  ON demo_payment_order (reference_id, created_at DESC);

CREATE INDEX booking_business_id ON booking(business_id);
