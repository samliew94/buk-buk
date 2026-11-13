import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

export function load() {
	const configured = env.PUBLIC_CUSTOMER_URL || (dev ? 'http://localhost:5173' : '');
	if (!configured) error(500, 'PUBLIC_CUSTOMER_URL is required for the admin app.');
	let customerUrl: string;
	try {
		const url = new URL(configured);
		if (
			!['http:', 'https:'].includes(url.protocol) ||
			url.pathname !== '/' ||
			url.search ||
			url.hash
		)
			throw new Error();
		customerUrl = url.origin;
	} catch {
		error(
			500,
			'PUBLIC_CUSTOMER_URL must be an HTTP(S) origin, for example https://booking.example.com.'
		);
	}
	return {
		customerUrl,
		navigation: [
			{ href: '/calendar', label: 'Calendar' },
			{ href: '/bookings', label: 'Bookings' },
			{ href: '/payments', label: 'Payments' },
			{ href: '/bookings/new', label: 'New Reservation' }
		]
	};
}
