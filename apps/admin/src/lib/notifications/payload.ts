// Only approved admin routes are accepted, including when reading notification data.
const bookingPath = /^\/bookings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function destination(value: unknown): string {
	return typeof value === 'string' &&
		(value === '/bookings' || value === '/payments' || value === '/calendar' || bookingPath.test(value))
		? value
		: '/calendar';
}

const testNotification = {
	title: 'BUK BUK',
	body: 'This is a test notification.',
	url: '/calendar'
};

export function parsePushNotification(text: string) {
	if (new TextEncoder().encode(text).length > 2048) return testNotification;
	try {
		const payload = JSON.parse(text);
		if (payload?.version === 1 && payload.type === 'test') {
			return { ...testNotification, url: destination(payload.url) };
		}
		if (typeof payload?.title === 'string' && typeof payload.body === 'string') {
			return { title: payload.title, body: payload.body, url: destination(payload.url) };
		}
	} catch {
		// Fall back when a payload cannot be read.
	}
	return testNotification;
}
