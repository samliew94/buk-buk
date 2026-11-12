ALTER TABLE demo_payment_order RENAME COLUMN external_order_id TO reference_id;

DROP INDEX demo_payment_order_external_order_id_created_at;
CREATE INDEX demo_payment_order_reference_id_created_at
  ON demo_payment_order (reference_id, created_at DESC);
