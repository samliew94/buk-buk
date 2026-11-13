import { categorySlots, type Category, type Reservation } from '$lib/reservation/availability';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { DateTime } from 'luxon';
import type { PageServerLoad } from './$types';

type Business = { name: string; open_at: string | null; close_at: string | null };

const zone = 'Asia/Kuala_Lumpur';
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function localTime(time: string, day: DateTime) {
	const utc = DateTime.fromISO(time, { zone: 'UTC' }).setZone(zone);
	return day.set({ hour: utc.hour, minute: utc.minute });
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const selected = url.searchParams.get('date') ?? '';
	const parsed = /^\d{4}-\d{2}-\d{2}$/.test(selected)
		? DateTime.fromISO(selected, { zone })
		: DateTime.invalid('Missing date');
	const today = DateTime.now().setZone(zone).startOf('day');
	const day = (
		parsed.isValid && parsed >= today && parsed < today.plus({ days: 7 }) ? parsed : today
	).startOf('day');
	const date = day.toISODate()!;
	const labels = {
		date,
		days: Array.from({ length: 7 }, (_, index) => {
			const date = today.plus({ days: index }).setLocale('en');
			return {
				date: date.toISODate()!,
				weekday: date.toFormat('ccc').toUpperCase(),
				day: date.toFormat('dd'),
				month: date.toFormat('LLL'),
				label: date.toLocaleString(DateTime.DATE_HUGE)
			};
		})
	};

	const base = env.PUBLIC_API_URL || (dev ? 'http://localhost:8787' : '');
	const businessId = env.PUBLIC_BOOKING_BUSINESS_ID || '01a19f40-3132-76b0-8d17-3a042ee0cad6';

	async function request<T>(path: string, body?: object): Promise<T> {
		if (!base) throw new Error('PUBLIC_API_URL is not configured.');
		const response = await fetch(new URL(path, base), {
			method: body ? 'QUERY' : 'GET',
			headers: body ? { 'Content-Type': 'application/json' } : undefined,
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(8000)
		});
		if (!response.ok) throw new Error(`Booking API returned ${response.status}`);
		return response.json();
	}

	try {
		const [business, categories, reservations] = await Promise.all([
			request<Business>(`/v1/businesses/${encodeURIComponent(businessId)}`),
			request<Category[]>('/v1/room-categories', { business_id: businessId }),
			request<Reservation[]>('/v1/reservations', {
				business_id: businessId,
				date: day.toUTC().toISO()
			})
		]);
		const { name, open_at: openAt, close_at: closeAt } = business;
		if (!openAt || !closeAt || !timePattern.test(openAt) || !timePattern.test(closeAt)) {
			return { ...labels, name, slots: [], message: 'Opening hours are unavailable.' };
		}

		const opening = localTime(openAt, day);
		const closing = localTime(closeAt, day);
		const slots = categorySlots(categories, reservations, opening.toMillis(), closing.toMillis());
		return {
			...labels,
			name,
			slots,
			message: slots.length ? '' : 'No categories or times are available for this date.'
		};
	} catch (error) {
		console.error('Unable to load admin availability', error);
		return {
			...labels,
			name: '',
			slots: [],
			message: 'Availability could not be loaded. Try again.'
		};
	}
};
