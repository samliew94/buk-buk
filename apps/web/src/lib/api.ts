import axios from 'axios';
import { env } from '$env/dynamic/public';

export const api = axios.create({
	headers: {
		'Content-Type': 'application/json'
	}
});

export interface GmLoginResponse {
	token: string;
}

export interface ExchangeTokenResponse {
	token: string;
	expiresAt: string;
}

export interface PlayerLoginResponse {
	token: string;
	expiresAt: string;
	gameId: string;
}

export type StationStatus = 'pending' | 'completed';
export interface UpdateStationStatusInput {
	status: StationStatus;
}
export interface UpdatedStationStatus {
	id: number;
	status: StationStatus;
}
export interface UpdatePlayerInput {
	name?: string;
	pax?: number;
}
export interface UpdatedPlayer {
	id: number;
	name: string;
	pax: number;
}
export interface GameStation {
	id: number;
	status: StationStatus;
}

export interface Game {
	id: number;
	publicId: string;
	enablePose: boolean;
	createdAt: string;
	updatedAt: string;
	player: {
		id: number;
		name: string;
		pax: number;
	};
	stations: GameStation[];
}

export interface GameListResponse {
	games: Game[];
}

export interface StationListResponse {
	stations: GameStation[];
}

export interface GameUploadPhoto {
	id: number;
	stationId: number;
	stationNumber: number;
	imageUrl: string;
	createdAt: string;
}

export interface GalleryPhoto {
	id: number;
	imageUrl: string;
	createdAt: string;
}

export interface GameUploadsResponse {
	photos: GameUploadPhoto[];
	galleryPhotos: GalleryPhoto[];
}

export interface StationPresetItem {
	id: number;
	riddleId: number;
	poseId: number;
	sortOrder: number;
	riddle: Riddle;
	pose: Pose;
}

export interface StationPreset {
	id: number;
	description: string;
	items: StationPresetItem[];
}

export interface StationPresetItemInput {
	riddleId: number;
	poseId: number;
}

export interface StationPresetInput {
	description: string;
	items: StationPresetItemInput[];
}

export interface CreateGameInput {
	enablePose?: boolean;
	player: {
		name: string;
		pax: number;
	};
	stationPresetId: number;
}

export interface GameRiddle {
	id: number;
	question: string;
	questionZh: string | null;
	answer: string;
}

export interface GamePose {
	id: number;
	imageUrl: string;
	description: string | null;
}

export interface RiddleInput {
	question: string;
	questionZh: string;
	answer: string;
}

export interface PoseInput {
	imageUrl: string;
	description?: string | null;
}

export interface Riddle extends Omit<RiddleInput, 'questionZh'> {
	id: number;
	questionZh: string | null;
}

export interface Pose {
	id: number;
	imageUrl: string;
	description: string | null;
}

export interface CreatePosesInput {
	poses: PoseInput[];
}

export interface CreatePosesResponse {
	poses: Pose[];
}

export interface Bucket {
	id: number;
	objectKey: string;
	createdAt: string;
}

export interface GameComment {
	id: number;
	text: string;
	textZh: string | null;
	createdAt: string;
}

export interface GameUpload {
	id: number;
	imageUrl: string;
	createdAt: string;
	riddleCorrect: boolean;
	poseCorrect: boolean;
	playerCountCorrect: boolean;
	comment: GameComment | null;
}

export interface StationUploadResponse extends GameUpload {
	status: StationStatus;
}

export interface GameStationDetails extends GameStation {
	sortOrder: number;
	riddle: GameRiddle;
	pose: GamePose;
	uploads: GameUpload[];
}

export interface PlayerStationDetails extends GameStation {
	enablePose: boolean;
	sortOrder: number;
	riddle: {
		id: number;
		question: string;
		questionZh: string | null;
	};
	pose: GamePose;
	uploads: GameUpload[];
}

export interface GameDetails extends Omit<Game, 'stations'> {
	stations: GameStationDetails[];
}

export type DetailedGame = GameDetails;

export class InvalidApiResponseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidApiResponseError';
	}
}

function isStation(value: unknown): value is GameStation {
	if (!isRecord(value)) return false;
	return (
		typeof value.id === 'number' && (value.status === 'pending' || value.status === 'completed')
	);
}

function isUpdatedStationStatus(value: unknown): value is UpdatedStationStatus {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		(value.status === 'pending' || value.status === 'completed')
	);
}

function isUpdatedPlayer(value: unknown): value is UpdatedPlayer {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.name === 'string' &&
		typeof value.pax === 'number' &&
		Number.isSafeInteger(value.pax) &&
		value.pax > 0
	);
}

function isStationListResponse(value: unknown): value is StationListResponse {
	return isRecord(value) && Array.isArray(value.stations) && value.stations.every(isStation);
}

function isGameUploadPhoto(value: unknown): value is GameUploadPhoto {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		Number.isSafeInteger(value.id) &&
		value.id > 0 &&
		typeof value.stationId === 'number' &&
		Number.isSafeInteger(value.stationId) &&
		value.stationId > 0 &&
		typeof value.stationNumber === 'number' &&
		Number.isSafeInteger(value.stationNumber) &&
		value.stationNumber > 0 &&
		typeof value.imageUrl === 'string' &&
		typeof value.createdAt === 'string'
	);
}

function isGalleryPhoto(value: unknown): value is GalleryPhoto {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		Number.isSafeInteger(value.id) &&
		value.id > 0 &&
		typeof value.imageUrl === 'string' &&
		typeof value.createdAt === 'string'
	);
}

function isGameUploadsResponse(value: unknown): value is GameUploadsResponse {
	return (
		isRecord(value) &&
		Array.isArray(value.photos) &&
		value.photos.every(isGameUploadPhoto) &&
		Array.isArray(value.galleryPhotos) &&
		value.galleryPhotos.every(isGalleryPhoto)
	);
}

function isGameRiddle(value: unknown): value is GameRiddle {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.question === 'string' &&
		(value.questionZh === null || typeof value.questionZh === 'string') &&
		typeof value.answer === 'string'
	);
}

function isGamePose(value: unknown): value is GamePose {
	return (
		isRecord(value) &&
		Object.keys(value).every((key) => ['id', 'imageUrl', 'description'].includes(key)) &&
		typeof value.id === 'number' &&
		typeof value.imageUrl === 'string' &&
		(value.description === null || typeof value.description === 'string')
	);
}

function isRiddle(value: unknown): value is Riddle {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.question === 'string' &&
		(value.questionZh === null || typeof value.questionZh === 'string') &&
		typeof value.answer === 'string'
	);
}

function isPose(value: unknown): value is Pose {
	return (
		isRecord(value) &&
		Object.keys(value).every((key) => ['id', 'imageUrl', 'description'].includes(key)) &&
		typeof value.id === 'number' &&
		typeof value.imageUrl === 'string' &&
		(value.description === null || typeof value.description === 'string')
	);
}

function isCreatePosesResponse(value: unknown): value is CreatePosesResponse {
	return (
		isRecord(value) &&
		Array.isArray(value.poses) &&
		value.poses.length > 0 &&
		value.poses.every(isPose)
	);
}

function isBucket(value: unknown): value is Bucket {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.objectKey === 'string' &&
		typeof value.createdAt === 'string'
	);
}

function isGameComment(value: unknown): value is GameComment {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.text === 'string' &&
		(value.textZh === null || typeof value.textZh === 'string') &&
		typeof value.createdAt === 'string'
	);
}

function isGameUpload(value: unknown): value is GameUpload {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.imageUrl === 'string' &&
		typeof value.createdAt === 'string' &&
		typeof value.riddleCorrect === 'boolean' &&
		typeof value.poseCorrect === 'boolean' &&
		typeof value.playerCountCorrect === 'boolean' &&
		(value.comment === null || isGameComment(value.comment))
	);
}

function isStationUploadResponse(value: unknown): value is StationUploadResponse {
	return (
		isGameUpload(value) &&
		isRecord(value) &&
		(value.status === 'pending' || value.status === 'completed')
	);
}

function isGameStationDetails(value: unknown): value is GameStationDetails {
	return (
		isStation(value) &&
		isRecord(value) &&
		typeof value.sortOrder === 'number' &&
		isGameRiddle(value.riddle) &&
		isGamePose(value.pose) &&
		Array.isArray(value.uploads) &&
		value.uploads.every(isGameUpload)
	);
}

function isPlayerStationDetails(value: unknown): value is PlayerStationDetails {
	return (
		isStation(value) &&
		isRecord(value) &&
		typeof value.enablePose === 'boolean' &&
		typeof value.sortOrder === 'number' &&
		isRecord(value.riddle) &&
		typeof value.riddle.id === 'number' &&
		typeof value.riddle.question === 'string' &&
		(value.riddle.questionZh === null || typeof value.riddle.questionZh === 'string') &&
		isGamePose(value.pose) &&
		Array.isArray(value.uploads) &&
		value.uploads.every(isGameUpload)
	);
}

function isGame(value: unknown): value is Game {
	if (!isRecord(value) || !isRecord(value.player) || !Array.isArray(value.stations)) {
		return false;
	}

	return (
		typeof value.id === 'number' &&
		typeof value.publicId === 'string' &&
		typeof value.enablePose === 'boolean' &&
		typeof value.createdAt === 'string' &&
		typeof value.updatedAt === 'string' &&
		typeof value.player.id === 'number' &&
		typeof value.player.name === 'string' &&
		typeof value.player.pax === 'number' &&
		Number.isSafeInteger(value.player.pax) &&
		value.player.pax > 0 &&
		value.stations.every(isStation)
	);
}

function isGameDetails(value: unknown): value is GameDetails {
	if (!isRecord(value) || !isRecord(value.player) || !Array.isArray(value.stations)) {
		return false;
	}

	return (
		typeof value.id === 'number' &&
		typeof value.publicId === 'string' &&
		typeof value.enablePose === 'boolean' &&
		typeof value.createdAt === 'string' &&
		typeof value.updatedAt === 'string' &&
		typeof value.player.id === 'number' &&
		typeof value.player.name === 'string' &&
		typeof value.player.pax === 'number' &&
		Number.isSafeInteger(value.player.pax) &&
		value.player.pax > 0 &&
		value.stations.every(isGameStationDetails)
	);
}

function isStationPresetItem(value: unknown): value is StationPresetItem {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.riddleId === 'number' &&
		typeof value.poseId === 'number' &&
		typeof value.sortOrder === 'number' &&
		isRiddle(value.riddle) &&
		isPose(value.pose)
	);
}

function isStationPreset(value: unknown): value is StationPreset {
	return (
		isRecord(value) &&
		typeof value.id === 'number' &&
		typeof value.description === 'string' &&
		Array.isArray(value.items) &&
		value.items.every(isStationPresetItem)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthTokenResponse(value: unknown): value is ExchangeTokenResponse {
	return (
		isRecord(value) &&
		typeof value.token === 'string' &&
		value.token.length > 0 &&
		typeof value.expiresAt === 'string' &&
		value.expiresAt.length > 0
	);
}

function isPlayerLoginResponse(value: unknown): value is PlayerLoginResponse {
	return (
		isAuthTokenResponse(value) &&
		isRecord(value) &&
		typeof value.gameId === 'string' &&
		value.gameId.length > 0
	);
}

function getApiUrl(): string {
	const apiUrl = env.PUBLIC_API_URL;
	if (!apiUrl) throw new Error('PUBLIC_API_URL is not configured.');
	return apiUrl;
}

export function getAssetUrl(objectKey: string): string {
	const assetUrl = env.PUBLIC_CDN_URL;
	if (!assetUrl) throw new Error('PUBLIC_CDN_URL is not configured.');
	const encodedKey = objectKey
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
	return `${assetUrl.replace(/\/+$/, '')}/${encodedKey}`;
}

export async function loginGm(password: string): Promise<GmLoginResponse> {
	const { data } = await api.post<unknown>(`${getApiUrl()}/v1/auth/gm/login`, { password });

	if (!isRecord(data) || typeof data.token !== 'string' || data.token.length === 0) {
		throw new InvalidApiResponseError('Login response was invalid. Please try again.');
	}

	return { token: data.token };
}

export async function exchangeToken(gameId: string, token: string): Promise<ExchangeTokenResponse> {
	const { data } = await api.post<unknown>(
		`${getApiUrl()}/v1/auth/exchange-token`,
		{ gameId },
		{
			headers: { Authorization: `Bearer ${token}` }
		}
	);

	if (!isAuthTokenResponse(data)) {
		throw new InvalidApiResponseError('Player login token response was invalid. Please try again.');
	}

	return data;
}

export async function loginPlayer(token: string): Promise<PlayerLoginResponse> {
	const { data } = await api.post<unknown>(`${getApiUrl()}/v1/auth/player/login`, { token });

	if (!isPlayerLoginResponse(data)) {
		throw new InvalidApiResponseError('Player login response was invalid. Please try again.');
	}

	return data;
}

export async function getGames(token: string): Promise<GameListResponse> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/games`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isRecord(data) || !Array.isArray(data.games) || !data.games.every(isGame)) {
		throw new InvalidApiResponseError('Games response was invalid. Please try again.');
	}

	return { games: data.games };
}

export async function getStationPresets(token: string): Promise<StationPreset[]> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/station-presets`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!Array.isArray(data) || !data.every(isStationPreset)) {
		throw new InvalidApiResponseError('Station presets response was invalid. Please try again.');
	}

	return data;
}

export async function getStationPreset(id: number, token: string): Promise<StationPreset> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/station-presets/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isStationPreset(data)) {
		throw new InvalidApiResponseError('Station preset response was invalid. Please try again.');
	}

	return data;
}

export async function createStationPreset(
	input: StationPresetInput,
	token: string
): Promise<StationPreset> {
	const { data } = await api.post<unknown>(`${getApiUrl()}/v1/station-presets`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isStationPreset(data)) {
		throw new InvalidApiResponseError(
			'Created station preset response was invalid. Please try again.'
		);
	}

	return data;
}

export async function cloneStationPreset(
	id: number,
	name: string,
	token: string
): Promise<StationPreset> {
	const { data } = await api.post<unknown>(
		`${getApiUrl()}/v1/station-presets/${id}/clone`,
		{ name },
		{ headers: { Authorization: `Bearer ${token}` } }
	);

	if (!isStationPreset(data)) {
		throw new InvalidApiResponseError(
			'Cloned station preset response was invalid. Please try again.'
		);
	}

	return data;
}

export async function deleteStationPreset(id: number, token: string): Promise<void> {
	const response = await api.delete(`${getApiUrl()}/v1/station-presets/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (response.status !== 204) {
		throw new InvalidApiResponseError(
			'Delete station preset response was invalid. Please try again.'
		);
	}
}

export async function updateStationPreset(
	id: number,
	input: StationPresetInput,
	token: string
): Promise<StationPreset> {
	const { data } = await api.put<unknown>(`${getApiUrl()}/v1/station-presets/${id}`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isStationPreset(data)) {
		throw new InvalidApiResponseError(
			'Updated station preset response was invalid. Please try again.'
		);
	}

	return data;
}

export async function getRiddles(token: string): Promise<Riddle[]> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/riddles`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!Array.isArray(data) || !data.every(isRiddle)) {
		throw new InvalidApiResponseError('Riddles response was invalid. Please try again.');
	}

	return data;
}

export async function getRiddle(id: number, token: string): Promise<Riddle> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/riddles/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isRiddle(data)) {
		throw new InvalidApiResponseError('Riddle response was invalid. Please try again.');
	}

	return data;
}

export async function createRiddle(input: RiddleInput, token: string): Promise<Riddle> {
	const { data } = await api.post<unknown>(`${getApiUrl()}/v1/riddles`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isRiddle(data)) {
		throw new InvalidApiResponseError('Created riddle response was invalid. Please try again.');
	}

	return data;
}

export async function updateRiddle(id: number, input: RiddleInput, token: string): Promise<Riddle> {
	const { data } = await api.put<unknown>(`${getApiUrl()}/v1/riddles/${id}`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isRiddle(data)) {
		throw new InvalidApiResponseError('Updated riddle response was invalid. Please try again.');
	}

	return data;
}

export async function deleteRiddle(id: number, token: string): Promise<void> {
	const response = await api.delete(`${getApiUrl()}/v1/riddles/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (response.status !== 204) {
		throw new InvalidApiResponseError('Delete riddle response was invalid. Please try again.');
	}
}

export async function getPoses(token: string): Promise<Pose[]> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/poses`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!Array.isArray(data) || !data.every(isPose)) {
		throw new InvalidApiResponseError('Poses response was invalid. Please try again.');
	}

	return data;
}

export async function getPose(id: number, token: string): Promise<Pose> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/poses/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isPose(data)) {
		throw new InvalidApiResponseError('Pose response was invalid. Please try again.');
	}

	return data;
}

export async function getBuckets(prefix: string, token: string): Promise<Bucket[]> {
	const { data } = await api.get<unknown>(getApiUrl() + '/v1/buckets', {
		params: { prefix },
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!Array.isArray(data) || !data.every(isBucket)) {
		throw new InvalidApiResponseError('Bucket response was invalid. Please try again.');
	}

	return data;
}

export async function uploadBuckets(
	prefix: string,
	files: File[],
	token: string
): Promise<Bucket[]> {
	const formData = new FormData();
	formData.append('prefix', prefix);
	for (const file of files) formData.append('files', file);

	const { data } = await api.post<unknown>(getApiUrl() + '/v1/buckets', formData, {
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'multipart/form-data'
		}
	});

	if (!Array.isArray(data) || !data.every(isBucket)) {
		throw new InvalidApiResponseError('Bucket upload response was invalid. Please try again.');
	}

	return data;
}

export async function createPoses(
	input: CreatePosesInput,
	token: string
): Promise<CreatePosesResponse> {
	const { data } = await api.post<unknown>(`${getApiUrl()}/v1/poses`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isCreatePosesResponse(data)) {
		throw new InvalidApiResponseError('Created poses response was invalid. Please try again.');
	}

	return data;
}

export async function updatePose(id: number, input: PoseInput, token: string): Promise<Pose> {
	const { data } = await api.put<unknown>(`${getApiUrl()}/v1/poses/${id}`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isPose(data)) {
		throw new InvalidApiResponseError('Updated pose response was invalid. Please try again.');
	}

	return data;
}

export async function deletePose(id: number, token: string): Promise<void> {
	const response = await api.delete(`${getApiUrl()}/v1/poses/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (response.status !== 204) {
		throw new InvalidApiResponseError('Delete pose response was invalid. Please try again.');
	}
}

export async function createGame(input: CreateGameInput, token: string): Promise<Game> {
	const { data } = await api.post<unknown>(`${getApiUrl()}/v1/games`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isGame(data)) {
		throw new InvalidApiResponseError('Created game response was invalid. Please try again.');
	}

	return data;
}

export async function getGame(id: number, token: string): Promise<GameDetails> {
	const { data } = await api.get<unknown>(`${getApiUrl()}/v1/games/${id}`, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!isGameDetails(data)) {
		throw new InvalidApiResponseError('Game response was invalid. Please try again.');
	}

	return data;
}

export async function updateStationStatus(
	id: number,
	input: UpdateStationStatusInput,
	token: string
): Promise<UpdatedStationStatus> {
	const { data } = await api.put<unknown>(`${getApiUrl()}/v1/stations/${id}`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!isUpdatedStationStatus(data))
		throw new InvalidApiResponseError('Updated station response was invalid. Please try again.');
	return data;
}

export async function updatePlayer(
	id: number,
	input: UpdatePlayerInput,
	token: string
): Promise<UpdatedPlayer> {
	const { data } = await api.put<unknown>(`${getApiUrl()}/v1/players/${id}`, input, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!isUpdatedPlayer(data))
		throw new InvalidApiResponseError('Updated player response was invalid. Please try again.');
	return data;
}

export async function getStationList(gameId: string, token: string): Promise<StationListResponse> {
	const { data } = await api.get<unknown>(
		`${getApiUrl()}/v1/games/${encodeURIComponent(gameId)}/stations`,
		{
			headers: { Authorization: `Bearer ${token}` }
		}
	);

	if (!isStationListResponse(data)) {
		throw new InvalidApiResponseError('Stations response was invalid. Please try again.');
	}

	return data;
}

export async function getGameUploads(gameId: string, token: string): Promise<GameUploadsResponse> {
	const { data } = await api.get<unknown>(
		`${getApiUrl()}/v1/games/${encodeURIComponent(gameId)}/uploads`,
		{
			headers: { Authorization: `Bearer ${token}` }
		}
	);

	if (!isGameUploadsResponse(data)) {
		throw new InvalidApiResponseError('Uploads response was invalid. Please try again.');
	}

	return data;
}

export async function getStationDetails(
	gameId: string,
	stationId: number,
	token: string
): Promise<PlayerStationDetails> {
	const { data } = await api.get<unknown>(
		`${getApiUrl()}/v1/games/${encodeURIComponent(gameId)}/stations/${stationId}`,
		{
			headers: { Authorization: `Bearer ${token}` }
		}
	);

	if (!isPlayerStationDetails(data)) {
		throw new InvalidApiResponseError('Station response was invalid. Please try again.');
	}

	return data;
}

export async function uploadStationPhoto(
	gameId: string,
	stationId: number,
	file: File,
	token: string
): Promise<StationUploadResponse> {
	const formData = new FormData();
	formData.append('file', file);

	const { data } = await api.post<unknown>(
		`${getApiUrl()}/v1/games/${encodeURIComponent(gameId)}/stations/${stationId}/upload`,
		formData,
		{
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'multipart/form-data'
			}
		}
	);

	if (!isStationUploadResponse(data)) {
		throw new InvalidApiResponseError('Photo upload response was invalid. Please try again.');
	}

	return data;
}
