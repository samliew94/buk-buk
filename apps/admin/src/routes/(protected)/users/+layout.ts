import { error, redirect } from '@sveltejs/kit';
import { ApiError, protectedFetch, type Principal } from '$lib/auth/session';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
	const data = await parent();
	let principal: Principal;
	try {
		const response = await protectedFetch(
			data.apiUrl,
			'/v1/auth/me',
			{ signal: AbortSignal.timeout(8000) },
			() => {}
		);
		if (!response.ok) throw new Error();
		principal = await response.json();
		if (
			typeof principal?.id !== 'string' ||
			!principal.id ||
			!['developer', 'manager'].includes(principal.role)
		)
			throw new Error();
	} catch (cause) {
		if (cause instanceof ApiError && cause.status === 401) redirect(307, '/login');
		if (cause instanceof ApiError && cause.status === 403) error(403, 'Access denied.');
		error(503, 'Unable to verify your session. Reload to try again.');
	}

	return { principal };
};
