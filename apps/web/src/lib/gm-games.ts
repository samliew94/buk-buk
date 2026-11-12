import type { GameDetails, GameStation, StationStatus } from '$lib/api';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: 'numeric',
	minute: '2-digit',
	hour12: true
});

function datePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
	return parts.find((part) => part.type === type)?.value ?? '';
}

function parseApiDate(value: string): Date {
	const normalized = value.includes('T') ? value : value.replace(' ', 'T');
	const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
	return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

export function formatBrowserLocalDate(value: string): string {
	const date = parseApiDate(value);
	if (Number.isNaN(date.getTime())) return '—';

	const parts = dateFormatter.formatToParts(date);
	const year = datePart(parts, 'year');
	const month = datePart(parts, 'month').padStart(2, '0');
	const day = datePart(parts, 'day').padStart(2, '0');
	const hour = datePart(parts, 'hour');
	const minute = datePart(parts, 'minute').padStart(2, '0');
	const period = datePart(parts, 'dayPeriod').toUpperCase();

	return `${year}-${month}-${day} ${hour}:${minute}${period}`;
}

export function countCompletedStations(stations: Pick<GameStation, 'status'>[]): number {
	return stations.filter((station) => station.status === 'completed').length;
}

export function getStationStatusLabel(status: StationStatus): string {
	return status === 'completed' ? 'Completed' : 'Pending';
}

export function getGameCompletedAt(game: Pick<GameDetails, 'stations'>): string | null {
	if (
		game.stations.length === 0 ||
		game.stations.some((station) => station.status !== 'completed')
	) {
		return null;
	}

	const completionDates = game.stations.map((station) => {
		const dates = station.uploads
			.filter((upload) => upload.riddleCorrect && upload.poseCorrect && upload.playerCountCorrect)
			.map((upload) => ({
				value: upload.createdAt,
				time: parseApiDate(upload.createdAt).getTime()
			}))
			.filter(({ time }) => !Number.isNaN(time));
		return dates.length > 0
			? dates.reduce((latest, current) => (current.time > latest.time ? current : latest))
			: null;
	});

	if (completionDates.some((date) => date === null)) return null;
	const validCompletionDates = completionDates.filter(
		(date): date is { value: string; time: number } => date !== null
	);

	return validCompletionDates.reduce((latest, current) =>
		current.time > latest.time ? current : latest
	).value;
}

export function formatGameDuration(start: string, end: string): string | null {
	const duration = parseApiDate(end).getTime() - parseApiDate(start).getTime();
	if (!Number.isFinite(duration) || duration < 0) return null;

	const totalMinutes = Math.floor(duration / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}
