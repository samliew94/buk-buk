import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const base = env.PUBLIC_API_URL || (dev ? 'http://localhost:8787' : '');
	const businessId = env.PUBLIC_BOOKING_BUSINESS_ID || '01a19f40-3132-76b0-8d17-3a042ee0cad6';
	try {
		if (!base) throw new Error('PUBLIC_API_URL is not configured.');
		const response = await fetch(
			new URL(`/v1/businesses/${encodeURIComponent(businessId)}`, base),
			{
				signal: AbortSignal.timeout(8000)
			}
		);
		if (!response.ok) throw new Error(`Booking API returned ${response.status}`);
		const business: { name: string } = await response.json();
		return { name: business.name, apiUrl: base, businessId };
	} catch (error) {
		console.error('Unable to load admin business name', error);
		return { name: '', apiUrl: base, businessId };
	}
};
