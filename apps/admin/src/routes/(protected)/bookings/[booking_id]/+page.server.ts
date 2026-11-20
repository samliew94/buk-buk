import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => ({ bookingId: params.booking_id });
