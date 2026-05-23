import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

export function countDistribution(items, field) {
    const counts = {};

    for (const item of items) {
        let values = [];

        if (field === 'rating') {
            const rating = item.content_rating || item.metadata?.omdb?.rated;
            if (rating) values = [rating];
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

export function computeProfileScore(profile, itemMetadata) {
    let score = 0;
    const rating = itemMetadata.certification || itemMetadata.content_rating;
    const itemGenres = normalizeMetadataList(itemMetadata.genres);
    const itemKeywords = normalizeMetadataList(itemMetadata.keywords);

    const ratingDist = profile.rating_distribution || {};
    const ratingPct = ratingDist[rating] || 0;
    if (ratingPct > 50) score += 30;
    else if (ratingPct > 20) score += 15;
    else if (ratingPct > 5) score += 5;

    const genreDist = profile.genre_distribution || {};
    for (const genre of itemGenres) {
        const genrePct = genreDist[genre] || 0;
        score += Math.min(genrePct * 0.3, 15);
    }

    const keywordDist = profile.keyword_distribution || {};
    for (const keyword of itemKeywords) {
        const keywordPct = keywordDist[keyword] || 0;
        if (keywordPct > 10) score += 5;
    }

    if (profile.exclusion_ratings?.includes(rating)) {
        score -= 50;
    }
    for (const genre of itemGenres) {
        if (profile.exclusion_genres?.includes(genre)) {
            score -= 30;
        }
    }
    for (const keyword of itemKeywords) {
        if (profile.exclusion_keywords?.includes(keyword)) {
            score -= 20;
        }
    }

    const rawScore = score;
    const finalScore = Math.max(0, Math.min(100, 50 + score));
    return { rawScore, finalScore };
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
