import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';
import { safeJSONParse, DARK_KEYWORDS, MAX_SUGGESTIONS, STRONG_SCORE_THRESHOLD, PATTERN_REINFORCEMENT_THRESHOLD } from './promptBuilderConstants.mjs';

export function buildReasonOptions(item, _evaluation) {
    const options = [];

    if (item.genres) {
        const genres = normalizeMetadataList(safeJSONParse(item.genres, []));
        if (genres.length > 0) {
            options.push({
                category: 'genre',
                label: `Based on genre (${genres.slice(0, 2).join(', ')})`,
                value: 'genre_based'
            });
        }
    }

    if (item.studios || item.production_companies) {
        const studios = item.studios || item.production_companies;
        const studiosList = safeJSONParse(studios, []);
        if (Array.isArray(studiosList) && studiosList.length > 0) {
            const studioName = typeof studiosList[0] === 'string' ? studiosList[0] : studiosList[0]?.name;
            if (studioName) {
                options.push({
                    category: 'studio',
                    label: `Based on studio (${studioName})`,
                    value: 'studio_based'
                });
            }
        }
    }

    if (item.certification) {
        options.push({
            category: 'rating',
            label: `Based on rating (${item.certification})`,
            value: 'rating_based'
        });
    }

    if (item.keywords) {
        options.push({
            category: 'keywords',
            label: 'Based on content keywords',
            value: 'keyword_based'
        });
    }

    if (item.belongs_to_collection) {
        options.push({
            category: 'collection',
            label: 'Part of a collection/franchise',
            value: 'collection_based'
        });
    }

    options.push({
        category: 'custom',
        label: 'Other reason',
        value: 'custom'
    });

    return options;
}

export function buildPatternOptions(item, _evaluation) {
    const options = [];

    if (item.studios || item.production_companies) {
        const studios = item.studios || item.production_companies;
        const studiosList = safeJSONParse(studios, []);
        if (Array.isArray(studiosList) && studiosList.length > 0) {
            const studioName = typeof studiosList[0] === 'string' ? studiosList[0] : studiosList[0]?.name;
            if (studioName) {
                options.push({
                    type: 'studio',
                    label: `Remember: ${studioName} → [Selected Library]`,
                    value: studioName
                });
            }
        }
    }

    if (item.belongs_to_collection) {
        const collection = safeJSONParse(item.belongs_to_collection, null);
        const collectionName = typeof collection === 'string' ? collection : collection?.name;
        if (collectionName) {
            options.push({
                type: 'collection',
                label: `Always classify ${collectionName} as [Selected Library]`,
                value: collectionName
            });
        }
    }

    if (item.keywords) {
        const keywords = normalizeMetadataList(safeJSONParse(item.keywords, []));
        if (keywords.length > 0) {
            const prominentKeyword = keywords[0];
            if (prominentKeyword) {
                options.push({
                    type: 'keyword',
                    label: `Remember: "${prominentKeyword}" → [Selected Library]`,
                    value: prominentKeyword
                });
            }
        }
    }

    return options;
}

export function analyzeSignals(item, evaluation) {
    const signals = {
        matching: [],
        conflicting: [],
        missing: []
    };

    const topRanked = evaluation.ranked && evaluation.ranked[0];
    if (!topRanked) return signals;

    if (item.genres) {
        const genres = normalizeMetadataList(safeJSONParse(item.genres, []));
        if (genres.length > 0) {
            signals.matching.push(`${genres.slice(0, 2).join(', ')} genre${genres.length > 1 ? 's' : ''}`);
        }
    }

    if (item.certification) {
        signals.matching.push(`${item.certification} rating`);
    }

    const keywords = normalizeMetadataList(safeJSONParse(item.keywords, []));
    const keywordText = keywords.join(' ').toLowerCase();
    const overviewText = (item.overview || '').toLowerCase();
    const allText = `${keywordText} ${overviewText}`;

    const hasDarkContent = DARK_KEYWORDS.some(k => allText.includes(k));
    if (hasDarkContent) {
        signals.conflicting.push('Dark/mature themes detected');
    }

    if (!item.studios && !item.production_companies) {
        signals.missing.push('Studio information');
    }

    return signals;
}

export function identifyKeyDifferences(topCandidates, _item) {
    const differences = [];

    if (topCandidates.length < 2) return differences;

    for (let i = 0; i < Math.min(topCandidates.length, MAX_SUGGESTIONS); i++) {
        const candidate = topCandidates[i];
        const strengths = [];

        if (candidate.scores?.preset > STRONG_SCORE_THRESHOLD) {
            strengths.push('Strong preset match');
        }
        if (candidate.scores?.pattern > STRONG_SCORE_THRESHOLD) {
            strengths.push('Known pattern');
        }
        if (candidate.scores?.rag > STRONG_SCORE_THRESHOLD) {
            strengths.push('Similar to past items');
        }

        differences.push({
            libraryName: candidate.library_name,
            score: candidate.score,
            strengths
        });
    }

    return differences;
}

export function identifyReinforcedPatterns(item, evaluation, userChoice) {
    const patterns = [];

    if (!userChoice) return patterns;

    const topRanked = evaluation.ranked && evaluation.ranked[0];
    if (topRanked && userChoice.libraryId === topRanked.library_id) {
        if (topRanked.scores?.pattern > PATTERN_REINFORCEMENT_THRESHOLD) {
            patterns.push('Existing pattern confirmed');
        }
        if (topRanked.scores?.rag > PATTERN_REINFORCEMENT_THRESHOLD) {
            patterns.push('Semantic similarity validated');
        }
    }

    return patterns;
}

export function describeFutureImpact(item, evaluation, userChoice) {
    if (!userChoice) {
        return 'Your choice will help improve future classifications.';
    }

    const hasPatternActions = userChoice.patternActions && userChoice.patternActions.length > 0;

    if (hasPatternActions) {
        return `New pattern${userChoice.patternActions.length > 1 ? 's' : ''} created. Similar items will be classified automatically.`;
    }

    return 'This decision will be used to improve classification accuracy.';
}
