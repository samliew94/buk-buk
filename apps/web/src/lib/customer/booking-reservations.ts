export type BookingReservation = {
	id: string;
	room_category_id: string;
	room_category_name: string;
	room_category_acronym: string | null;
	room_name: string;
	from: string;
	to: string;
	duration: number;
};

// Racing quantity is stored as one reservation per assigned machine.
export function groupBookingReservations(reservations: BookingReservation[]) {
	const groups: (BookingReservation & { rooms: string[]; quantity: number })[] = [];
	for (const reservation of reservations) {
		const existing =
			reservation.room_category_acronym?.toUpperCase() === 'RACING'
				? groups.find(
						(group) =>
							group.room_category_acronym?.toUpperCase() === 'RACING' &&
							group.room_category_id === reservation.room_category_id &&
							group.from === reservation.from &&
							group.to === reservation.to
					)
				: undefined;
		if (existing) {
			existing.rooms.push(reservation.room_name);
			existing.quantity++;
		} else {
			groups.push({ ...reservation, rooms: [reservation.room_name], quantity: 1 });
		}
	}
	return groups;
}
