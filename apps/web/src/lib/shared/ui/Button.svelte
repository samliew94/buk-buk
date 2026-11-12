<script lang="ts">
	let {
		type = 'button',
		variant = 'primary',
		disabled = false,
		loading = false,
		loadingLabel = 'Loading...',
		onclick,
		children
	}: {
		type?: 'button' | 'submit' | 'reset';
		variant?: 'primary' | 'success' | 'grey';
		disabled?: boolean;
		loading?: boolean;
		loadingLabel?: string;
		onclick?: (event: MouseEvent) => void;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<button
	{type}
	disabled={disabled || loading}
	aria-busy={loading}
	{onclick}
	class={`w-full rounded-md px-4 py-2.5 text-sm font-semibold text-[var(--white)] transition hover:opacity-90 focus:ring-2 focus:ring-[var(--primary)]/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${variant === 'success' ? 'bg-[var(--success)]' : variant === 'grey' ? 'bg-[var(--grey)]' : 'bg-[var(--primary)]'}`}
>
	{#if loading}{loadingLabel}{:else}{@render children?.()}{/if}
</button>
