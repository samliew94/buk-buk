import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
	const apiUrl = env.PUBLIC_API_URL || (dev ? 'http://localhost:8787' : '');
	const businessId = env.PUBLIC_BOOKING_BUSINESS_ID || '01a19f40-3132-76b0-8d17-3a042ee0cad6';
	let name = '';
	try {
		if (apiUrl) {
			const response = await fetch(
				new URL(`/v1/businesses/${encodeURIComponent(businessId)}`, apiUrl),
				{ signal: AbortSignal.timeout(8000) }
			);
			if (response.ok) {
				const business: { name: string } = await response.json();
				name = business.name;
			}
		}
	} catch (error) {
		console.error('Unable to load admin business name', error);
	}
	return {
		name,
		apiUrl,
		businessId
	};
};
