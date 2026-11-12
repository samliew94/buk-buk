ALTER TABLE customer ADD COLUMN created_at TEXT;

-- Existing customers have no recorded creation time; use migration time.
UPDATE customer
SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE created_at IS NULL;
