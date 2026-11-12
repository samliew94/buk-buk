<script lang="ts">
	import Icon from '@iconify/svelte';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		icon,
		children,
		type = 'button',
		...attributes
	}: HTMLButtonAttributes & {
		variant?: 'ghost' | 'primary' | 'secondary';
		icon?: `mdi:${string}`;
		children?: Snippet;
	} = $props();
</script>

<button {...attributes} {type} class={['booking-button', attributes.class]} data-variant={variant}>
	{#if icon}<Icon {icon} class="size-5" aria-hidden="true" />{/if}
	{@render children?.()}
</button>
