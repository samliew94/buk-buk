CREATE TABLE room_rental_fee_new (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES room(id),
  duration INTEGER NOT NULL,
  price REAL NOT NULL
);

INSERT INTO room_rental_fee_new (id, room_id, duration, price)
SELECT id, room_id, 1, price FROM room_rental_fee;

DROP TABLE room_rental_fee;
ALTER TABLE room_rental_fee_new RENAME TO room_rental_fee;
CREATE INDEX room_rental_fee_room_id ON room_rental_fee (room_id);
