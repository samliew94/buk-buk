export type Category = { id: string; name: string; acronym: string | null; room_ids: string[] };
export type Reservation = {
	room_id: string;
	status: string;
	expire_at: string;
	from: string;
	to: string;
};
export type CategorySlot = {
	time: string;
	start: number;
	category: Category;
	durations: number[];
	capacity: Record<number, number>;
};
const quarter = 15 * 60_000;

// A duration is supported only if the same physical room is free for its whole interval.
export function categorySlots(
	categories: Category[],
	reservations: Reservation[],
	opening: number,
	closing: number,
	now = Date.now()
): CategorySlot[] {
	const blocked = reservations
		.filter(
			(r) => r.status === 'confirmed' || (r.status === 'pending' && Date.parse(r.expire_at) > now)
		)
		.map((r) => ({ room_id: r.room_id, from: Date.parse(r.from), to: Date.parse(r.to) }));
	const slots: CategorySlot[] = [];
	for (let start = opening; start + 60 * 60_000 <= closing; start += quarter) {
		if (start < now) continue;
		for (const category of categories) {
			let maximum = 0;
			const capacity: Record<number, number> = {};
			for (const roomId of category.room_ids) {
				let end = closing;
				for (const r of blocked) {
					if (r.room_id !== roomId || r.to <= start || r.from >= end) continue;
					end = Math.max(start, r.from);
				}
				const minutes = Math.floor((end - start) / (60 * 60_000)) * 60;
				for (let duration = 60; duration <= minutes; duration += 60)
					capacity[duration] = (capacity[duration] ?? 0) + 1;
				maximum = Math.max(maximum, minutes);
			}
			if (maximum >= 60) {
				const time = new Intl.DateTimeFormat('en-GB', {
					timeZone: 'Asia/Kuala_Lumpur',
					hour: '2-digit',
					minute: '2-digit',
					hourCycle: 'h23'
				}).format(start);
				slots.push({
					time,
					start,
					capacity,
					category,
					durations: Array.from({ length: maximum / 60 }, (_, i) => (i + 1) * 60)
				});
			}
		}
	}
	return slots;
}

export function retainDuration(duration: number, slot: CategorySlot | undefined) {
	return slot?.durations.includes(duration) ? duration : 60;
}
