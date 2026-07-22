import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeSignalConfig, mergePresetSignals } from '../utils/policySignals.mjs';
import {
    attachActiveNativeIntentsForPolicies,
} from './policyNativePolicyReadService.mjs';
import {
    requiresLegacyPolicyPresetsForRuntime,
    withPolicyEngineRuntimeAuthority,
} from './policyEngineRuntimeAuthority.mjs';

const logger = createLogger('PolicyEngine');

function buildLegacyPreset(policyPreset) {
    const baseSignals = normalizeSignalConfig(policyPreset.signals);
    const customSignals = normalizeSignalConfig(policyPreset.custom_signals);
    return {
        ...policyPreset,
        signals: mergePresetSignals(baseSignals, customSignals),
        custom_signals: customSignals,
    };
}

async function loadLegacyPresetsByPolicyId(policyIds = []) {
    if (policyIds.length === 0) {
        return new Map();
    }

    const presetsResult = await db.query(`
        SELECT
            pp.policy_id,
            cp.id,
            cp.key,
            cp.name,
            cp.signals,
            pp.weight,
            pp.custom_signals
        FROM policy_presets pp
        JOIN content_presets cp ON pp.preset_id = cp.id
        WHERE pp.policy_id = ANY($1::integer[])
        ORDER BY pp.policy_id, pp.id
    `, [policyIds]);

    return (presetsResult.rows || []).reduce((presetsByPolicyId, preset) => {
        const presets = presetsByPolicyId.get(preset.policy_id) || [];
        presets.push(buildLegacyPreset(preset));
        presetsByPolicyId.set(preset.policy_id, presets);
        return presetsByPolicyId;
    }, new Map());
}

export async function checkAuthoritativeSignals(item) {
    try {
        if (!item.source_library_id) {
            return null;
        }

        const result = await db.query(`
            SELECT 
                lp.id as policy_id,
                lp.library_id,
                lp.name as policy_name,
                l.id as library_id,
                l.name as library_name
            FROM library_policies lp
            JOIN libraries l ON lp.library_id = l.id
            WHERE lp.enabled = true
            AND lp.source_library_ids::jsonb ? $1
            ORDER BY lp.priority DESC
            LIMIT 1
        `, [item.source_library_id]);

        if (result.rows.length === 0) {
            return null;
        }

        const match = result.rows[0];
        return {
            library_id: match.library_id,
            library_name: match.library_name,
            policy_id: match.policy_id,
            policy_name: match.policy_name,
            confidence: 100,
            method: 'authoritative_source_library',
            reason: `Matched source library: ${item.source_library_name || item.source_library_id}`
        };

    } catch (error) {
        logger.error('Failed to check authoritative signals', { error: error.message });
        return null;
    }
}

export async function getActivePolicies() {
    try {
        const result = await db.query(`
            SELECT 
                lp.id,
                lp.library_id,
                lp.name,
                lp.enabled,
                lp.priority,
                lp.auto_classify_threshold,
                lp.prompt_threshold,
                lp.trust_patterns,
                lp.trust_rag,
                lp.trust_history,
                lp.combination_mode,
                lp.preset_weight,
                lp.profile_weight,
                lp.pattern_weight,
                lp.rag_weight,
                lp.history_weight,
                l.name as library_name,
                l.media_type as library_media_type
            FROM library_policies lp
            JOIN libraries l ON lp.library_id = l.id
            WHERE lp.enabled = true
            AND l.is_active = true
            ORDER BY lp.priority DESC, lp.sort_order ASC
        `);

        if (result.rows.length === 0) {
            return [];
        }

        const policiesWithNativeIntent = await attachActiveNativeIntentsForPolicies({
            dbClient: db,
            policies: result.rows,
        });
        const compatibilityPolicyIds = new Set(
            policiesWithNativeIntent
                .filter(requiresLegacyPolicyPresetsForRuntime)
                .map((policy) => policy.id)
        );
        const legacyPresetsByPolicyId = await loadLegacyPresetsByPolicyId([...compatibilityPolicyIds]);
        const policies = policiesWithNativeIntent.map((policy) => {
            const policyForRuntime = compatibilityPolicyIds.has(policy.id)
                ? {
                    ...policy,
                    presets: legacyPresetsByPolicyId.get(policy.id) || [],
                }
                : policy;

            return withPolicyEngineRuntimeAuthority(policyForRuntime);
        });

        logger.debug('Retrieved active policies', { count: policies.length });
        return policies;

    } catch (error) {
        logger.error('Failed to get active policies', { error: error.message });
        return [];
    }
}
