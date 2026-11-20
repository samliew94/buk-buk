import { redirect } from '@sveltejs/kit';
import { hasStoredSession, publicFetch } from '$lib/auth/session';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = async ({ parent }) => {
	const data = await parent();
	if (!hasStoredSession()) redirect(307, '/login');

	let name = '';
	try {
		const response = await publicFetch(
			data.apiUrl,
			`/v1/businesses/${encodeURIComponent(data.businessId)}`,
			{ signal: AbortSignal.timeout(8000) }
		);
		if (response.ok) {
			const business: { name?: string } | null = await response.json();
			name = business?.name ?? '';
		}
	} catch {
		// Navigation remains available if business branding cannot be loaded.
	}
	return { ...data, name };
};
