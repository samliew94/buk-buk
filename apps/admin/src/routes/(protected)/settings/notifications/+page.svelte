<script lang="ts">
	import { ApiError } from '$lib/auth/session';
	import { staffFetch } from '$lib/auth/staff';
	import { onMount } from 'svelte';
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import Button from '@booking/ui/Button.svelte';
	import {
		activeWorker,
		deregister,
		matches,
		persist,
		publicKey
	} from '$lib/notifications/browser';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	type State =
		| 'checking'
		| 'unsupported'
		| 'install'
		| 'off'
		| 'enabling'
		| 'enabled'
		| 'blocked'
		| 'failure'
		| 'turn-off-failed'
		| 'mismatch';
	let status = $state<State>('checking');
	let busy = $state(false);
	let message = $state('Checking notification support…');
	let registration: ServiceWorkerRegistration | undefined;
	let key: Uint8Array<ArrayBuffer>;
	let api = '';
	let canEnable = $state(false);
	let hasSubscription = $state(false);
	let savedDevice: { endpoint: string; id: string } | undefined;

	function fail(error: unknown) {
		status = error instanceof ApiError && error.status === 409 ? 'mismatch' : 'failure';
		message = error instanceof Error ? error.message : 'Notifications could not be updated. Retry.';
	}

	function request(path: string, init: RequestInit) {
		return staffFetch(api, path, init);
	}

	async function saveDevice(subscription: PushSubscription) {
		const id = await persist(subscription, request);
		savedDevice = { endpoint: subscription.endpoint, id };
		return id;
	}

	async function removeDevice(subscription: PushSubscription) {
		let id = savedDevice?.endpoint === subscription.endpoint ? savedDevice.id : undefined;
		if (!id) {
			try {
				id = await saveDevice(subscription);
			} catch (error) {
				// A registration conflict means the row belongs to another account or is unowned.
				if (!(error instanceof ApiError && error.status === 409)) throw error;
			}
		}
		if (id) await deregister(id, request);
		savedDevice = undefined;
		if (!(await subscription.unsubscribe()) || (await registration?.pushManager.getSubscription()))
			throw new Error('Could not remove the browser subscription. Retry on this device.');
		hasSubscription = false;
	}

	async function inspect() {
		if (busy) return;
		busy = true;
		canEnable = false;
		status = 'checking';
		message = 'Checking notification support…';
		try {
			const ios =
				/iPad|iPhone|iPod/.test(navigator.userAgent) ||
				(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
			const standalone =
				matchMedia('(display-mode: standalone)').matches ||
				(navigator as Navigator & { standalone?: boolean }).standalone;
			if (ios && !standalone) {
				status = 'install';
				message = 'Add BUK BUK to your Home Screen, open its icon, then return to Notifications.';
				return;
			}
			if (
				!window.isSecureContext ||
				!('Notification' in window) ||
				!('serviceWorker' in navigator) ||
				!('PushManager' in window)
			) {
				status = 'unsupported';
				message = 'Notifications need a supported browser and HTTPS (or localhost).';
				return;
			}
			key = publicKey(data.vapidPublicKey);
			try {
				await crypto.subtle.importKey('raw', key, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
					'verify'
				]);
			} catch {
				throw new Error('PUBLIC_VAPID_PUBLIC_KEY must be a valid P-256 public key.');
			}
			let configured: URL;
			try {
				configured = new URL(data.apiUrl);
			} catch {
				throw new Error('Configure PUBLIC_API_URL as an HTTP(S) API URL.');
			}
			if (
				!['https:', 'http:'].includes(configured.protocol) ||
				configured.username ||
				configured.password ||
				(location.protocol === 'https:' && configured.protocol !== 'https:')
			) {
				throw new Error('Configure PUBLIC_API_URL as a secure API URL without credentials.');
			}
			api = configured.href;
			registration = await activeWorker();
			const subscription = await registration.pushManager.getSubscription();
			hasSubscription = !!subscription;
			if (Notification.permission === 'denied') {
				status = 'blocked';
				message = 'Notifications are blocked in browser settings.';
			} else if (subscription && !matches(subscription, key)) {
				status = 'mismatch';
				message =
					'This device uses a different application server key. Re-subscribe to use the current key.';
			} else if (subscription && Notification.permission === 'granted') {
				await saveDevice(subscription);
				status = 'enabled';
				message = 'Notifications are enabled and this device is saved.';
			} else {
				status = 'off';
				message = 'Notifications are off on this device.';
				canEnable = true;
			}
		} catch (error) {
			fail(error);
		} finally {
			busy = false;
		}
	}

	async function enable(replace = false) {
		if (busy || !registration) return;
		busy = true;
		canEnable = false;
		status = 'enabling';
		message = 'Enabling notifications…';
		try {
			// Permission is the first asynchronous browser operation in this explicit action.
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				status = permission === 'denied' ? 'blocked' : 'off';
				message =
					permission === 'denied'
						? 'Notifications are blocked in browser settings.'
						: 'Permission was not granted. You can enable again when ready.';
				canEnable = permission !== 'denied';
				return;
			}
			let subscription = await registration.pushManager.getSubscription();
			if (subscription && (replace || !matches(subscription, key))) {
				if (!replace) {
					status = 'mismatch';
					message =
						'This device uses a different application server key. Re-subscribe to use the current key.';
					return;
				}
				await removeDevice(subscription);
				subscription = null;
			}
			subscription ??= await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: key
			});
			hasSubscription = true;
			await saveDevice(subscription);
			status = 'enabled';
			message = 'Notifications are enabled and this device is saved.';
		} catch (error) {
			fail(error);
		} finally {
			busy = false;
		}
	}

	async function turnOff() {
		if (busy || !registration) return;
		busy = true;
		message = 'Turning off notifications on this device…';
		try {
			const subscription = await registration.pushManager.getSubscription();
			if (subscription) await removeDevice(subscription);
			hasSubscription = false;
			status = 'off';
			canEnable = Notification.permission !== 'denied';
			message = 'Notifications are off on this device.';
		} catch (error) {
			fail(error);
			status = 'turn-off-failed';
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		void inspect();
	});
</script>

<svelte:head><title>Notifications | BUK BUK</title></svelte:head>

<div class="customer-app min-h-screen bg-booking-black text-booking-white">
	<AdminNav links={data.navigation} name="BUK BUK" />
	<main class="mx-auto max-w-2xl p-5 sm:p-7">
		<section
			class="rounded-xl bg-booking-container p-5 sm:p-7"
			aria-labelledby="notifications-title"
			aria-busy={busy}
		>
			<h1 id="notifications-title" class="text-xl font-bold">Notifications</h1>
			<p class="mt-3 text-sm text-booking-muted">
				Manage notifications for this browser or installed app.
			</p>
			<p class="my-5" role="status" aria-live="polite" aria-atomic="true">{message}</p>
			<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				{#if canEnable}
					<Button disabled={busy} onclick={() => enable()}>Enable notifications</Button>
				{/if}
				{#if status === 'mismatch'}
					<Button disabled={busy} onclick={() => enable(true)}>Re-subscribe with current key</Button
					>
				{/if}
				{#if status === 'failure' || status === 'blocked' || status === 'unsupported' || status === 'install'}
					<Button variant="secondary" disabled={busy} onclick={inspect}>Retry</Button>
				{/if}
				{#if hasSubscription}
					<Button variant="secondary" disabled={busy} onclick={turnOff}
						>Turn off on this device</Button
					>
				{/if}
			</div>
			<div class="mt-6 space-y-3 text-sm text-booking-muted">
				<p>
					If blocked, open this site's browser permissions and allow notifications, then Retry. In
					an installed iPhone/iPad app, check its Notifications settings in system Settings. A
					dismissed prompt leaves notifications off.
				</p>
				<p>
					On supported iPhone/iPad (iOS/iPadOS 16.4 or later), use Share → Add to Home Screen, then
					open BUK BUK from its icon and tap Enable notifications.
				</p>
				<p>Turning off removes this device from your account and unsubscribes this browser.</p>
			</div>
		</section>
	</main>
</div>
