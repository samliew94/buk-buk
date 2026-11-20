import type { Principal } from '$lib/auth/session';

export type User = Principal & { username: string; is_banned: boolean };
