import { DateTime } from 'luxon';

export const BOOKING_DRAFT_KEY = 'customer.booking-draft';

export type BookingDraft = {
	date: string;
	room: { id: string; name: string };
	time: string;
	duration: number;
	quantity?: number;
};

export function parseBookingDraft(value: string | null): BookingDraft | null {
	try {
		const draft = JSON.parse(value ?? 'null');
		if (
			!draft ||
			('quantity' in draft &&
				(!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 4)) ||
			typeof draft.date !== 'string' ||
			!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
			!DateTime.fromISO(draft.date, { zone: 'Asia/Kuala_Lumpur' }).isValid ||
			typeof draft.time !== 'string' ||
			!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time) ||
			typeof draft.room?.id !== 'string' ||
			!draft.room.id.trim() ||
			typeof draft.room?.name !== 'string' ||
			!draft.room.name.trim() ||
			!Number.isSafeInteger(draft.duration) ||
			draft.duration < 60 ||
			draft.duration % 60 !== 0
		)
			return null;
		return {
			date: draft.date,
			room: { id: draft.room.id, name: draft.room.name },
			time: draft.time,
			duration: draft.duration,
			...(draft.quantity === undefined ? {} : { quantity: draft.quantity })
		};
	} catch {
		return null;
	}
}

export function bookingDraftSummary(draft: BookingDraft) {
	const start = DateTime.fromISO(`${draft.date}T${draft.time}`, {
		zone: 'Asia/Kuala_Lumpur'
	}).setLocale('en');
	return [
		{ icon: 'mdi:calendar', text: start.toFormat('ccc d LLL') },
		{
			icon: 'mdi:door-open',
			text: draft.room.name + (draft.quantity === undefined ? '' : ` × ${draft.quantity}`)
		},
		{
			icon: 'mdi:clock-outline',
			text: `${start.toFormat('h:mma')} · ${draft.duration / 60} ${draft.duration === 60 ? 'Hour' : 'Hours'}`
		}
	];
}
