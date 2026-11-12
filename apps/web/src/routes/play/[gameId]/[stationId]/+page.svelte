<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import Icon from '@iconify/svelte';
	import { isAxiosError } from 'axios';
	import {
		getStationDetails,
		InvalidApiResponseError,
		uploadStationPhoto,
		type PlayerStationDetails,
		type StationUploadResponse
	} from '$lib/api';
	import Button from '$lib/shared/ui/Button.svelte';

	type PageState = 'loading' | 'ready' | 'error' | 'not-found' | 'invalid';
	type UploadState = 'idle' | 'uploading';
	type UploadResult =
		{ kind: 'success'; upload: StationUploadResponse } | { kind: 'failure'; error: string };

	const gameId = $derived(page.params.gameId?.trim() ?? '');
	const stationIdParam = $derived(page.params.stationId?.trim() ?? '');
	const isMockCamera = (env.PUBLIC_CAMERA_MODE ?? '').trim().toUpperCase() === 'MOCK';
	let pageState = $state<PageState>('loading');
	let station = $state<PlayerStationDetails | null>(null);
	let error = $state('');
	let cameraError = $state('');
	let cameraReady = $state(false);
	let cameraSwitching = $state(false);
	let facingMode = $state<'user' | 'environment'>('environment');
	let torchSupported = $state(false);
	let torchOn = $state(false);
	let zoomSupported = $state(false);
	let hardwareZoom = $state(false);
	let zoomMin = $state(1);
	let zoomMax = $state(3);
	let zoomStep = $state(0.1);
	let zoom = $state(1);
	let uploadState = $state<UploadState>('idle');
	let capturedImageUrl = $state('');
	let result = $state<UploadResult | null>(null);

	let displayedCanvas = $state<HTMLCanvasElement | null>(null);
	let resizeCanvas = $state<HTMLCanvasElement | null>(null);
	let captureCanvas = $state<HTMLCanvasElement | null>(null);
	let video = $state<HTMLVideoElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let cameraStream = $state<MediaStream | null>(null);
	let frameAnimation: number | null = null;
	let disposed = false;
	let captureStopped = false;

	const MAX_WIDTH = 1080;
	const MAX_HEIGHT = 1440;
	const RABBIT_IMAGE_BASE_URL = 'https://cdn.astra-cloud-solutions.com/xunbao/shared/rabbit-';
	let winningRabbitImage = $state('');

	function parseStationId(value: string): number | null {
		if (!/^\d+$/.test(value)) return null;
		const id = Number(value);
		return Number.isSafeInteger(id) && id > 0 ? id : null;
	}

	function isUnauthorized(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 401;
	}

	function isNotFound(cause: unknown): boolean {
		return isAxiosError(cause) && cause.response?.status === 404;
	}

	function getErrorMessage(cause: unknown): string {
		if (cause instanceof InvalidApiResponseError) return cause.message;
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';
			const responseData: unknown = cause.response.data;
			if (
				typeof responseData === 'object' &&
				responseData !== null &&
				'error' in responseData &&
				typeof responseData.error === 'string' &&
				responseData.error.trim().length > 0
			)
				return responseData.error;
			return 'Unable to load Moon Rabbit. Please try again.';
		}
		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return 'Unable to load Moon Rabbit. Please try again.';
	}

	function getUploadErrorMessage(cause: unknown): string {
		if (cause instanceof InvalidApiResponseError) return cause.message;
		if (isAxiosError(cause)) {
			if (!cause.response) return 'Unable to reach the server. Please try again.';
			const responseData: unknown = cause.response.data;
			if (
				typeof responseData === 'object' &&
				responseData !== null &&
				'error' in responseData &&
				typeof responseData.error === 'string' &&
				responseData.error.trim().length > 0
			)
				return responseData.error;
			return 'Unable to upload photo. Please try again.';
		}
		if (cause instanceof Error && cause.message.length > 0) return cause.message;
		return 'Unable to upload photo. Please try again.';
	}

	function uploadPassed(
		upload: StationUploadResponse | PlayerStationDetails['uploads'][number]
	): boolean {
		return (
			upload.riddleCorrect &&
			(station?.enablePose === false || upload.poseCorrect) &&
			upload.playerCountCorrect
		);
	}

	function getRandomRabbitImage(): string {
		const rabbitNumber = Math.floor(Math.random() * 10) + 1;
		return `${RABBIT_IMAGE_BASE_URL}${rabbitNumber}.png`;
	}

	const lastUpload = $derived(station?.uploads[0] ?? null);

	function stopCamera(options: { preserveCapabilities?: boolean } = {}) {
		const preserveCapabilities = options.preserveCapabilities === true;
		if (frameAnimation !== null) {
			if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameAnimation);
			frameAnimation = null;
		}
		if (cameraStream) {
			for (const track of cameraStream.getTracks()) track.stop();
			cameraStream = null;
		}
		if (video) video.srcObject = null;
		cameraReady = false;
		torchOn = false;
		if (preserveCapabilities) return;
		torchSupported = false;
		zoomSupported = false;
		hardwareZoom = false;
	}

	function cameraErrorMessage(cause: unknown): string {
		if (cause instanceof DOMException) {
			if (cause.name === 'NotAllowedError' || cause.name === 'PermissionDeniedError')
				return 'Camera permission was denied. Allow camera access in your browser settings.';
			if (cause.name === 'NotFoundError' || cause.name === 'DevicesNotFoundError')
				return 'No camera was found.';
			if (cause.name === 'NotReadableError' || cause.name === 'TrackStartError')
				return 'The camera is busy or unavailable. Close other camera apps and try again.';
		}
		return cause instanceof Error && cause.message ? cause.message : 'Unable to access the camera.';
	}

	function updateCameraCapabilities(stream: MediaStream) {
		const track = stream.getVideoTracks()[0];
		if (!track) return;
		const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
			torch?: boolean;
			zoom?: { min: number; max: number; step?: number };
		};
		torchSupported = capabilities.torch === true;
		const range = capabilities.zoom;
		if (range && range.max > range.min) {
			zoomSupported = true;
			hardwareZoom = true;
			zoomMin = range.min;
			zoomMax = range.max;
			zoomStep = range.step || 0.1;
			zoom = Math.max(zoomMin, Math.min(zoomMax, Number(track.getSettings().zoom ?? zoomMin)));
		} else {
			zoomSupported = true;
			hardwareZoom = false;
			zoomMin = 1;
			zoomMax = 3;
			zoomStep = 0.1;
			zoom = 1;
		}
	}

	function drawFrame(canvas: HTMLCanvasElement, mirrored: boolean) {
		if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
		const effectiveZoom = hardwareZoom ? 1 : zoom;
		const sourceWidth = video.videoWidth / effectiveZoom;
		const sourceHeight = video.videoHeight / effectiveZoom;
		const sourceX = (video.videoWidth - sourceWidth) / 2;
		const sourceY = (video.videoHeight - sourceHeight) / 2;
		canvas.width = Math.round(sourceWidth);
		canvas.height = Math.round(sourceHeight);
		const context = canvas.getContext('2d');
		if (!context) return;
		context.save();
		if (mirrored) {
			context.translate(canvas.width, 0);
			context.scale(-1, 1);
		}
		context.drawImage(
			video,
			sourceX,
			sourceY,
			sourceWidth,
			sourceHeight,
			0,
			0,
			canvas.width,
			canvas.height
		);
		context.restore();
	}

	function drawLiveFrame() {
		if (disposed || !cameraStream || !video || !displayedCanvas) return;
		if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
			drawFrame(displayedCanvas, facingMode === 'user');
			cameraReady = true;
		}
		if (typeof requestAnimationFrame === 'function') {
			frameAnimation = requestAnimationFrame(drawLiveFrame);
		}
	}

	async function startCamera() {
		if (isMockCamera || cameraStream || disposed) return;
		cameraError = '';
		if (!navigator.mediaDevices?.getUserMedia) {
			cameraError = 'Camera access is not available in this browser.';
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: facingMode } },
				audio: false
			});
			if (disposed || isMockCamera) {
				for (const track of stream.getTracks()) track.stop();
				return;
			}
			if (!video) throw new Error('Camera preview is not ready.');
			cameraStream = stream;
			captureStopped = false;
			updateCameraCapabilities(stream);
			const track = stream.getVideoTracks()[0];
			track?.addEventListener('ended', () => {
				if (!disposed && !captureStopped) {
					cameraError = 'The camera stopped. Trying to reconnect...';
					void restartCamera();
				}
			});
			const videoElement = video;
			videoElement.srcObject = stream;
			const startDrawing = () => {
				if (frameAnimation === null) drawLiveFrame();
			};
			videoElement.onloadedmetadata = () => {
				void videoElement.play().catch(() => {
					cameraError = 'Unable to start the camera preview.';
				});
				startDrawing();
			};
			await videoElement.play().catch(() => {});
			startDrawing();
		} catch (cause) {
			cameraError = cameraErrorMessage(cause);
		}
	}

	async function restartCamera() {
		if (disposed || isMockCamera || captureStopped) return;
		stopCamera({ preserveCapabilities: cameraSwitching });
		await startCamera();
	}

	async function switchCamera() {
		if (cameraSwitching || !cameraReady) return;
		cameraSwitching = true;
		facingMode = facingMode === 'environment' ? 'user' : 'environment';
		try {
			await restartCamera();
		} finally {
			cameraSwitching = false;
			if (!cameraStream) stopCamera();
		}
	}

	async function toggleTorch() {
		const track = cameraStream?.getVideoTracks()[0];
		if (!track || !torchSupported) return;
		try {
			torchOn = !torchOn;
			await track.applyConstraints({
				advanced: [{ torch: torchOn } as unknown as MediaTrackConstraintSet]
			});
		} catch {
			torchOn = false;
			cameraError = 'Flashlight is not available on this camera.';
		}
	}

	async function setZoom(value: number) {
		zoom = Math.max(zoomMin, Math.min(zoomMax, value));
		const track = cameraStream?.getVideoTracks()[0];
		if (!track || !zoomSupported) return;
		const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { zoom?: unknown };
		if (capabilities.zoom) {
			try {
				await track.applyConstraints({
					advanced: [{ zoom } as unknown as MediaTrackConstraintSet]
				});
			} catch {
				hardwareZoom = false;
				zoomMin = 1;
				zoomMax = 3;
				zoomStep = 0.1;
				zoom = Math.max(1, Math.min(3, zoom));
				cameraError = 'Hardware zoom is not available; using preview zoom instead.';
			}
		}
	}

	async function drawSelectedImage(file: File) {
		if (!file.type.toLowerCase().startsWith('image/')) {
			cameraError = 'Please select an image file.';
			return;
		}
		const objectUrl = URL.createObjectURL(file);
		try {
			if (!displayedCanvas) throw new Error('Camera preview is not ready.');
			const image = new Image();
			await new Promise<void>((resolve, reject) => {
				image.onload = () => resolve();
				image.onerror = () => reject(new Error('Unable to read the selected image.'));
				image.src = objectUrl;
			});
			if (disposed) return;
			const width = image.naturalWidth || image.width;
			const height = image.naturalHeight || image.height;
			if (!width || !height) throw new Error('Selected image has no usable dimensions.');
			displayedCanvas.width = width;
			displayedCanvas.height = height;
			displayedCanvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
			capturedImageUrl = displayedCanvas.toDataURL('image/png');
			cameraError = '';
			await uploadDisplayedCanvas();
		} catch (cause) {
			result = { kind: 'failure', error: getUploadErrorMessage(cause) };
		} finally {
			URL.revokeObjectURL(objectUrl);
		}
	}

	function handleFileChange(event: Event) {
		if (uploadState === 'uploading') return;
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		void drawSelectedImage(file);
	}

	async function canvasToWebpFile(): Promise<File> {
		if (!displayedCanvas || !resizeCanvas) throw new Error('Camera preview is not ready.');
		const sourceWidth = displayedCanvas.width;
		const sourceHeight = displayedCanvas.height;
		if (!sourceWidth || !sourceHeight) throw new Error('Capture an image before uploading.');
		const scale = Math.min(MAX_WIDTH / sourceWidth, MAX_HEIGHT / sourceHeight, 1);
		resizeCanvas.width = Math.max(1, Math.round(sourceWidth * scale));
		resizeCanvas.height = Math.max(1, Math.round(sourceHeight * scale));
		resizeCanvas
			.getContext('2d')
			?.drawImage(displayedCanvas, 0, 0, resizeCanvas.width, resizeCanvas.height);
		const outputCanvas = resizeCanvas;
		const blob = await new Promise<Blob | null>((resolve) =>
			outputCanvas.toBlob(resolve, 'image/webp', 0.8)
		);
		if (!blob) throw new Error('Unable to prepare the image for upload.');
		return new File([blob], 'station.webp', { type: 'image/webp' });
	}

	async function uploadDisplayedCanvas() {
		if (uploadState === 'uploading') return;
		uploadState = 'uploading';
		cameraError = '';
		try {
			const token = localStorage.getItem('player_token');
			if (!token) throw new Error('Your player session has expired. Please log in again.');
			const file = await canvasToWebpFile();
			if (!capturedImageUrl && displayedCanvas)
				capturedImageUrl = displayedCanvas.toDataURL('image/png');
			const stationId = parseStationId(stationIdParam);
			if (stationId === null) throw new Error('Invalid station link.');
			const upload = await uploadStationPhoto(gameId, stationId, file, token);
			if (station) {
				station = {
					...station,
					uploads: [upload, ...station.uploads]
				};
			}
			if (uploadPassed(upload)) winningRabbitImage = getRandomRabbitImage();
			result = { kind: 'success', upload };
		} catch (cause) {
			result = { kind: 'failure', error: getUploadErrorMessage(cause) };
		} finally {
			uploadState = 'idle';
		}
	}

	function snap() {
		if (uploadState === 'uploading' || !cameraReady || !displayedCanvas) return;
		if (captureCanvas) {
			drawFrame(captureCanvas, false);
			displayedCanvas.width = captureCanvas.width;
			displayedCanvas.height = captureCanvas.height;
			displayedCanvas.getContext('2d')?.drawImage(captureCanvas, 0, 0);
		}
		capturedImageUrl = displayedCanvas.toDataURL('image/png');
		captureStopped = true;
		stopCamera();
		void uploadDisplayedCanvas();
	}

	function tryAgain() {
		result = null;
		if (isMockCamera) {
			if (fileInput) {
				fileInput.value = '';
				fileInput.focus();
			}
		} else {
			captureStopped = false;
			void startCamera();
		}
	}

	async function loadStation() {
		const currentGameId = gameId.trim();
		const currentStationId = parseStationId(stationIdParam);
		if (!currentGameId || currentStationId === null) {
			pageState = 'invalid';
			station = null;
			return;
		}
		const token = localStorage.getItem('player_token');
		if (!token) {
			await goto('/auth/player/login', { replaceState: true });
			return;
		}
		pageState = 'loading';
		error = '';
		try {
			station = await getStationDetails(currentGameId, currentStationId, token);
			pageState = 'ready';
			if (!isMockCamera) void startCamera();
		} catch (cause) {
			if (isUnauthorized(cause)) {
				localStorage.removeItem('player_token');
				await goto('/auth/player/login', { replaceState: true });
				return;
			}
			station = null;
			if (isNotFound(cause)) {
				pageState = 'not-found';
				error = 'Moon Rabbit not found. Check the game link and try again.';
				return;
			}
			error = getErrorMessage(cause);
			pageState = 'error';
		}
	}

	onMount(() => {
		void loadStation();
		const handleVisibility = () => {
			if (
				document.visibilityState === 'visible' &&
				!captureStopped &&
				(!cameraStream || !cameraReady) &&
				!isMockCamera
			)
				void restartCamera();
		};
		document.addEventListener('visibilitychange', handleVisibility);
		return () => {
			disposed = true;
			document.removeEventListener('visibilitychange', handleVisibility);
			stopCamera();
		};
	});
</script>

<svelte:head>
	<title>Moon Rabbit</title>
</svelte:head>

<main
	class="relative h-screen overflow-y-auto bg-[#002e4d] bg-cover bg-center p-4 text-[var(--black)]"
	style="background-image: linear-gradient(rgb(0 0 0 / 90%), rgb(0 0 0 / 90%)), url('https://cdn.astra-cloud-solutions.com/xunbao/shared/bg-image-6.webp');"
>
	<section class="relative z-10 mx-auto grid w-full max-w-4xl gap-6 p-0">
		<a
			href={`/play/${encodeURIComponent(gameId)}`}
			class="relative z-10 inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/40 focus:outline-none"
		>
			<Icon icon="lucide:arrow-left" aria-hidden="true" />
			Back
		</a>

		{#if pageState === 'loading'}
			<div class="rounded-lg border border-black/10 bg-[var(--white)] p-6 shadow-sm" role="status">
				<p class="text-[var(--grey)]">Loading Moon Rabbit...</p>
			</div>
		{:else if pageState === 'invalid'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>Invalid Moon Rabbit link. Please use the link provided by your game master.</p>
			</div>
		{:else if pageState === 'not-found'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
			</div>
		{:else if pageState === 'error'}
			<div
				class="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-6 text-[var(--danger)]"
				role="alert"
			>
				<p>{error}</p>
				<div class="mt-4 max-w-32"><Button onclick={() => void loadStation()}>Retry</Button></div>
			</div>
		{:else if station}
			<div class="relative z-10 flex flex-col gap-8">
				<section class="flex flex-col gap-4">
					<div class="flex flex-col gap-2">
						<p
							class="flex items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--grey)]"
						>
							<Icon icon="lucide:map-pin" aria-hidden="true" />
							Find the Moon Rabbit's hiding place
						</p>
						<p
							class="flex items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--grey)]"
						>
							<Icon icon="lucide:map-pin" aria-hidden="true" />
							寻找月兔的藏身之处
						</p>
					</div>
					<p
						class="text-center font-dm-sans text-lg leading-tight whitespace-pre-line text-[var(--white)] sm:text-xl"
					>
						{station.riddle.question}
					</p>
					{#if station.riddle.questionZh?.trim()}
						<div
							class="flex items-center justify-center gap-2 text-[var(--accent)]"
							aria-hidden="true"
						>
							<div class="h-px w-12 bg-current"></div>
							<span class="text-xs leading-none">◆</span>
							<div class="h-px w-12 bg-current"></div>
						</div>
						<p
							class="text-center font-ma-shan-zheng text-2xl leading-tight whitespace-pre-line text-[var(--white)] sm:text-3xl"
						>
							{station.riddle.questionZh}
						</p>
					{/if}
					<div class="mx-auto h-px w-12 bg-[var(--accent)]" aria-hidden="true"></div>
				</section>

				{#if station.enablePose}
					<section class="flex flex-col gap-4">
						<div class="flex flex-col gap-2">
							<p
								class="flex items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--grey)]"
							>
								<Icon icon="lucide:person-standing" aria-hidden="true" />
								Pose to call the Moon Rabbit out!
							</p>
							<p
								class="flex items-center justify-center gap-2 text-center text-sm font-semibold text-[var(--grey)]"
							>
								<Icon icon="lucide:person-standing" aria-hidden="true" />
								摆出姿势召唤月兔!
							</p>
						</div>
						{#if station.pose.imageUrl}
							<img
								src={station.pose.imageUrl}
								alt="Pose instructions"
								class="mx-auto h-auto max-h-64 max-w-full rounded-md bg-black/5 object-contain"
								loading="lazy"
							/>
						{:else}<p class="text-sm text-[var(--grey)]">No pose image.</p>{/if}
					</section>
				{/if}

				<section class="flex flex-col gap-4">
					<div
						class="relative overflow-hidden rounded-md bg-black/90 p-2"
						aria-busy={uploadState === 'uploading'}
					>
						<canvas
							bind:this={displayedCanvas}
							aria-label="Camera preview"
							class="mx-auto block max-h-[70vh] max-w-full object-contain"
						></canvas>
						{#if uploadState === 'uploading'}
							<div
								class="absolute inset-0 grid place-items-center bg-black/75 p-6 text-center text-[var(--white)]"
								role="status"
								aria-live="polite"
							>
								<div class="grid max-w-xs justify-items-center gap-3">
									<Icon
										icon="lucide:loader-circle"
										class="size-12 animate-spin text-[var(--accent)]"
										aria-hidden="true"
									/>
									<p class="text-xl font-bold">Please wait — judging your photo...</p>
									<p class="text-sm text-white/85">
										{station.enablePose
											? 'The system is checking your riddle, pose, and photo. Keep this page open.'
											: 'The system is checking your riddle and photo. Keep this page open.'}
									</p>
								</div>
							</div>
						{/if}
					</div>
					<video bind:this={video} class="hidden" playsinline muted aria-hidden="true"></video>
					<canvas bind:this={resizeCanvas} class="hidden" aria-hidden="true"></canvas>
					<canvas bind:this={captureCanvas} class="hidden" aria-hidden="true"></canvas>
					{#if !isMockCamera}
						<div
							class="flex flex-wrap items-center justify-center gap-1"
							aria-label="Camera controls"
						>
							<button
								type="button"
								class="rounded-md p-3 text-3xl text-[var(--white)] hover:bg-white/15 focus:ring-2 focus:ring-[var(--primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
								onclick={() => void switchCamera()}
								disabled={!cameraReady || cameraSwitching}
								aria-label="Switch camera"
								title="Switch camera"
							>
								<Icon icon="icon-park-outline:flip-camera" aria-hidden="true" />
							</button>
							{#if torchSupported || cameraSwitching}
								<button
									type="button"
									class={`rounded-md p-3 text-3xl text-[var(--white)] hover:bg-white/15 focus:ring-2 focus:ring-[var(--primary)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${torchOn ? 'bg-white/20' : ''}`}
									onclick={() => void toggleTorch()}
									disabled={cameraSwitching}
									aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
									title={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
								>
									<Icon icon="lucide:flashlight" aria-hidden="true" />
								</button>
							{/if}
							{#if zoomSupported || cameraSwitching}
								<button
									type="button"
									class="rounded-md px-2 py-1 text-3xl text-[var(--white)] hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
									onclick={() => void setZoom(zoom - zoomStep)}
									disabled={cameraSwitching}
									aria-label="Zoom out"
								>
									−
								</button>
								<span class="min-w-10 text-center text-xl text-[var(--white)]"
									>{zoom.toFixed(1)}×</span
								>
								<button
									type="button"
									class="rounded-md px-2 py-1 text-3xl text-[var(--white)] hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
									onclick={() => void setZoom(zoom + zoomStep)}
									disabled={cameraSwitching}
									aria-label="Zoom in"
								>
									+
								</button>
							{/if}
						</div>
					{/if}
					{#if cameraError}<p class="text-sm text-[var(--danger)]" role="alert">
							{cameraError}
						</p>{/if}
					{#if isMockCamera}
						<input
							bind:this={fileInput}
							id="station-photo"
							class="sr-only"
							type="file"
							accept="image/*"
							onchange={handleFileChange}
							disabled={uploadState === 'uploading'}
						/>
						<label
							for="station-photo"
							class={`inline-flex w-full cursor-pointer items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold text-[var(--white)] transition focus-within:ring-2 focus-within:ring-[var(--primary)]/30 hover:opacity-90 ${uploadState === 'uploading' ? 'bg-[var(--grey)]' : 'bg-[var(--primary)]'}`}
							>{uploadState === 'uploading' ? 'Judging...' : 'Choose image'}</label
						>
					{:else}
						{#if cameraError}
							<div class="flex gap-1">
								<Button onclick={() => void restartCamera()}>Retry camera</Button>
							</div>
						{/if}
						<Button
							onclick={snap}
							disabled={!cameraReady || station.status === 'completed'}
							loading={uploadState === 'uploading'}
							variant={uploadState === 'uploading' || station.status === 'completed'
								? 'grey'
								: 'primary'}
							loadingLabel="Judging...">Take Photo</Button
						>
					{/if}
				</section>

				<section class="flex flex-col gap-4" aria-labelledby="uploads-heading">
					<div class="flex items-center justify-between gap-4">
						<h2 id="uploads-heading" class="text-xl font-semibold text-[var(--white)]">
							Last Attempt
						</h2>
					</div>
					{#if !lastUpload}<p class="text-sm text-[var(--grey)]">No uploads yet.</p>
					{:else}
						<article
							class={`grid gap-3 rounded-md border p-4 ${uploadPassed(lastUpload) ? 'border-[var(--success)]/40 bg-[var(--success)] text-[var(--success)]' : 'border-[var(--danger)]/40 bg-[var(--danger)] text-[var(--danger)]'}`}
						>
							<img
								src={lastUpload.imageUrl}
								alt="Moon Rabbit last attempt"
								class="h-64 w-full rounded-md bg-black/5 object-contain"
								loading="lazy"
							/>
							<div class="border-t border-black/10 bg-[var(--white)] p-3 text-sm">
								{#if lastUpload.comment}
									<p>{lastUpload.comment.text}</p>
									{#if lastUpload.comment.textZh}<p>{lastUpload.comment.textZh}</p>{/if}
								{:else}
									<p>No comment.</p>
								{/if}
							</div>
						</article>
					{/if}
				</section>
			</div>
		{/if}
	</section>
</main>

{#if result}
	<dialog
		open
		class="fixed inset-0 z-10 m-0 grid h-full w-full max-w-none place-items-center border-0 bg-black/60 p-4"
		aria-modal="true"
		aria-labelledby="upload-result-title"
	>
		<section
			class={`grid max-h-full w-full max-w-lg gap-4 overflow-y-auto rounded-lg p-5 shadow-xl ${result.kind === 'success' && uploadPassed(result.upload) ? 'bg-white text-[var(--black)]' : 'border border-[var(--white)] bg-[var(--danger)] text-[var(--white)]'}`}
		>
			{#if result.kind === 'success'}
				{#if uploadPassed(result.upload)}
					<div class="grid gap-3 text-center">
						<img
							src={winningRabbitImage}
							alt="Happy Moon Rabbit"
							width="128"
							height="128"
							class="mx-auto size-32 object-contain"
						/>
						<h2 id="upload-result-title" class="text-2xl font-semibold text-[var(--black)]">
							Moon Rabbit found!
						</h2>
						<img
							src={result.upload.imageUrl}
							alt="Successful Moon Rabbit upload"
							class="max-h-[55vh] w-full rounded-md bg-black/5 object-contain"
						/>
						<div
							class="flex items-center justify-center gap-2 text-[var(--accent)]"
							aria-hidden="true"
						>
							<div class="h-px w-8 bg-current"></div>
							<div class="size-2 rotate-45 bg-current"></div>
							<div class="h-px w-8 bg-current"></div>
						</div>
						<p class="text-[var(--grey)]">Good job!</p>
						<div class="grid gap-1 border-t border-black/10 pt-3 text-left text-sm">
							{#if result.upload.comment}
								<p>{result.upload.comment.text}</p>
								{#if result.upload.comment.textZh}<p>{result.upload.comment.textZh}</p>{/if}
							{:else}
								<p class="text-[var(--grey)]">No comment.</p>
							{/if}
						</div>
					</div>
				{:else}
					{#if capturedImageUrl}<img
							src={capturedImageUrl}
							alt="Failed Moon Rabbit attempt"
							class="max-h-[55vh] w-full rounded-md bg-black/5 object-contain"
						/>{/if}
					<div class="grid gap-2">
						<h2 id="upload-result-title" class="text-2xl font-semibold text-[var(--white)]">
							Try again
						</h2>
						{#if result.upload.comment}
							<p class="text-[var(--white)]">{result.upload.comment.text}</p>
							{#if result.upload.comment.textZh}<p class="text-[var(--white)]">
									{result.upload.comment.textZh}
								</p>{/if}
						{:else}
							<p class="text-[var(--white)]">
								{station?.enablePose === false
									? 'Try a different hiding place.'
									: 'Try a different hiding place or pose.'}
							</p>
						{/if}
					</div>
				{/if}
				{#if uploadPassed(result.upload)}
					<Button onclick={() => void goto(`/play/${encodeURIComponent(gameId)}`)}
						>Find next Moon Rabbit</Button
					>
				{:else}
					<Button onclick={tryAgain}>Try again</Button>
				{/if}
			{:else}
				{#if capturedImageUrl}<img
						src={capturedImageUrl}
						alt="Failed Moon Rabbit attempt"
						class="max-h-[55vh] w-full rounded-md bg-black/5 object-contain"
					/>{/if}
				<div class="grid gap-2">
					<h2 id="upload-result-title" class="text-2xl font-semibold text-[var(--white)]">
						Try again
					</h2>
					<p class="text-[var(--white)]" role="alert">{result.error}</p>
				</div>
				<Button onclick={tryAgain}>Try again</Button>
			{/if}
		</section>
	</dialog>
{/if}
