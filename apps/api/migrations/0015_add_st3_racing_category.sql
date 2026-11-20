-- Bootstrap the parent and its defaults on a fresh database. Existing settings win.
INSERT INTO business (id, name, open_at, close_at)
VALUES ('01a19f40-3132-76b0-8d17-3a042ee0cad6', 'ST3 Wonderland', '02:00', '14:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO upfront_payment_policy (business_id, price)
VALUES ('01a19f40-3132-76b0-8d17-3a042ee0cad6', 0.00)
ON CONFLICT (business_id) DO NOTHING;

-- Add RACING after the existing Family, Open and VIP categories.
INSERT INTO room_category (id, business_id, name, acronym, sort_order)
VALUES (
 '01a1cd48-a6ec-77f4-b2b3-bd967f8ab112',
 '01a19f40-3132-76b0-8d17-3a042ee0cad6',
 'RACING',
 'RACING',
 4
);
