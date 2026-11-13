import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './sqlite'
import type { Env } from '../src/types/env'
import { createDependencies } from '../src/dependencies'
import { Guid } from '../src/value-objects/Guid'
import { MyDateTime } from '../src/utils/MyDateTime'
import { PositiveDuration } from '../src/value-objects/PositiveDuration'
import { DateTime } from 'luxon'

for (const price of [0, 10]) {
for (const skipPayment of [true, false, undefined]) {
  test(`CreateBooking with skipPayment=${skipPayment}, policy=${price} respects payment requirements`, async t => {
    const { db, d1 } = fixture()
    t.after(() => db.close())
    db.exec(`INSERT INTO business(id,name) VALUES ('a','A');
      INSERT INTO customer(id,name,phone) VALUES ('c','Guest','123');
      INSERT INTO room_category VALUES ('r','a','Racing','RACING',0);
      INSERT INTO room VALUES ('1','r','R1',1),('2','r','R2',2);
      INSERT INTO upfront_payment_policy VALUES ('a',${price});`)
    const { createBooking } = createDependencies({ DB: d1 } as Env)
    const result = await createBooking.exec(
      Guid.from('a'), Guid.from('c'),
      new MyDateTime(DateTime.fromISO('2030-01-01T02:00:00Z')),
      PositiveDuration.fromMinutes(60), Guid.from('r'), 2, skipPayment,
    )
    const paymentNeeded = !skipPayment && price > 0
    assert.equal(db.prepare('SELECT status FROM booking WHERE id=?').get(result.booking_id.value)!.status,
      paymentNeeded ? 'pending' : 'confirmed')
    assert.equal(db.prepare('SELECT count(*) n FROM room_reservation WHERE booking_id=?').get(result.booking_id.value)!.n, 2)
    for (const table of ['payment', 'demo_payment_order']) {
      assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get()!.n, paymentNeeded ? 1 : 0)
    }
    if (!paymentNeeded) assert.equal(result.payment_url, null)
    else assert.equal(typeof result.payment_url, 'string')
  })
}
}
