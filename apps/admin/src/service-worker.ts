/// <reference lib="webworker" />
import { version } from '$service-worker';
import { destination, parsePushNotification } from './lib/notifications/payload';

const worker = self as unknown as ServiceWorkerGlobalScope;

// Browser-managed activation; no fetch interception, caching, claiming or forced updates.
worker.addEventListener('install', () => {
	console.info('Admin service worker installed | version: ' + version);
});

worker.addEventListener('message', (event) => {
	if (event.data?.type === 'BUK_BUK_PUSH_READY') {
		event.ports[0]?.postMessage({ type: 'BUK_BUK_PUSH_READY', version: 1 });
	}
});

worker.addEventListener('push', (event) => {
	let payload = '';
	try {
		payload = event.data?.text() ?? '';
	} catch {
		// Display fallback content if the push could not be read.
	}
	const { title, body, url } = parsePushNotification(payload);
	event.waitUntil(worker.registration.showNotification(title, { body, data: { url } }));
});

worker.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL(destination(event.notification.data?.url), worker.location.origin).href;
	event.waitUntil(
		(async () => {
			const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of windows) {
				if (new URL(client.url).origin !== worker.location.origin) continue;
				try {
					const navigated = await client.navigate(url);
					if (navigated) {
						await navigated.focus();
						return;
					}
				} catch {
					// Try another window, then open one if it cannot be reused.
				}
			}
			await worker.clients.openWindow(url);
		})()
	);
});
