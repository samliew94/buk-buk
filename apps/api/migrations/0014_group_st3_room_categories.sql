-- Consolidate ST3 Wonderland's original per-room categories.
-- Physical rooms, reservations and rental fee records retain their IDs.
CREATE TABLE category_merge (old_id TEXT PRIMARY KEY, category_id TEXT NOT NULL);
INSERT INTO category_merge VALUES
 ('01a19f54-2297-77e6-b1c7-33cce106f98f', '01a19f54-1365-7150-a7f7-1f7d82a546c3'),
 ('01a19f54-3807-74e1-aabf-1aeb1d2051cf', '01a19f54-1365-7150-a7f7-1f7d82a546c3'),
 ('01a19f53-2b78-73bb-a0c6-c2a9217317db', '01a19f4f-263a-7593-8d23-20415199fc7b'),
 ('01a19f53-376a-71e3-8534-3d4a8f3e0d88', '01a19f4f-263a-7593-8d23-20415199fc7b'),
 ('01a19f53-51c5-73f7-a9d5-b03bc7ddf672', '01a19f4f-263a-7593-8d23-20415199fc7b');

UPDATE room SET room_category_id = (SELECT category_id FROM category_merge WHERE old_id = room.room_category_id)
WHERE room_category_id IN (SELECT old_id FROM category_merge);
UPDATE room_reservation SET room_category_id = (SELECT category_id FROM category_merge WHERE old_id = room_reservation.room_category_id)
WHERE room_category_id IN (SELECT old_id FROM category_merge);
UPDATE room_category_rental_fee SET room_category_id = (SELECT category_id FROM category_merge WHERE old_id = room_category_rental_fee.room_category_id)
WHERE room_category_id IN (SELECT old_id FROM category_merge);
DELETE FROM room_category WHERE id IN (SELECT old_id FROM category_merge);
DROP TABLE category_merge;

UPDATE room_category SET name = 'Family', acronym = 'FAMILY', sort_order = 1
WHERE id = '01a19f54-1365-7150-a7f7-1f7d82a546c3';
UPDATE room_category SET name = 'Open', acronym = 'OPEN', sort_order = 2
WHERE id = '01a19f4f-263a-7593-8d23-20415199fc7b';
UPDATE room_category SET name = 'VIP', acronym = 'VIP', sort_order = 3
WHERE id = '01a19f54-5655-759c-987e-753f3fa7bd7b';
