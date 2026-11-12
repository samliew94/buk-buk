PRAGMA defer_foreign_keys = ON;
CREATE TABLE room_category (
 id TEXT PRIMARY KEY NOT NULL,
 business_id TEXT NOT NULL REFERENCES business(id),
 name TEXT NOT NULL,
 acronym TEXT,
 sort_order INTEGER NOT NULL
);
INSERT INTO room_category SELECT id, business_id, name, acronym, sort_order FROM room;
CREATE TABLE room_new (
 id TEXT PRIMARY KEY NOT NULL,
 room_category_id TEXT NOT NULL REFERENCES room_category(id),
 name TEXT NOT NULL,
 sort_order INTEGER NOT NULL
);
INSERT INTO room_new SELECT id, id, COALESCE(NULLIF(acronym, ''), name), sort_order FROM room;
CREATE TABLE room_category_rental_fee (
 id TEXT PRIMARY KEY NOT NULL,
 room_category_id TEXT NOT NULL REFERENCES room_category(id),
 duration INTEGER NOT NULL,
 price REAL NOT NULL
);
INSERT INTO room_category_rental_fee SELECT id, room_id, duration, price FROM room_rental_fee;
CREATE TABLE room_reservation_new (
 id TEXT PRIMARY KEY NOT NULL,
 booking_id TEXT NOT NULL REFERENCES booking(id),
 room_id TEXT NOT NULL REFERENCES room_new(id),
 "from" TEXT NOT NULL,
 "to" TEXT NOT NULL,
 room_category_id TEXT NOT NULL REFERENCES room_category(id)
);
INSERT INTO room_reservation_new SELECT id, booking_id, room_id, "from", "to", room_id FROM room_reservation;
DROP TABLE room_reservation;
DROP TABLE room_rental_fee;
DROP TABLE room;
ALTER TABLE room_new RENAME TO room;
ALTER TABLE room_reservation_new RENAME TO room_reservation;
CREATE INDEX room_category_business_order ON room_category(business_id, sort_order, name, id);
CREATE INDEX room_category_order ON room(room_category_id, sort_order, name, id);
CREATE INDEX room_category_fee_lookup ON room_category_rental_fee(room_category_id, id);
CREATE INDEX room_reservation_interval ON room_reservation(room_id, "from", "to");
CREATE INDEX room_reservation_booking_id ON room_reservation(booking_id);
CREATE INDEX room_reservation_from ON room_reservation("from");
