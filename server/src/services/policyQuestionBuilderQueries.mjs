import { createLogger } from '../utils/logger.mjs';
import { mergePresetSignals, normalizeSignalConfig } from '../utils/policySignals.mjs';

const logger = createLogger('policyQuestionBuilder');

export function filterLibrariesByMediaType(libraries, mediaType) {
    if (!mediaType) {
        return libraries || [];
    }
    return (libraries || []).filter(lib => (lib.media_type || '').toLowerCase() === mediaType);
}

export function buildCandidates(policyResult, libraries, suggestedLibrary, maxOptions) {
    const candidates = [];
    const ranked = Array.isArray(policyResult?.ranked) ? [...policyResult.ranked] : [];
    ranked.sort((a, b) => (b.score || 0) - (a.score || 0));

    const topScore = ranked[0]?.score || 0;
    const minRelativeScore = topScore * 0.25;
    const relevantRanked = topScore > 0 ? ranked.filter(r => (r.score || 0) >= minRelativeScore) : ranked;

    relevantRanked.forEach(entry => {
        const library = libraries.find(lib => lib.id === entry.library_id);
        if (!library) return;
        candidates.push({
            ...entry,
            library,
        });
    });

    if (candidates.length === 0 && suggestedLibrary) {
        const fallback = libraries.find(lib => lib.id === suggestedLibrary.id) || suggestedLibrary;
        if (fallback) {
            candidates.push({
                library_id: fallback.id,
                library_name: fallback.name,
                score: null,
                policy_id: null,
                policy_name: null,
                library: fallback
            });
        }
    }

    for (const lib of libraries) {
        if (candidates.length >= maxOptions) break;
        if (!candidates.some(c => c.library_id === lib.id)) {
            candidates.push({
                library_id: lib.id,
                library_name: lib.name,
                score: null,
                policy_id: null,
                policy_name: null,
                library: lib
            });
        }
    }

    return candidates.slice(0, maxOptions);
}

export async function getPresetsByPolicy(policyIds, { db, mergePresetSignalsFn, normalizeSignalConfigFn }) {
    if (!policyIds || policyIds.length === 0) {
        return {};
    }

    try {
        const result = await db.query(
            `SELECT 
               pp.policy_id,
               cp.id as preset_id,
               cp.name as preset_name,
               cp.signals,
               pp.custom_signals
             FROM policy_presets pp
             JOIN content_presets cp ON pp.preset_id = cp.id
             WHERE pp.policy_id = ANY($1::int[])`,
            [policyIds]
        );

        const presetsByPolicy = {};
        result.rows.forEach(row => {
            const mergedSignals = mergePresetSignalsFn(
                normalizeSignalConfigFn(row.signals),
                normalizeSignalConfigFn(row.custom_signals)
            );

            if (!presetsByPolicy[row.policy_id]) {
                presetsByPolicy[row.policy_id] = [];
            }
            presetsByPolicy[row.policy_id].push({
                preset_id: row.preset_id,
                preset_name: row.preset_name,
                signals: mergedSignals
            });
        });

        return presetsByPolicy;
    } catch (error) {
        logger.error('Failed to load policy presets for clarification', { error: error.message });
        return {};
    }
}
