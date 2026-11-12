-- Convert the previous hold duration into an absolute UTC expiry timestamp.
ALTER TABLE booking ADD COLUMN expiry_timestamp TEXT NOT NULL DEFAULT '';

UPDATE booking
SET expiry_timestamp = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, printf('%+d minutes', expire_at));

ALTER TABLE booking DROP COLUMN expire_at;
ALTER TABLE booking RENAME COLUMN expiry_timestamp TO expire_at;
