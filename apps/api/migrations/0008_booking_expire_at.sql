-- Pending booking hold duration in minutes, measured from booking.created_at.
-- Backfill existing bookings before the timestamp conversion in migration 0009.
ALTER TABLE booking ADD COLUMN expire_at INTEGER NOT NULL DEFAULT 10;
