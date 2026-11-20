import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';

export function load() {
	return {
		apiUrl: env.PUBLIC_API_URL || (dev ? 'http://localhost:8787' : ''),
		businessId: env.PUBLIC_BOOKING_BUSINESS_ID || '01a19f40-3132-76b0-8d17-3a042ee0cad6',
		navigation: [
			{ href: '/calendar', label: 'Calendar' },
			{ href: '/bookings', label: 'Bookings' },
			{ href: '/payments', label: 'Payments' },
			{ href: '/bookings/new', label: 'New Reservation' },
			{ href: '/settings/notifications', label: 'Notifications' },
			{ href: '/users', label: 'Users' }
		]
	};
}
