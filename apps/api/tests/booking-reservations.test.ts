import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupBookingReservations, type BookingReservation } from '../../web/src/lib/customer/booking-reservations'

const row = (id: string, overrides: Partial<BookingReservation> = {}): BookingReservation => ({
  id, room_category_id: 'racing', room_category_name: 'Racing', room_category_acronym: 'RACING',
  room_name: id, from: '2026-11-12T02:00:00.000Z', to: '2026-11-12T03:00:00.000Z', duration: 60, ...overrides,
})
test('Racing machines share one quantity summary without mutating stored reservations', () => {
  const rows = ['R1','R2','R3','R4'].map(id => row(id))
  const groups = groupBookingReservations(rows)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].quantity, 4)
  assert.deepEqual(groups[0].rooms, ['R1','R2','R3','R4'])
  assert.equal(rows.length, 4)
  assert.equal(groupBookingReservations([row('R1')])[0].quantity, 1)
})
test('different categories, intervals and non-Racing reservations stay separate', () => {
  const rows = [row('R1'), row('R2', { room_category_id: 'other' }), row('R3', { to: '2026-11-12T04:00:00.000Z' }), row('R4', { from: '2026-11-12T02:15:00.000Z' }), row('F1', { room_category_acronym: 'FR' }), row('F2', { room_category_acronym: 'FR' })]
  assert.equal(groupBookingReservations(rows).length, 6)
  assert.deepEqual(groupBookingReservations([]), [])
})
