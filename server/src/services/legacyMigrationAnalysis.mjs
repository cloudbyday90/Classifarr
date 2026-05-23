import * as db from '../config/database.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

export function normalizeRuleItems(values) {
    if (Array.isArray(values)) {
        const normalized = normalizeMetadataList(values);
        return normalized.length > 0 ? normalized : values.map(value => String(value));
    }

    const normalized = normalizeMetadataList([values]);
    if (normalized.length > 0) {
        return normalized;
    }

    return values === undefined || values === null ? [] : [String(values)];
}

export function matchItems(ruleItems, presetItems) {
    const ruleItemsLower = normalizeRuleItems(ruleItems).map(item => item.toLowerCase());
    const presetItemsLower = normalizeRuleItems(presetItems).map(item => item.toLowerCase());
    return ruleItemsLower.filter(item => presetItemsLower.includes(item)).length;
}

export function calculateMatchConfidence(conditions, signals) {
    let matchScore = 0;
    let totalConditions = 0;

    const genreValue = conditions.genres || (conditions.field === 'genres' ? conditions.value : null);
    if (genreValue && signals.genres) {
        const ruleGenres = normalizeRuleItems(genreValue);
        if (ruleGenres.length > 0) {
            totalConditions++;
            const presetGenres = [
                ...(signals.genres.require_any || []),
                ...(signals.genres.require_all || []),
                ...(signals.genres.prefer || [])
            ];

            const matches = matchItems(ruleGenres, presetGenres);
            matchScore += matches / ruleGenres.length;
        }
    }

    const certValue = conditions.certification || (conditions.field === 'certification' ? conditions.value : null);
    if (certValue && signals.certifications) {
        const ruleCerts = normalizeRuleItems(certValue);
        if (ruleCerts.length > 0) {
            totalConditions++;
            const presetCerts = signals.certifications.include || [];

            const matches = matchItems(ruleCerts, presetCerts);
            matchScore += matches / ruleCerts.length;
        }
    }

    const keywordValue = conditions.keywords || (conditions.field === 'keywords' && conditions.value);
    if (keywordValue && signals.keywords) {
        const ruleKeywords = normalizeRuleItems(keywordValue);
        if (ruleKeywords.length > 0) {
            totalConditions++;
            const presetKeywords = [
                ...(signals.keywords.require_any || []),
                ...(signals.keywords.require_all || []),
                ...(signals.keywords.prefer || [])
            ];

            const matches = matchItems(ruleKeywords, presetKeywords);
            matchScore += matches / ruleKeywords.length;
        }
    }

    return totalConditions > 0 ? (matchScore / totalConditions) * 100 : 0;
}

export async function analyzeRule(rule, ruleToOverride) {
    const suggestions = [];

    const conditions = rule.rule_json || {};

    if (conditions.genres || conditions.value) {
        const genreValue = conditions.genres || (conditions.field === 'genres' ? conditions.value : null);
        if (genreValue) {
            const genres = normalizeRuleItems(genreValue);

            const matchingPresets = await db.query(`
                SELECT id, key, name, signals
                FROM content_presets
                WHERE signals->'genres' IS NOT NULL
                AND is_system = true
            `);

            for (const preset of matchingPresets.rows) {
                const presetGenres = [
                    ...(preset.signals.genres?.require_any || []),
                    ...(preset.signals.genres?.require_all || []),
                    ...(preset.signals.genres?.prefer || [])
                ];

                const matchCount = matchItems(genres, presetGenres);

                if (matchCount > 0) {
                    suggestions.push({
                        type: 'preset',
                        preset_id: preset.id,
                        preset_key: preset.key,
                        preset_name: preset.name,
                        confidence: calculateMatchConfidence(conditions, preset.signals),
                        reason: `Matches genre requirements: ${genres.join(', ')}`
                    });
                }
            }
        }
    }

    if (conditions.certification || (conditions.field === 'certification' && conditions.value)) {
        const certValue = conditions.certification || conditions.value;
        const certifications = normalizeRuleItems(certValue);

        const matchingPresets = await db.query(`
            SELECT id, key, name, signals
            FROM content_presets
            WHERE signals->'certifications' IS NOT NULL
            AND is_system = true
        `);

        for (const preset of matchingPresets.rows) {
            const certIncludes = preset.signals.certifications?.include || [];
            const matches = matchItems(certifications, certIncludes);

            if (matches > 0) {
                suggestions.push({
                    type: 'preset',
                    preset_id: preset.id,
                    preset_key: preset.key,
                    preset_name: preset.name,
                    confidence: calculateMatchConfidence(conditions, preset.signals),
                    reason: `Matches certification: ${certifications.join(', ')}`
                });
            }
        }
    }

    if (conditions.keywords || (conditions.field === 'keywords' && conditions.value)) {
        const keywordValue = conditions.keywords || conditions.value;
        const keywords = normalizeRuleItems(keywordValue);

        const matchingPresets = await db.query(`
            SELECT id, key, name, signals
            FROM content_presets
            WHERE signals->'keywords' IS NOT NULL
            AND is_system = true
        `);

        for (const preset of matchingPresets.rows) {
            const keywordReqs = [
                ...(preset.signals.keywords?.require_any || []),
                ...(preset.signals.keywords?.require_all || []),
                ...(preset.signals.keywords?.prefer || [])
            ];

            const matchCount = matchItems(keywords, keywordReqs);

            if (matchCount > 0) {
                suggestions.push({
                    type: 'preset',
                    preset_id: preset.id,
                    preset_key: preset.key,
                    preset_name: preset.name,
                    confidence: calculateMatchConfidence(conditions, preset.signals),
                    reason: `Matches keywords: ${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? '...' : ''}`
                });
            }
        }
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);

    if (suggestions.length === 0) {
        suggestions.push({
            type: 'override',
            override_config: ruleToOverride(rule),
            confidence: 100,
            reason: 'No matching preset found - convert to policy override'
        });
    }

    return {
        rule_id: rule.id,
        rule_name: rule.name,
        conditions: conditions,
        suggestions: suggestions.slice(0, 5)
    };
}
