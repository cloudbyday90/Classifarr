import { buildLibraryProfileObservation, observationDistribution } from './libraryProfileObservation.mjs';
import { formatObservationContext } from './libraryProfileObservationPresentation.mjs';
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

function ownPercentage(distribution, key) {
    const value = Object.hasOwn(distribution, key) ? distribution[key] : 0;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : 0;
}

function limitList(values) {
    return values.slice(0, PROFILE_DETAIL_LIMIT);
}

export function countDistribution(items, field) {
    return observationDistribution(buildLibraryProfileObservation(items), field);
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
        const genrePct = ownPercentage(genreDist, genre);
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
        const keywordPct = ownPercentage(keywordDist, keyword);
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

    // Observed absence is not declared intent and cannot penalize a candidate.
    const exclusionHits = { ratings: [], genres: [], keywords: [] };

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
    lines.push(...formatObservationContext(stats.observation));
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
