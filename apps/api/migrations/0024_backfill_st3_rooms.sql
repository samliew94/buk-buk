-- Restore the ST3 rooms that migrations 0013 and 0014 expected to exist.
INSERT INTO room_category (id, business_id, name, acronym, sort_order) VALUES
  ('01a19f54-1365-7150-a7f7-1f7d82a546c3', '01a19f40-3132-76b0-8d17-3a042ee0cad6', 'Family', 'FAMILY', 1),
  ('01a19f4f-263a-7593-8d23-20415199fc7b', '01a19f40-3132-76b0-8d17-3a042ee0cad6', 'Open', 'OPEN', 2),
  ('01a19f54-5655-759c-987e-753f3fa7bd7b', '01a19f40-3132-76b0-8d17-3a042ee0cad6', 'VIP', 'VIP', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO room (id, room_category_id, name, sort_order) VALUES
  ('01a19f54-1365-7150-a7f7-1f7d82a546c3', '01a19f54-1365-7150-a7f7-1f7d82a546c3', 'FR1', 1),
  ('01a19f54-2297-77e6-b1c7-33cce106f98f', '01a19f54-1365-7150-a7f7-1f7d82a546c3', 'FR2', 1),
  ('01a19f54-3807-74e1-aabf-1aeb1d2051cf', '01a19f54-1365-7150-a7f7-1f7d82a546c3', 'FR3', 1),
  ('01a19f4f-263a-7593-8d23-20415199fc7b', '01a19f4f-263a-7593-8d23-20415199fc7b', 'OS1', 1),
  ('01a19f53-2b78-73bb-a0c6-c2a9217317db', '01a19f4f-263a-7593-8d23-20415199fc7b', 'OS2', 1),
  ('01a19f53-376a-71e3-8534-3d4a8f3e0d88', '01a19f4f-263a-7593-8d23-20415199fc7b', 'OS3', 1),
  ('01a19f53-51c5-73f7-a9d5-b03bc7ddf672', '01a19f4f-263a-7593-8d23-20415199fc7b', 'OS4', 1),
  ('01a19f54-5655-759c-987e-753f3fa7bd7b', '01a19f54-5655-759c-987e-753f3fa7bd7b', 'VIP', 1)
ON CONFLICT (id) DO NOTHING;
