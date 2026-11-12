-- Booking migration 0005 already creates this table on existing databases.
CREATE TABLE IF NOT EXISTS customer (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL
);
