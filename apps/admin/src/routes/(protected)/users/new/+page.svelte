<script lang="ts">
	import AdminNav from '$lib/auth/AdminNav.svelte';
	import UserForm from '$lib/users/UserForm.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>New manager</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="customer-app">
	<AdminNav links={data.navigation} name={data.name} />
	<main class="mx-auto max-w-lg px-5 py-8">
		<UserForm apiUrl={data.apiUrl} principal={data.principal} />
	</main>
</div>
