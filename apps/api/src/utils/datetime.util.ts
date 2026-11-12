import { DateTime } from "luxon";

/**
 * 
 * @param dateTime eg 2026-10-28T14:00 with zone 'Asia/Kuala_Lumpur'
 * @returns 2026-10-28T06:00:00.000Z
 */
export function toDB(dateTime: DateTime) {
  return dateTime.toUTC().toISO();
}