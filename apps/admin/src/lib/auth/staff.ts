import { goto } from '$app/navigation';
import { ApiError, protectedFetch } from './session';

export function staffFetch(apiUrl: string, path: string, init: RequestInit = {}) {
	return protectedFetch(apiUrl, path, init, () => {
		void goto('/login', { replaceState: true });
	});
}

export function requestMessage(error: unknown, fallback: string) {
	return error instanceof ApiError && error.status === 403 ? error.message : fallback;
}
