ALTER TABLE business ADD COLUMN open_at TEXT;
ALTER TABLE business ADD COLUMN close_at TEXT;

-- 10:00 to 22:00 in Asia/Kuala_Lumpur.
UPDATE business
SET open_at = '02:00', close_at = '14:00'
WHERE id = '01a19f40-3132-76b0-8d17-3a042ee0cad6';
