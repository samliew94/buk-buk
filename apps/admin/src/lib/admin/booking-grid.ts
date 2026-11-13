export type Room = { id: string; name: string; room_category_name: string };
export type Reservation = {
	id: string;
	room_id: string;
	room_name: string;
	room_category_name: string;
	from: string;
	to: string;
	duration: number;
};
export type Booking = {
	id: string;
	customer_name: string;
	customer_phone: string;
	status: string;
	expire_at: string;
	reservations: Reservation[];
};
export type DayBookings = { rooms: Room[]; bookings: Booking[] };
const hour = 3_600_000;
export function layoutDay(result: DayBookings, dayStart: number, now = Date.now()) {
	const blocks = result.bookings
		.filter((booking) => booking.status !== 'pending' || now < Date.parse(booking.expire_at))
		.flatMap((booking) =>
			booking.reservations.map((reservation) => ({
				booking,
				reservation,
				start: Math.max(dayStart, Date.parse(reservation.from)),
				end: Date.parse(reservation.to)
			}))
		);
	const earliest = blocks.reduce((first, block) => Math.min(first, block.start), Infinity);
	const start = Number.isFinite(earliest)
		? dayStart + Math.floor((earliest - dayStart) / hour) * hour
		: dayStart;
	// Include the whole hour following an endpoint, even when it is on the hour.
	const latest = blocks.reduce((end, block) => Math.max(end, block.end), start);
	const hours = Math.max(24, Math.floor((latest - start) / hour) + 1);
	return {
		start,
		hours,
		rows: result.rooms.map((room) => {
			const ends: number[] = [];
			const reservations = blocks
				.filter((block) => block.reservation.room_id === room.id)
				.sort(
					(a, b) =>
						a.start - b.start || a.end - b.end || a.reservation.id.localeCompare(b.reservation.id)
				)
				.map((block) => {
					let lane = ends.findIndex((end) => end <= block.start);
					if (lane < 0) lane = ends.length;
					ends[lane] = block.end;
					return {
						...block,
						lane,
						left: ((block.start - start) / hour) * 120,
						width: ((block.end - block.start) / hour) * 120
					};
				});
			return { room, reservations, lanes: Math.max(1, ends.length) };
		})
	};
}
