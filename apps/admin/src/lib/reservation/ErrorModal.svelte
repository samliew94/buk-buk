<script lang="ts">
	import Icon from '@iconify/svelte';
	let {
		title = 'Incomplete Selection',
		description,
		onclose
	}: {
		title?: string;
		description: string;
		onclose: () => void;
	} = $props();
	let dialog: HTMLDialogElement;
	$effect(() => {
		if (description) dialog?.showModal();
		else dialog?.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="booking-error-title"
	aria-describedby="booking-error-description"
	{onclose}
	onclick={(event) => {
		if (event.target !== dialog) return;
		const bounds = dialog.getBoundingClientRect();
		if (
			event.clientX < bounds.left ||
			event.clientX > bounds.right ||
			event.clientY < bounds.top ||
			event.clientY > bounds.bottom
		)
			dialog.close();
	}}
	class="fixed inset-0 m-auto w-[calc(100%-3rem)] max-w-96 overflow-visible rounded-xl border-0 bg-booking-white px-6 pt-[60px] pb-10 text-center text-booking-black shadow-2xl backdrop:bg-booking-white/33 backdrop:backdrop-blur-[2px]"
>
	<div
		class="absolute -top-10 left-1/2 flex size-20 -translate-x-1/2 items-center justify-center rounded-full bg-booking-black"
		aria-hidden="true"
	>
		<Icon icon="mdi:exclamation-thick" class="size-12 text-booking-primary" />
	</div>
	<h2 id="booking-error-title" class="text-[22px]! font-bold">{title}</h2>
	<p
		id="booking-error-description"
		class="mt-5 font-poppins text-[18px]! leading-normal font-normal"
	>
		{description}
	</p>
</dialog>
