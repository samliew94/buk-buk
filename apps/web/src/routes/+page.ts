import { redirect } from '@sveltejs/kit';

export function load() {
	redirect(307, '/customer/bookings/new');
}
