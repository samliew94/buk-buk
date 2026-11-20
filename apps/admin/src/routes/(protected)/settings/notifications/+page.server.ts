import { env } from '$env/dynamic/public';

export function load() {
	return {
		vapidPublicKey: env.PUBLIC_VAPID_PUBLIC_KEY || ''
	};
}
