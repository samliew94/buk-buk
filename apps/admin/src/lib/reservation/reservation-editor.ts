import { DateTime } from 'luxon';
export const zone = 'Asia/Kuala_Lumpur';
export type Draft = {
	category: string;
	room: string;
	selectedRooms?: string[];
	date: string;
	time: string;
	duration: number;
};
export type Room = { id: string; room_category_id: string; name: string };
export type Busy = {
	id: string;
	room_id: string;
	from: string;
	to: string;
	status: string;
	expire_at: string;
};
export function blankDraft(now = Date.now()): Draft {
	return { category: '', room: '', selectedRooms: [], date: days(now)[0], time: '', duration: 0 };
}
export function physicalRows(row: Draft): Draft[] {
	return (row.selectedRooms ?? (row.room ? [row.room] : [])).map((room) => ({
		...row,
		room,
		selectedRooms: undefined
	}));
}
export function start(row: Draft) {
	return DateTime.fromISO(`${row.date}T${row.time}`, { zone }).toMillis();
}
export function days(now = Date.now()) {
	const today = DateTime.fromMillis(now, { zone }).startOf('day');
	return Array.from({ length: 7 }, (_, i) => today.plus({ days: i }).toISODate()!);
}
export function free(row: Draft, busy: Busy[], bookingId: string, now = Date.now()) {
	const from = start(row),
		to = from + row.duration * 60000;
	return !busy.some(
		(r) =>
			r.id !== bookingId &&
			r.room_id === row.room &&
			(r.status === 'confirmed' || (r.status === 'pending' && Date.parse(r.expire_at) > now)) &&
			from < Date.parse(r.to) &&
			to > Date.parse(r.from)
	);
}
export function roomOptions(
	row: Draft,
	open: string | null,
	close: string | null,
	busy: Busy[],
	bookingId: string,
	now = Date.now()
) {
	const result: { time: string; durations: number[] }[] = [];
	if (
		!open ||
		!close ||
		!/^\d{2}:\d{2}$/.test(open) ||
		!/^\d{2}:\d{2}$/.test(close) ||
		!days(now).includes(row.date) ||
		!row.room
	)
		return result;
	const local = (value: string) => {
		const t = DateTime.fromISO(`${row.date}T${value}`, { zone: 'UTC' }).setZone(zone);
		return DateTime.fromISO(row.date, { zone }).set({ hour: t.hour, minute: t.minute }).toMillis();
	};
	const end = local(close);
	for (let t = local(open); t + 3600000 <= end; t += 900000) {
		if (t < now) continue;
		const time = DateTime.fromMillis(t, { zone }).toFormat('HH:mm:ss.SSS');
		const durations: number[] = [];
		for (let duration = 60; t + duration * 60000 <= end; duration += 60)
			if (free({ ...row, time, duration }, busy, bookingId, now)) durations.push(duration);
		if (durations.length) result.push({ time, durations });
	}
	return result;
}
export function options(
	row: Draft,
	open: string | null,
	close: string | null,
	busy: Busy[],
	bookingId: string,
	now = Date.now()
) {
	const selected = physicalRows(row);
	if (!selected.length) return [];
	const choices = selected.map((r) => roomOptions(r, open, close, busy, bookingId, now));
	return choices[0]
		.map((slot) => ({
			...slot,
			durations: slot.durations.filter((duration) =>
				choices.every((list) =>
					list.some((s) => s.time === slot.time && s.durations.includes(duration))
				)
			)
		}))
		.filter((slot) => slot.durations.length);
}
export function overlaps(draft: Draft[]) {
	const rows = draft.flatMap(physicalRows);
	return rows.some((r, i) =>
		rows.some(
			(s, j) =>
				i < j &&
				r.room &&
				r.room === s.room &&
				start(r) < start(s) + s.duration * 60000 &&
				start(s) < start(r) + r.duration * 60000
		)
	);
}
export function payload(rows: Draft[]) {
	return {
		reservations: rows.flatMap(physicalRows).map((r) => ({
			room_id: r.room,
			from: DateTime.fromMillis(start(r)).toUTC().toISO()!,
			duration: r.duration
		}))
	};
}

export function firstAvailable(
	row: Draft,
	rooms: Room[],
	open: string | null,
	close: string | null,
	busy: Busy[],
	bookingId: string,
	otherRows: Draft[] = [],
	now = Date.now()
): Pick<Draft, 'room' | 'selectedRooms' | 'time' | 'duration'> {
	const draftBusy: Busy[] = otherRows
		.flatMap(physicalRows)
		.filter((r) => Number.isFinite(start(r)) && r.duration > 0)
		.map((r) => ({
			id: '',
			room_id: r.room,
			from: new Date(start(r)).toISOString(),
			to: new Date(start(r) + r.duration * 60000).toISOString(),
			status: 'confirmed',
			expire_at: ''
		}));
	for (const room of rooms.filter((r) => r.room_category_id === row.category)) {
		const slot = roomOptions(
			{ ...row, room: room.id },
			open,
			close,
			[...busy, ...draftBusy],
			bookingId,
			now
		)[0];
		if (slot)
			return {
				room: room.id,
				selectedRooms: [room.id],
				time: slot.time,
				duration: slot.durations.includes(row.duration) ? row.duration : 60
			};
	}
	return { room: '', selectedRooms: [], time: '', duration: 0 };
}

export function firstAvailableCategory(
	row: Draft,
	categories: { id: string }[],
	rooms: Room[],
	open: string | null,
	close: string | null,
	busy: Busy[],
	bookingId: string,
	otherRows: Draft[] = [],
	now = Date.now()
): Pick<Draft, 'category' | 'room' | 'selectedRooms' | 'time' | 'duration'> {
	for (const category of categories) {
		const selection = firstAvailable(
			{ ...row, category: category.id },
			rooms,
			open,
			close,
			busy,
			bookingId,
			otherRows,
			now
		);
		if (selection.room) return { category: category.id, ...selection };
	}
	return { category: '', room: '', selectedRooms: [], time: '', duration: 0 };
}
