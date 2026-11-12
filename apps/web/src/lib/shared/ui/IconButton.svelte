<script lang="ts">
	import Icon from '@iconify/svelte';

	let {
		href,
		icon,
		label,
		variant = 'primary',
		disabled = false,
		iconClass = 'text-xl',
		onclick
	}: {
		href?: string;
		icon: string;
		label: string;
		variant?: 'primary' | 'danger';
		disabled?: boolean;
		iconClass?: string;
		onclick?: (event: MouseEvent) => void;
	} = $props();

	const variantClass = $derived(
		variant === 'danger'
			? 'text-[var(--danger)] hover:bg-[var(--danger)]/10 focus:ring-[var(--danger)]/30'
			: 'text-[var(--primary)] hover:bg-[var(--primary)]/10 focus:ring-[var(--primary)]/30'
	);
</script>

{#if href}
	<a
		{href}
		aria-label={label}
		title={label}
		class={`inline-flex h-10 w-10 items-center justify-center rounded-md transition focus:ring-2 focus:outline-none ${variantClass}`}
	>
		<Icon {icon} class={iconClass} aria-hidden="true" />
	</a>
{:else}
	<button
		type="button"
		{disabled}
		aria-label={label}
		title={label}
		{onclick}
		class={`inline-flex h-10 w-10 items-center justify-center rounded-md transition focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}
	>
		<Icon {icon} class={iconClass} aria-hidden="true" />
	</button>
{/if}
