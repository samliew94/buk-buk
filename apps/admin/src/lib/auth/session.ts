export type Principal = { id: string; role: 'developer' | 'manager' };
type Tokens = { access_token: string; refresh_token: string };

export class ApiError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const storageKey = 'auth';
const storageMessage = 'Browser storage is unavailable. Allow local storage and try again.';
let generation = 0;
let signingIn: number | undefined;
let locallySignedOut = false;
let refreshInFlight: Promise<Tokens> | undefined;

function tokenPair(value: unknown): Tokens {
	if (
		!value ||
		typeof value !== 'object' ||
		!('access_token' in value) ||
		!('refresh_token' in value) ||
		typeof value.access_token !== 'string' ||
		typeof value.refresh_token !== 'string' ||
		!value.access_token.trim() ||
		!value.refresh_token.trim()
	)
		throw new Error('The server returned an incomplete session. Please try again.');
	return { access_token: value.access_token, refresh_token: value.refresh_token };
}

function storedTokens(): Tokens | null {
	if (locallySignedOut) return null;
	let value: string | null;
	try {
		value = localStorage.getItem(storageKey);
	} catch {
		return null;
	}
	if (!value) return null;
	try {
		return tokenPair(JSON.parse(value));
	} catch {
		return null;
	}
}

export function hasStoredSession(): boolean {
	return storedTokens() !== null;
}

function writeTokens(value: unknown, session: number): Tokens {
	if (session !== generation) throw new Error('Session changed.');
	const pair = tokenPair(value);
	try {
		localStorage.setItem(storageKey, JSON.stringify(pair));
	} catch {
		throw new Error(storageMessage);
	}
	locallySignedOut = false;
	return pair;
}

export function clearSession() {
	locallySignedOut = true;
	generation++;
	signingIn = undefined;
	refreshInFlight = undefined;
	try {
		localStorage.removeItem(storageKey);
	} catch {
		// Storage can be disabled while a session is open.
	}
}

function apiRequest(apiUrl: string, path: string, init: RequestInit, accessToken?: string) {
	const base = new URL(apiUrl);
	const url = new URL(path, base);
	if (
		!['http:', 'https:'].includes(base.protocol) ||
		base.username ||
		base.password ||
		url.origin !== base.origin
	)
		throw new Error('Invalid API origin.');
	const headers = new Headers(init.headers);
	headers.delete('Authorization');
	if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
	return fetch(url, { ...init, headers, credentials: 'omit', redirect: 'error' });
}

export function publicFetch(apiUrl: string, path: string, init: RequestInit = {}) {
	return apiRequest(apiUrl, path, init);
}

function postJson(body: object): RequestInit {
	return {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(8000)
	};
}

export async function signIn(apiUrl: string, username: string, password: string) {
	const session = ++generation;
	signingIn = session;
	refreshInFlight = undefined;
	try {
		const response = await publicFetch(apiUrl, '/v1/auth/login', postJson({ username, password }));
		if (response.status === 401) throw new Error('The username or password is incorrect.');
		if (!response.ok) throw new Error('Unable to sign in. Please try again.');
		writeTokens(await response.json(), session);
	} finally {
		if (signingIn === session) signingIn = undefined;
	}
}

function renew(apiUrl: string, pair: Tokens, session: number) {
	if (!refreshInFlight) {
		const pending = (async () => {
			const response = await publicFetch(
				apiUrl,
				'/v1/auth/refresh',
				postJson({ refresh_token: pair.refresh_token })
			);
			if (!response.ok) throw new ApiError(401, 'Please sign in.');
			return writeTokens(await response.json(), session);
		})().finally(() => {
			if (refreshInFlight === pending) refreshInFlight = undefined;
		});
		refreshInFlight = pending;
	}
	return refreshInFlight;
}

export async function protectedFetch(
	apiUrl: string,
	path: string,
	init: RequestInit,
	onUnauthorized: () => void
): Promise<Response> {
	if (signingIn !== undefined) throw new ApiError(401, 'Sign-in is in progress.');
	const session = generation;
	const unauthorized = () => {
		if (session === generation) {
			clearSession();
			onUnauthorized();
		}
		throw new ApiError(401, 'Please sign in.');
	};
	const pair = storedTokens();
	if (!pair) return unauthorized();
	let response = await apiRequest(apiUrl, path, init, pair.access_token);
	if (session !== generation) throw new ApiError(401, 'Please sign in.');
	if (response.status === 401) {
		const current = storedTokens();
		if (!current) return unauthorized();
		let replacement: Tokens;
		try {
			replacement =
				current.access_token === pair.access_token
					? await renew(apiUrl, current, session)
					: current;
		} catch {
			return unauthorized();
		}
		if (session !== generation) throw new ApiError(401, 'Please sign in.');
		response = await apiRequest(apiUrl, path, init, replacement.access_token);
		if (session !== generation) throw new ApiError(401, 'Please sign in.');
		if (response.status === 401) return unauthorized();
	}
	if (response.status === 403) throw new ApiError(403, 'Access denied.');
	return response;
}
