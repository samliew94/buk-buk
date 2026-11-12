import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => ({
	apiUrl: env.PUBLIC_API_URL || (dev ? 'http://localhost:8787' : ''),
	orderId: params.orderId
});
