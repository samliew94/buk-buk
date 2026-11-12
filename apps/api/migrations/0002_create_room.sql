CREATE TABLE room (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES business(id),
  name TEXT NOT NULL,
  acronym TEXT,
  sort_order INTEGER NOT NULL
);

CREATE INDEX room_business_sort_order_name ON room (business_id, sort_order, name);
