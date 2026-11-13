import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { URL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const dir = new URL('../migrations/', import.meta.url)
const migration = readFileSync(new URL('0017_booking_business_id.sql', dir), 'utf8')
for (const scenario of ['single reservation', 'same business', 'missing', 'conflicting']) {
  test(`booking ownership migration: ${scenario}`, t => {
    const db = new DatabaseSync(':memory:')
    t.after(() => db.close())
    db.exec('PRAGMA foreign_keys = ON')
    for (const name of readdirSync(dir).filter(n => n.endsWith('.sql') && n < '0014').sort()) db.exec(readFileSync(new URL(name, dir), 'utf8'))
    db.exec(`
      INSERT INTO business(id,name) VALUES ('a','A'),('b','B');
      INSERT INTO customer(id,name,phone) VALUES ('c','Guest','123');
      INSERT INTO room_category VALUES ('ca','a','A',NULL,0),('cb','b','B',NULL,0);
      INSERT INTO room VALUES ('r1','ca','One',0),('r2','ca','Two',1);
      INSERT INTO booking VALUES ('booking','c','pending','created','expiry');
      INSERT INTO payment VALUES ('p','booking',12.5,'pending','created');
      INSERT INTO demo_payment_order VALUES ('o','p',12.5,'pending','created');
    `)
    if (scenario !== 'missing') db.exec(`INSERT INTO room_reservation VALUES ('one','booking','r1','from','to','cb'),('two','booking','r2','from','to','ca')`)
    if (scenario === 'single reservation') db.exec("DELETE FROM room_reservation WHERE id = 'two'")
    if (scenario === 'conflicting') db.exec("UPDATE room SET room_category_id = 'cb' WHERE id = 'r2'")
    const tables = ['booking','room_reservation','payment','demo_payment_order']
    const before = tables.map(table => db.prepare(`SELECT * FROM ${table} ORDER BY id`).all())
    const indexes = db.prepare("SELECT name,sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all()
    db.exec('BEGIN')
    if (scenario === 'same business' || scenario === 'single reservation') {
      db.exec(migration)
      db.exec('COMMIT')
      assert.equal(db.prepare('SELECT business_id FROM booking').get()!.business_id, 'a')
      for (const [i, table] of tables.entries()) {
        const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all().map(row => { if (table === 'booking') delete row.business_id; return row })
        assert.deepEqual(rows, before[i])
      }
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
      const columns = db.prepare('PRAGMA table_info(booking)').all()
      assert.equal(columns.find(c => c.name === 'business_id')!.notnull, 1)
      assert.throws(() => db.exec("UPDATE booking SET business_id = 'missing'"), /FOREIGN KEY/)
      assert.throws(() => db.exec('UPDATE booking SET business_id = NULL'), /NOT NULL/)
      for (const index of indexes) assert.ok(db.prepare('SELECT 1 FROM sqlite_master WHERE name = ? AND sql = ?').get(index.name!, index.sql!))
      assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'booking_business_id'").get())
    } else {
      assert.throws(() => db.exec(migration), /NOT NULL constraint failed/)
      db.exec('ROLLBACK')
      for (const [i, table] of tables.entries()) assert.deepEqual(db.prepare(`SELECT * FROM ${table} ORDER BY id`).all(), before[i])
      assert.deepEqual(db.prepare("SELECT name,sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all(), indexes)
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
      assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE '%_new'").get()!.n, 0)
    }
  })
}
