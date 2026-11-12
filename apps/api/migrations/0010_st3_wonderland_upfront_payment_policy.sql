INSERT INTO upfront_payment_policy (business_id, price)
SELECT id, 0.00
FROM business
WHERE id = '01a19f40-3132-76b0-8d17-3a042ee0cad6'
ON CONFLICT (business_id) DO UPDATE SET price = excluded.price;
