import { URL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from './sqlite'

test('category migration preserves existing identities, money, intervals and foreign keys inside a transaction', (t) => {
  const { db } = fixture(true)
  t.after(() => db.close())
  db.exec(`INSERT INTO business(id,name) VALUES ('b','Business');
 INSERT INTO room VALUES ('r1','b','Family','FR1',2),('r2','b','Studio',NULL,1);
 INSERT INTO room_rental_fee VALUES ('fee','r1',90,12.5);
 INSERT INTO customer(id,name,phone) VALUES ('c','Guest','0123');
 INSERT INTO booking VALUES ('booking','c','pending','2026-11-11T00:00:00.000Z','2026-11-11T00:10:00.000Z');
 INSERT INTO room_reservation VALUES ('res','booking','r1','2026-11-11T07:00:00.000Z','2026-11-11T08:00:00.000Z');
 INSERT INTO payment VALUES ('pay','booking',1.5,'pending','now');
 INSERT INTO demo_payment_order VALUES ('order','pay',1.5,'pending','now');`)
  const snapshots = ['booking', 'payment', 'demo_payment_order'].map((table) =>
    db.prepare(`SELECT * FROM ${table}`).all(),
  )
  db.exec('BEGIN')
  db.exec(
    readFileSync(
      new URL('../migrations/0013_room_categories.sql', import.meta.url),
      'utf8',
    ),
  )
  db.exec('COMMIT')
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
  assert.deepEqual(
    db
      .prepare('SELECT * FROM room ORDER BY id')
      .all()
      .map((r) => ({ ...r })),
    [
      { id: 'r1', room_category_id: 'r1', name: 'FR1', sort_order: 2 },
      { id: 'r2', room_category_id: 'r2', name: 'Studio', sort_order: 1 },
    ],
  )
  assert.deepEqual(
    { ...db.prepare('SELECT * FROM room_category WHERE id=?').get('r1') },
    {
      id: 'r1',
      business_id: 'b',
      name: 'Family',
      acronym: 'FR1',
      sort_order: 2,
    },
  )
  assert.deepEqual(
    { ...db.prepare('SELECT * FROM room_category_rental_fee').get() },
    { id: 'fee', room_category_id: 'r1', duration: 90, price: 12.5 },
  )
  assert.deepEqual(
    { ...db.prepare('SELECT * FROM room_reservation').get() },
    {
      id: 'res',
      booking_id: 'booking',
      room_id: 'r1',
      from: '2026-11-11T07:00:00.000Z',
      to: '2026-11-11T08:00:00.000Z',
      room_category_id: 'r1',
    },
  )
  assert.deepEqual(
    ['booking', 'payment', 'demo_payment_order'].map((table) =>
      db.prepare(`SELECT * FROM ${table}`).all(),
    ),
    snapshots,
  )
})
