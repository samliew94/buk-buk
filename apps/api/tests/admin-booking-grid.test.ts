import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutDay, type Booking } from '../../web/src/lib/admin/booking-grid'

const start = Date.parse('2026-11-11T16:00:00.000Z')
const hour = 3_600_000
const room = { id: 'r1', name: 'Room', room_category_name: 'Family' }
function booking(id: string, from: number, to: number): Booking {
  return { id, customer_name: 'Guest', customer_phone: '0123', status: 'confirmed', expire_at: new Date(start).toISOString(), reservations: [{ id, room_id: room.id, room_name: room.name, room_category_name: room.room_category_name, from: new Date(start + from * hour).toISOString(), to: new Date(start + to * hour).toISOString(), duration: (to - from) * 60 }] }
}

test('day layout clips previous starts, preserves intervals and sizes quarter hours with minimal overlap lanes', () => {
  const previous = booking('previous', -1, 0.25)
  const data = { rooms: [room, { ...room, id: 'empty' }], bookings: [booking('quarter', 0.25, 0.5), booking('overlap', 0, 1), previous] }
  const grid = layoutDay(data, start)
  assert.equal(grid.hours, 24)
  assert.equal(grid.rows[0].lanes, 2)
  assert.equal(grid.rows[1].lanes, 1)
  assert.deepEqual(grid.rows[1].reservations, [])
  const [clipped, overlap, quarter] = grid.rows[0].reservations
  assert.deepEqual([clipped.left, clipped.width, clipped.lane], [0, 30, 0])
  assert.deepEqual([quarter.left, quarter.width, quarter.lane], [30, 30, 0])
  assert.equal(overlap.lane, 1)
  assert.equal(clipped.reservation.from, new Date(start - hour).toISOString())
  assert.equal(clipped.reservation.duration, 75)
})

test('extension includes the next whole hour after the latest matched end', () => {
  assert.equal(layoutDay({ rooms: [room], bookings: [booking('first', 0, 1), booking('spill', 23.75, 26.5)] }, start).hours, 27)
  assert.equal(layoutDay({ rooms: [room], bookings: [booking('first', 0, 1), booking('exact', 23, 26)] }, start).hours, 27)
  assert.equal(layoutDay({ rooms: [], bookings: [] }, start).hours, 24)

})


test('grid begins at the earliest clipped booking hour across rooms, with midnight fallback', () => {
  const grid = layoutDay({ rooms: [room], bookings: [booking('later', 13, 14), booking('first', 10.25, 11)] }, start)
  assert.equal(grid.start, start + 10 * hour)
  assert.equal(grid.hours, 24)
  assert.equal(grid.rows[0].reservations[0].left, 30)
  assert.equal(grid.rows[0].reservations[0].width, 90)
  assert.equal(grid.rows[0].reservations[1].left, 360)
  assert.equal(layoutDay({ rooms: [room], bookings: [booking('previous', -2, 1)] }, start).start, start)
  assert.equal(layoutDay({ rooms: [room], bookings: [] }, start).start, start)
})


test('pending blocks disappear at hold expiry while confirmed and cancelled remain', () => {
  const pending = { ...booking('pending', 0, 1), status: 'pending', expire_at: new Date(start + hour).toISOString() }
  const data = { rooms: [room], bookings: [pending, booking('confirmed', 2, 3), { ...booking('cancelled', 4, 5), status: 'cancelled' }] }
  const ids = (now: number) => layoutDay(data, start, now).rows[0].reservations.map(block => block.booking.id)
  assert.deepEqual(ids(start + hour - 1), ['pending', 'confirmed', 'cancelled'])
  assert.deepEqual(ids(start + hour), ['confirmed', 'cancelled'])
  assert.deepEqual(ids(start + hour + 1), ['confirmed', 'cancelled'])
  assert.equal(pending.status, 'pending')
  const empty = layoutDay({ rooms: [room], bookings: [pending] }, start, start + hour)
  assert.equal(empty.rows.length, 1)
  assert.deepEqual(empty.rows[0].reservations, [])
})
