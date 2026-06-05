import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { ratingNormalizer } from '../utils/ratingNormalizer.mjs';

const PROFILE_DETAIL_LIMIT = 8;

function roundScore(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

function getRatingContribution(percentage) {
    if (percentage > 50) return 30;
    if (percentage > 20) return 15;
    if (percentage > 5) return 5;
    return 0;
}

function limitList(values) {
    return values.slice(0, PROFILE_DETAIL_LIMIT);
}

export function countDistribution(items, field) {
    const counts = {};

    for (const item of items) {
        let values = [];

        if (field === 'rating') {
            const rating = item.content_rating || item.metadata?.omdb?.rated;
            if (rating) {
                values = [ratingNormalizer.normalizeRating(rating, item.media_type || 'movie')];
            }
        } else if (field === 'genres') {
            const genres = normalizeMetadataList(item.genres);
            values = genres.length > 0
                ? genres
                : normalizeMetadataList(item.metadata?.tmdb?.genres);
        } else if (field === 'studio') {
            const studio = item.studio ||
                item.metadata?.tmdb?.production_companies?.[0]?.name;
            if (studio) values = [studio];
        } else if (field === 'keywords') {
            values = normalizeMetadataList(item.metadata?.tmdb?.keywords);
        }

        for (const val of values.filter(Boolean)) {
            const normalized = String(val).trim();
            if (normalized) {
                counts[normalized] = (counts[normalized] || 0) + 1;
            }
        }
    }

    const total = items.length;
    const percentages = {};
    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1]);

    for (const [key, count] of sorted) {
        percentages[key] = Math.round((count / total) * 100);
    }

    return percentages;
}

export function findExclusions(distribution, knownValues = null) {
    if (knownValues) {
        return knownValues.filter(v => !distribution[v]);
    }

    return [];
}

export function normalizeRatingDistribution(distribution = {}, mediaType = 'movie') {
    const normalized = {};

    for (const [rating, percentage] of Object.entries(distribution || {})) {
        const normalizedRating = ratingNormalizer.normalizeRating(rating, mediaType);
        const numericPercentage = Number(percentage);
        if (!normalizedRating || !Number.isFinite(numericPercentage)) continue;

        normalized[normalizedRating] = Math.min(
            100,
            (normalized[normalizedRating] || 0) + numericPercentage
        );
    }

    return normalized;
}

function inferRatingMediaType(profile, rating) {
    const candidateRatings = [
        rating,
        ...Object.keys(profile.rating_distribution || {})
    ].filter(Boolean);

    return candidateRatings.some(candidateRating => String(candidateRating).startsWith('TV-'))
        ? 'tv'
        : 'movie';
}

export function computeProfileScore(profile, itemMetadata) {
    const { rawScore, finalScore } = computeProfileScoreDetails(profile, itemMetadata);
    return { rawScore, finalScore };
}

export function computeProfileScoreDetails(profile, itemMetadata) {
    let score = 0;
    const rating = itemMetadata.certification || itemMetadata.content_rating;
    const mediaType = itemMetadata.media_type || profile.media_type || inferRatingMediaType(profile, rating);
    const normalizedRating = rating
        ? ratingNormalizer.normalizeRating(rating, mediaType)
        : rating;
    const itemGenres = normalizeMetadataList(itemMetadata.genres);
    const itemKeywords = normalizeMetadataList(itemMetadata.keywords);

    const ratingDist = normalizeRatingDistribution(
        profile.rating_distribution || {},
        mediaType
    );
    const ratingPct = ratingDist[normalizedRating] || 0;
    const ratingScoreDelta = getRatingContribution(ratingPct);
    score += ratingScoreDelta;

    const genreDist = profile.genre_distribution || {};
    const genreMatches = [];
    const genreUnmatched = [];
    for (const genre of itemGenres) {
        const genrePct = genreDist[genre] || 0;
        const scoreDelta = Math.min(genrePct * 0.3, 15);
        score += scoreDelta;
        if (genrePct > 0 || scoreDelta > 0) {
            genreMatches.push({
                value: genre,
                distribution_percent: genrePct,
                score_delta: roundScore(scoreDelta),
            });
        } else {
            genreUnmatched.push(genre);
        }
    }

    const keywordDist = profile.keyword_distribution || {};
    const keywordMatches = [];
    const keywordUnmatched = [];
    for (const keyword of itemKeywords) {
        const keywordPct = keywordDist[keyword] || 0;
        const scoreDelta = keywordPct > 10 ? 5 : 0;
        score += scoreDelta;
        if (keywordPct > 0 || scoreDelta > 0) {
            keywordMatches.push({
                value: keyword,
                distribution_percent: keywordPct,
                score_delta: roundScore(scoreDelta),
            });
        } else {
            keywordUnmatched.push(keyword);
        }
    }

    const exclusionRatings = Array.from(new Set((profile.exclusion_ratings || [])
        .map(exclusionRating => ratingNormalizer.normalizeRating(exclusionRating, mediaType))
        .filter(Boolean)));
    const exclusionHits = {
        ratings: [],
        genres: [],
        keywords: [],
    };
    if (exclusionRatings?.includes(normalizedRating)) {
        score -= 50;
        exclusionHits.ratings.push({
            value: normalizedRating,
            score_delta: -50,
        });
    }
    for (const genre of itemGenres) {
        if (profile.exclusion_genres?.includes(genre)) {
            score -= 30;
            exclusionHits.genres.push({
                value: genre,
                score_delta: -30,
            });
        }
    }
    for (const keyword of itemKeywords) {
        if (profile.exclusion_keywords?.includes(keyword)) {
            score -= 20;
            exclusionHits.keywords.push({
                value: keyword,
                score_delta: -20,
            });
        }
    }

    const rawScore = score;
    const finalScore = Math.max(0, Math.min(100, 50 + score));
    return {
        rawScore,
        finalScore,
        diagnostics: {
            schema_version: 1,
            available: true,
            media_type: mediaType,
            raw_score: roundScore(rawScore),
            final_score: roundScore(finalScore),
            rating: {
                input: rating || null,
                normalized: normalizedRating || null,
                distribution_percent: ratingPct,
                score_delta: ratingScoreDelta,
                matched: ratingPct > 0,
            },
            genres: {
                input_count: itemGenres.length,
                matched: limitList(genreMatches),
                unmatched: limitList(genreUnmatched),
            },
            keywords: {
                input_count: itemKeywords.length,
                matched: limitList(keywordMatches),
                unmatched: limitList(keywordUnmatched),
            },
            exclusions: {
                ratings: limitList(exclusionHits.ratings),
                genres: limitList(exclusionHits.genres),
                keywords: limitList(exclusionHits.keywords),
            },
        },
    };
}

export function formatProfileForPrompt(stats) {
    const lines = [];

    lines.push('=== LIBRARY PROFILE STATISTICS ===');
    lines.push(`Total items in library: ${stats.totalItems}`);
    lines.push('');

    if (stats.certificationDistribution.length > 0) {
        lines.push('Content Rating Distribution:');
        stats.certificationDistribution.forEach(c => {
            lines.push(`  - ${c.certification}: ${c.percentage}% (${c.count} items)`);
        });
        lines.push('');
    }

    if (stats.genreDistribution.length > 0) {
        lines.push('Genre Distribution:');
        stats.genreDistribution.forEach(g => {
            lines.push(`  - ${g.genre}: ${g.percentage}% (${g.count} items)`);
        });
        lines.push('');
    }

    if (stats.studioDistribution.length > 0) {
        lines.push('Top Studios:');
        stats.studioDistribution.forEach(s => {
            lines.push(`  - ${s.studio}: ${s.percentage}% (${s.count} items)`);
        });
        lines.push('');
    }

    if (stats.languageDistribution.length > 0) {
        lines.push('Language Distribution:');
        stats.languageDistribution.forEach(l => {
            lines.push(`  - ${l.language}: ${l.percentage}% (${l.count} items)`);
        });
    }

    lines.push('=================================');

    return lines.join('\n');
}
