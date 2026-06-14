import { normalizeMetadataList, normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';

export function parseOverseerrPayload(payload) {
	let media_type = payload.media?.media_type || payload.media_type || 'movie';
	if (!media_type && payload.subject) {
		media_type = payload.subject.includes('Movie') ? 'movie' : 'tv';
	}

	let extraTmdbId = null;
	if (Array.isArray(payload.extra)) {
		const tmdbExtra = payload.extra.find(
			(item) => item && item.name && typeof item.name === 'string' && item.name.toLowerCase().includes('tmdb')
		);
		if (tmdbExtra) {
			extraTmdbId = tmdbExtra.value;
		}
	}

	const tmdbId = payload.media?.tmdbId || payload.tmdb_id || extraTmdbId;
	const tvdbId = payload.media?.tvdbId || payload.tvdb_id;
	let requestedSeasons = payload.request?.seasons || payload.requested_seasons;
	if (typeof requestedSeasons === 'string') {
		try {
			requestedSeasons = JSON.parse(requestedSeasons);
		} catch (_error) {
			requestedSeasons = null;
		}
	}

	const title = payload.title || payload.subject || payload.media?.title || 'Unknown';
	const year = payload.year || payload.media?.year;
	const existingMetadata = {
		overview: payload.overview,
		genres: payload.genres,
		keywords: payload.keywords,
		content_rating: payload.content_rating,
		original_language: payload.original_language,
		retry_count: payload.retry_count,
		max_retries: payload.max_retries,
		retry_lineage: payload.retry_lineage,
		itemId: payload.itemId,
		source_library_id: payload.source_library_id,
		source_library_name: payload.source_library_name,
		requested_seasons: Array.isArray(requestedSeasons) ? requestedSeasons : null,
		include_specials: payload.include_specials === true,
		tvdb_id: tvdbId,
	};

	const taskId = payload.taskId;

	return { media_type, tmdbId, title, year, existingMetadata, taskId };
}

export function mightBeAnime(metadata) {
	const keywords = normalizeMetadataListLower(metadata.keywords);
	const genres = normalizeMetadataListLower(metadata.genres);

	return (
		keywords.includes('anime') ||
		metadata.original_language === 'ja' ||
		genres.includes('anime') ||
		keywords.some((keyword) => ['shounen', 'shoujo', 'seinen', 'isekai', 'mecha'].includes(keyword))
	);
}

export function detectEventTypesFromMetadata(metadata) {
	const normalizedKeywords = normalizeMetadataList(metadata.keywords);
	const normalizedGenres = normalizeMetadataList(metadata.genres);
	const textToSearch = [
		metadata.title || '',
		metadata.overview || '',
		...normalizedKeywords,
		...normalizedGenres,
	].join(' ').toLowerCase();

	const eventKeywords = {
		holiday: ['christmas', 'xmas', 'santa', 'halloween', 'thanksgiving', 'easter', 'hanukkah', 'kwanzaa', 'new years eve', 'holiday'],
		sports: ['nfl', 'nba', 'mlb', 'nhl', 'mls', 'fifa', 'super bowl', 'world series', 'olympics', 'championship', 'playoffs'],
		ppv: ['ufc', 'mma', 'boxing', 'wwe', 'wrestling', 'wrestlemania', 'bellator', 'fight night', 'knockout'],
		concert: ['concert', 'live tour', 'music festival', 'live performance', 'symphony', 'orchestra', 'unplugged'],
		standup: ['stand-up', 'standup', 'comedy special', 'comedian', 'comedy tour', 'roast', 'improv'],
		awards: ['oscars', 'academy awards', 'emmys', 'golden globes', 'grammys', 'tony awards', 'bafta', 'red carpet'],
	};

	const matchedTypes = [];
	for (const [eventType, keywords] of Object.entries(eventKeywords)) {
		if (keywords.some((keyword) => textToSearch.includes(keyword))) {
			matchedTypes.push(eventType);
		}
	}
	return matchedTypes;
}

export function mergeMetadataForRecheck(originalMetadata, enrichedMetadata) {
	if (!enrichedMetadata) {
		return { ...originalMetadata };
	}

	const merged = { ...originalMetadata };
	const getTrimmedLength = (value) => (typeof value === 'string' ? value.trim().length : 0);

	const shouldReplaceList = (key) => {
		const incomingList = normalizeMetadataList(enrichedMetadata[key]);
		if (incomingList.length === 0) {
			return false;
		}
		const currentList = normalizeMetadataList(merged[key]);
		if (currentList.length === 0) {
			return true;
		}
		return incomingList.length > currentList.length;
	};

	const shouldReplaceNamedObject = (key) => {
		const currentLength = getTrimmedLength(merged[key]?.name);
		const incomingLength = getTrimmedLength(enrichedMetadata[key]?.name);
		if (incomingLength === 0) {
			return false;
		}
		if (currentLength === 0) {
			return true;
		}
		return incomingLength > currentLength;
	};

	const shouldReplaceString = (key) => {
		const currentLength = getTrimmedLength(merged[key]);
		const incomingLength = getTrimmedLength(enrichedMetadata[key]);
		if (incomingLength === 0) {
			return false;
		}
		if (currentLength === 0) {
			return true;
		}
		if (key === 'overview') {
			return incomingLength > currentLength && (currentLength < 40 || incomingLength - currentLength >= 20);
		}
		return incomingLength > currentLength;
	};

	if (shouldReplaceList('genres')) {
		merged.genres = enrichedMetadata.genres;
	}
	if (shouldReplaceList('keywords')) {
		merged.keywords = enrichedMetadata.keywords;
	}
	if (shouldReplaceNamedObject('belongs_to_collection')) {
		merged.belongs_to_collection = enrichedMetadata.belongs_to_collection;
	}
	if (shouldReplaceList('production_companies')) {
		merged.production_companies = enrichedMetadata.production_companies;
	}
	if (shouldReplaceList('cast')) {
		merged.cast = enrichedMetadata.cast;
	}
	if (shouldReplaceString('original_title')) {
		merged.original_title = enrichedMetadata.original_title;
	}
	if (shouldReplaceString('overview')) {
		merged.overview = enrichedMetadata.overview;
	}

	return merged;
}
