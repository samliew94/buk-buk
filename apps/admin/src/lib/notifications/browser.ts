import { ApiError } from '../auth/session.ts';

type Request = (path: string, init: RequestInit) => Promise<Response>;

export const recovery =
	'Close all admin tabs and installed app windows, then reopen and Retry. Save any drafts first.';

export function bounded<T>(promise: Promise<T>, message: string, ms = 10000): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(message)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

export function publicKey(value: string): Uint8Array<ArrayBuffer> {
	if (!/^[A-Za-z0-9_-]{87}$/.test(value))
		throw new Error('Configure a valid PUBLIC_VAPID_PUBLIC_KEY matching the API public key.');
	const bytes = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='), (c) =>
		c.charCodeAt(0)
	);
	if (bytes.length !== 65 || bytes[0] !== 4)
		throw new Error('PUBLIC_VAPID_PUBLIC_KEY must be an uncompressed P-256 public key.');
	return bytes;
}

export function matches(subscription: PushSubscription, key: Uint8Array): boolean {
	const configured = subscription.options.applicationServerKey;
	if (!configured) return false;
	const bytes = new Uint8Array(configured);
	return bytes.length === key.length && bytes.every((value, index) => value === key[index]);
}

export async function activeWorker(): Promise<ServiceWorkerRegistration> {
	const registration = await bounded(navigator.serviceWorker.ready, recovery);
	if (
		registration.scope !== new URL('/', location.origin).href ||
		registration.active?.scriptURL !== new URL('/service-worker.js', location.origin).href
	)
		throw new Error('The admin worker is unavailable. ' + recovery);
	if (registration.waiting) throw new Error('An admin update is waiting. ' + recovery);
	const channel = new MessageChannel();
	try {
		await bounded(
			new Promise<void>((resolve) => {
				channel.port1.onmessage = (event) => {
					if (event.data?.type === 'BUK_BUK_PUSH_READY' && event.data.version === 1) resolve();
				};
				registration.active!.postMessage({ type: 'BUK_BUK_PUSH_READY' }, [channel.port2]);
			}),
			registration.waiting
				? 'An admin update is waiting. ' + recovery
				: 'The active worker is not ready for notifications. ' + recovery,
			3000
		);
	} finally {
		channel.port1.close();
		channel.port2.close();
	}
	return registration;
}

export async function persist(subscription: PushSubscription, request: Request): Promise<string> {
	const json = subscription.toJSON();
	if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth)
		throw new Error(
			'Browser subscription is incomplete. Turn off on this device, then enable again.'
		);
	try {
		const response = await request('/v1/web-push-subscriptions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				endpoint: json.endpoint,
				keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }
			}),
			signal: AbortSignal.timeout(10000),
			credentials: 'omit'
		});
		if (response.status === 409) {
			throw new ApiError(409, 'Re-subscribe to enroll this browser for your account.');
		}
		if (!response.ok) throw new Error();
		const result = (await response.json()) as { id?: unknown };
		if (typeof result?.id !== 'string' || !result.id.trim()) throw new Error();
		return result.id;
	} catch (error) {
		if (error instanceof ApiError) throw error;
		throw new Error('Could not save this device. Retry reuses its existing subscription.');
	}
}

export async function deregister(id: string, request: Request): Promise<void> {
	const response = await request('/v1/web-push-subscriptions', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ id }),
		signal: AbortSignal.timeout(10000),
		credentials: 'omit'
	});
	if (response.status !== 204) throw new Error('Could not remove this device from your account.');
}
