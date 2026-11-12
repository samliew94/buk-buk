<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/shared/ui/Button.svelte';

	type DeviceState = 'checking' | 'ready' | 'error';

	let videoElement = $state<HTMLVideoElement>();
	let deviceState = $state<DeviceState>('checking');
	let error = $state('');
	let stream = $state<MediaStream>();
	let isMounted = false;
	let cameraRequestId = 0;

	function stopStream() {
		stream?.getTracks().forEach((track) => track.stop());
		stream = undefined;
		if (videoElement) videoElement.srcObject = null;
	}

	function getCameraError(cause: unknown): string {
		if (cause instanceof DOMException) {
			if (cause.name === 'NotAllowedError' || cause.name === 'PermissionDeniedError')
				return 'Camera permission was denied. Allow camera access and try again.';
			if (cause.name === 'NotFoundError' || cause.name === 'DevicesNotFoundError')
				return 'No camera was found on this device.';
			if (cause.name === 'NotReadableError' || cause.name === 'TrackStartError')
				return 'The camera is unavailable. Close other apps using it and try again.';
			if (cause.name === 'OverconstrainedError')
				return 'The requested rear camera is unavailable. Try again.';
		}
		return 'Unable to start the camera. Please try again.';
	}

	async function startCamera() {
		stopStream();
		const requestId = ++cameraRequestId;
		deviceState = 'checking';
		error = '';

		if (!window.isSecureContext) {
			deviceState = 'error';
			error = 'Camera access requires a secure connection (HTTPS).';
			return;
		}

		if (!navigator.mediaDevices?.getUserMedia) {
			deviceState = 'error';
			error = 'Camera access is not supported in this browser.';
			return;
		}

		try {
			const nextStream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'environment' } },
				audio: false
			});

			if (!isMounted || requestId !== cameraRequestId) {
				nextStream.getTracks().forEach((track) => track.stop());
				return;
			}

			stream = nextStream;
			if (!videoElement) {
				nextStream.getTracks().forEach((track) => track.stop());
				return;
			}
			videoElement.srcObject = nextStream;
			await videoElement.play();
			deviceState = 'ready';
		} catch (cause) {
			if (!isMounted || requestId !== cameraRequestId) return;
			stopStream();
			deviceState = 'error';
			error = getCameraError(cause);
		}
	}

	onMount(() => {
		isMounted = true;
		void startCamera();
		return () => {
			isMounted = false;
			cameraRequestId += 1;
			stopStream();
		};
	});
</script>

<svelte:head>
	<title>Camera Check · Moon Rabbits</title>
</svelte:head>

<main class="min-h-screen bg-[var(--white)] p-8 text-[var(--black)]">
	<section class="mx-auto grid w-full max-w-2xl gap-6 p-4">
		<header class="grid gap-3 text-center">
			<h1 class="text-3xl font-semibold">Camera Check</h1>
			<div class="mx-auto h-px w-16 bg-[var(--accent)]" aria-hidden="true"></div>
			<p class="text-sm text-[var(--grey)]">Allow camera access to continue playing.</p>
		</header>

		<div class="grid gap-4">
			<div class="overflow-hidden rounded-lg border border-black/10 bg-black shadow-sm">
				<video
					bind:this={videoElement}
					class="aspect-video h-auto w-full object-contain"
					muted
					playsinline
					aria-label="Live rear-camera preview"
				></video>
			</div>

			{#if deviceState === 'checking'}
				<p class="text-center text-[var(--grey)]" role="status">Checking camera access...</p>
			{:else if deviceState === 'ready'}
				<div class="grid gap-1 text-center">
					<p class="text-[var(--success)]" role="status">Camera ready.</p>
					<p class="text-sm text-[var(--grey)]">Please close this page</p>
				</div>
			{:else}
				<div
					class="grid gap-4 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-4 text-center text-[var(--danger)]"
					role="alert"
				>
					<p>{error}</p>
					<div class="mx-auto max-w-32">
						<Button onclick={() => void startCamera()}>Retry</Button>
					</div>
				</div>
			{/if}
		</div>
	</section>
</main>
