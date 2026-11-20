import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { destination, parsePushNotification } from '../src/lib/notifications/payload.ts';
import {
	activeWorker,
	bounded,
	deregister,
	matches,
	persist,
	publicKey
} from '../src/lib/notifications/browser.ts';
import { protectedFetch } from '../src/lib/auth/session.ts';

const pushDestination = (text: string) => parsePushNotification(text).url;

test('only exact approved destinations survive payload and click validation', () => {
	for (const value of ['/calendar', '/bookings', '/payments']) {
		assert.equal(destination(value), value);
		assert.equal(pushDestination(JSON.stringify({ version: 1, type: 'test', url: value })), value);
	}
	for (const value of [
		null,
		{},
		'//evil.example/payments',
		'https://admin.example/payments',
		'https://user:pass@admin.example/payments',
		'/payments?q=x',
		'/payments#x',
		'/bookings/1',
		'/%70ayments',
		'/payments/',
		'\\evil.example',
		' /payments'
	]) {
		assert.equal(destination(value), '/calendar');
		assert.equal(
			pushDestination(JSON.stringify({ version: 1, type: 'test', url: value })),
			'/calendar'
		);
	}
	for (const value of [
		'',
		'{',
		'null',
		'[]',
		'{"version":2,"type":"test","url":"/payments"}',
		'{"version":1,"type":"other","url":"/payments"}',
		JSON.stringify({ version: 1, type: 'test', url: '/payments', extra: 'x'.repeat(2048) })
	]) {
		assert.equal(pushDestination(value), '/calendar');
	}
});

test('configuration decoding, key matching and bounded readiness', async () => {
	for (const key of ['', 'REPLACE_ME', 'a'.repeat(87)]) assert.throws(() => publicKey(key));
	const bytes = new Uint8Array(65);
	bytes[0] = 4;
	const key = publicKey(Buffer.from(bytes).toString('base64url'));
	assert.equal(
		matches({ options: { applicationServerKey: bytes.buffer } } as PushSubscription, key),
		true
	);
	assert.equal(
		matches({ options: { applicationServerKey: null } } as PushSubscription, key),
		false
	);
	bytes[1] = 1;
	assert.equal(
		matches({ options: { applicationServerKey: bytes.buffer } } as PushSubscription, key),
		false
	);
	assert.equal(await bounded(Promise.resolve(1), 'timeout', 10), 1);
	await assert.rejects(bounded(new Promise(() => {}), 'worker timeout', 5), /worker timeout/);
});

test('persistence strips extra browser fields and requires a successful ID; retry reuses subscription', async () => {
	const original = globalThis.fetch;
	const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
	Object.defineProperty(globalThis, 'localStorage', {
		configurable: true,
		value: { getItem: () => '{"access_token":"test-access","refresh_token":"test-refresh"}' }
	});
	const request = (path: string, init: RequestInit) =>
		protectedFetch('https://api.example', path, init, () => assert.fail('Unexpected 401'));
	const bodies: unknown[] = [];
	let reply = new Response('{}', { status: 500 });
	globalThis.fetch = async (url, options) => {
		assert.equal(options?.credentials, 'omit');
		assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-access');
		assert.equal(String(url), 'https://api.example/v1/web-push-subscriptions');
		bodies.push(JSON.parse(String(options?.body)));
		return reply;
	};
	const subscription = {
		endpoint: 'https://push.example/device',
		toJSON: () => ({
			endpoint: 'https://push.example/device',
			expirationTime: 123,
			extra: true,
			keys: { p256dh: 'test-key', auth: 'test-auth', extra: 'excluded' }
		})
	} as unknown as PushSubscription;
	try {
		await assert.rejects(persist(subscription, request), /Retry reuses/);
		reply = new Response('{}');
		await assert.rejects(persist(subscription, request), /Could not save/);
		reply = new Response(null, { status: 409 });
		await assert.rejects(persist(subscription, request), { status: 409 });
		reply = new Response('{"id":"saved"}');
		assert.equal(await persist(subscription, request), 'saved');
		reply = new Response(null, { status: 204 });
		await deregister('saved', request);
		assert.equal(bodies.length, 5);
		assert.deepEqual(bodies.pop(), { id: 'saved' });
		for (const body of bodies)
			assert.deepEqual(body, {
				endpoint: 'https://push.example/device',
				keys: { p256dh: 'test-key', auth: 'test-auth' }
			});
	} finally {
		globalThis.fetch = original;
		if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
		else Reflect.deleteProperty(globalThis, 'localStorage');
	}
});

test('actual worker uses waitUntil, payload content, readiness and safe existing/new windows', async () => {
	const handlers: Record<string, (event: any) => void> = {};
	const shown: any[] = [];
	const opened: string[] = [];
	const visited: string[] = [];
	let clients: any[] = [];
	const source = readFileSync(new URL('../src/service-worker.ts', import.meta.url), 'utf8').replace(
		/^import .*;$/gm,
		''
	);
	const js = ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
	}).outputText;
	vm.runInNewContext(js, {
		self: {
			addEventListener: (name: string, handler: any) => (handlers[name] = handler),
			location: { origin: 'https://admin.example' },
			registration: {
				showNotification: async (...args: any[]) => {
					shown.push(args);
				}
			},
			clients: {
				matchAll: async () => clients,
				openWindow: async (url: string) => {
					opened.push(url);
				}
			}
		},
		version: 'test',
		destination,
		parsePushNotification,
		URL,
		console
	});
	let ready: unknown;
	handlers.message({
		data: { type: 'BUK_BUK_PUSH_READY' },
		ports: [{ postMessage: (value: unknown) => (ready = value) }]
	});
	assert.deepEqual(JSON.parse(JSON.stringify(ready)), { type: 'BUK_BUK_PUSH_READY', version: 1 });
	for (const text of [
		undefined,
		'{',
		JSON.stringify({
			version: 1,
			type: 'test',
			url: '/payments',
			title: 'untrusted',
			body: 'untrusted'
		}),
		JSON.stringify({ title: 'New message', body: 'First line\nSecond line', url: '/bookings/01a1f7bc-c1c2-704b-8950-f9d77624e8fc' })
	]) {
		let pending: Promise<void> | undefined;
		handlers.push({
			data: text === undefined ? null : { text: () => text },
			waitUntil: (p: Promise<void>) => (pending = p)
		});
		assert.ok(pending);
		await pending;
	}
	assert.equal(shown.length, 4);
	assert.equal(shown[3][0], 'New message');
	assert.equal(shown[3][1].body, 'First line\nSecond line');
	assert.equal(shown[3][1].data.url, '/bookings/01a1f7bc-c1c2-704b-8950-f9d77624e8fc');
	assert.equal(shown[2][0], 'BUK BUK');
	assert.equal(shown[2][1].body, 'This is a test notification.');
	assert.equal(shown[2][1].data.url, '/payments');
	assert.equal(shown[1][1].data.url, '/calendar');
	let closed = 0;
	async function click(url: unknown) {
		let pending: Promise<void> | undefined;
		handlers.notificationclick({
			notification: { data: { url }, close: () => closed++ },
			waitUntil: (p: Promise<void>) => (pending = p)
		});
		assert.ok(pending);
		await pending;
	}
	clients = [
		{ url: 'https://other.example/', navigate: () => assert.fail('external client') },
		{
			url: 'https://admin.example/settings/notifications',
			navigate: async (url: string) => {
				visited.push(url);
				return { focus: async () => visited.push('focused') };
			}
		}
	];
	await click('/bookings');
	assert.deepEqual(visited, ['https://admin.example/bookings', 'focused']);
	assert.equal(opened.length, 0);
	clients = [];
	await click('https://evil.example/payments');
	assert.deepEqual(opened, ['https://admin.example/calendar']);
	clients = [
		{
			url: 'https://admin.example/calendar',
			navigate: async () => {
				throw new Error('closed');
			}
		}
	];
	await click('/payments');
	assert.equal(opened[1], 'https://admin.example/payments');
	assert.equal(closed, 3);
	assert.equal(handlers.fetch, undefined);
});

test('readiness rejects waiting/foreign/old workers and bounds missing registration', async () => {
	const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
	const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
	const originalTimeout = globalThis.setTimeout;
	const registration: any = {
		scope: 'https://admin.example/',
		active: {
			scriptURL: 'https://admin.example/service-worker.js',
			postMessage: (_data: unknown, ports: MessagePort[]) =>
				ports[0].postMessage({ type: 'BUK_BUK_PUSH_READY', version: 1 })
		}
	};
	let ready: Promise<unknown> = Promise.resolve(registration);
	Object.defineProperty(globalThis, 'navigator', {
		configurable: true,
		value: {
			serviceWorker: {
				get ready() {
					return ready;
				}
			}
		}
	});
	Object.defineProperty(globalThis, 'location', {
		configurable: true,
		value: { origin: 'https://admin.example' }
	});
	try {
		assert.equal(await activeWorker(), registration);
		registration.waiting = {};
		await assert.rejects(activeWorker(), /update is waiting/);
		delete registration.waiting;
		registration.scope = 'https://other.example/';
		await assert.rejects(activeWorker(), /unavailable/);
		registration.scope = 'https://admin.example/';
		globalThis.setTimeout = ((fn: () => void, ms: number) =>
			originalTimeout(fn, Math.min(ms, 10))) as typeof setTimeout;
		registration.active.postMessage = () => {};
		await assert.rejects(activeWorker(), /active worker is not ready/);
		ready = new Promise(() => {});
		await assert.rejects(activeWorker(), /Close all admin/);
	} finally {
		globalThis.setTimeout = originalTimeout;
		if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
		else Reflect.deleteProperty(globalThis, 'navigator');
		if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
		else Reflect.deleteProperty(globalThis, 'location');
	}
});
