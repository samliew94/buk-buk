CREATE TABLE room_rental_fee (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL REFERENCES room(id),
  rate TEXT NOT NULL DEFAULT 'hourly',
  price REAL NOT NULL
);

CREATE INDEX room_rental_fee_room_id ON room_rental_fee (room_id);
