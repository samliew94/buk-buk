import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  categorySlots,
  retainDuration,
  type Reservation,
} from '../../web/src/lib/customer/availability'
const opening = Date.parse('2026-11-11T07:00:00.000Z'),
  closing = opening + 120 * 60_000
const family = {
  id: 'family',
  name: 'Family',
  acronym: 'FR',
  room_ids: ['FR1', 'FR2', 'FR3'],
}
const reservation = (
  roomId: string,
  from = opening,
  to = opening + 60 * 60_000,
  status = 'confirmed',
  expireAt = '9999-01-01T00:00:00.000Z',
): Reservation => ({
  room_id: roomId,
  from: new Date(from).toISOString(),
  to: new Date(to).toISOString(),
  status,
  expire_at: expireAt,
})
test('Family remains bookable when FR3 alone is free; all rooms blocked removes the pair', () => {
  const rows = [reservation('FR1'), reservation('FR2')]
  assert.deepEqual(
    categorySlots([family], rows, opening, closing)[0].durations,
    [60, 120],
  )
  const slots = categorySlots(
    [family],
    [...rows, reservation('FR3')],
    opening,
    closing,
  )
  assert.equal(slots[0].time, '16:00')
  assert.equal(
    categorySlots([{ ...family, room_ids: [] }], [], opening, closing).length,
    0,
  )
})
test('durations require one continuously available room and permit meeting boundaries', () => {
  const rows = [
    reservation('FR1', opening, opening + 30 * 60_000),
    reservation('FR2', opening + 30 * 60_000),
    reservation('FR3', opening + 30 * 60_000),
  ]
  const continuous = categorySlots([family], rows, opening, closing)
  assert.equal(continuous[0].start, opening + 30 * 60_000)
  assert.deepEqual(continuous[0].durations, [60])
  assert.equal(categorySlots([family], rows, opening, opening + 60 * 60_000).length, 0)
  assert.deepEqual(
    categorySlots(
      [family],
      [
        reservation('FR1', opening + 60 * 60_000),
        reservation('FR2'),
        reservation('FR3'),
      ],
      opening,
      closing,
    )[0].durations,
    [60],
  )
})
test('15-minute starts and hourly durations stop at closing; cancelled and expired pending rows do not block', () => {
  const slots = categorySlots(
    [family],
    [
      reservation('FR1', opening, closing, 'cancelled'),
      reservation(
        'FR2',
        opening,
        closing,
        'pending',
        '2000-01-01T00:00:00.000Z',
      ),
      reservation('FR3', opening, closing),
    ],
    opening,
    closing,
  )
  assert.equal(slots.length, 5)
  assert.equal(slots.at(-1)!.time, '16:00')
  assert.deepEqual(slots.at(-1)!.durations, [60])
  assert.equal(retainDuration(120, slots[0]), 120)
  assert.equal(retainDuration(120, slots.at(-1)), 60)
  assert.equal(
    categorySlots(
      [family],
      family.room_ids.map((id) => reservation(id, opening, closing, 'pending')),
      opening,
      closing,
    ).length,
    0,
  )
  assert.equal(
    categorySlots([family], [], opening, opening + 59 * 60_000).length,
    0,
  )
})

test('partial hours are rounded down while quarter-hour starts remain available', () => {
  const slots = categorySlots([family], [], opening, opening + 119 * 60_000)
  assert.equal(slots.length, 4)
  assert.deepEqual(slots[0].durations, [60])
  assert.equal(slots[1].start, opening + 15 * 60_000)
  assert.equal(retainDuration(15, slots[0]), 60)
  assert.equal(retainDuration(120, undefined), 60)
})
