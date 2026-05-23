import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { analyzeRule as _analyzeRule, normalizeRuleItems as _normalizeRuleItems, matchItems as _matchItems, calculateMatchConfidence as _calculateMatchConfidence } from './legacyMigrationAnalysis.mjs';
import { ruleToOverride as _ruleToOverride, determineMatchField as _determineMatchField, determineMatchValue as _determineMatchValue } from './legacyMigrationConversion.mjs';

const logger = createLogger('LegacyMigration');

export const createMigrationError = (message, code, status) => {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
};

class LegacyMigration {
    normalizeRuleItems(values) {
        return _normalizeRuleItems(values);
    }

    matchItems(ruleItems, presetItems) {
        return _matchItems(ruleItems, presetItems);
    }

    calculateMatchConfidence(conditions, signals) {
        return _calculateMatchConfidence(conditions, signals);
    }

    determineMatchField(conditions) {
        return _determineMatchField(conditions);
    }

    determineMatchValue(conditions) {
        return _determineMatchValue(conditions);
    }

    ruleToOverride(rule) {
        return _ruleToOverride(rule);
    }

    async analyzeRule(rule) {
        return _analyzeRule(rule, _ruleToOverride);
    }

    async getLibrariesWithLegacyRules() {
        const result = await db.query(`
            SELECT 
                l.id as library_id,
                l.name as library_name,
                COUNT(lcr.id) as rule_count,
                ARRAY_AGG(lcr.id) as rule_ids
            FROM libraries l
            JOIN library_custom_rules lcr ON l.id = lcr.library_id
            WHERE lcr.migrated_at IS NULL
            GROUP BY l.id, l.name
            ORDER BY rule_count DESC
        `);
        return result.rows;
    }

    async getLegacyRules(libraryId) {
        const result = await db.query(`
            SELECT * FROM library_custom_rules
            WHERE library_id = $1 AND migrated_at IS NULL
            ORDER BY created_at DESC
        `, [libraryId]);
        return result.rows;
    }

    async migrateRule(ruleId, migrationChoice, userId) {
        const rule = await db.query(`
            SELECT * FROM library_custom_rules WHERE id = $1
        `, [ruleId]);

        if (!rule.rows[0]) {
            throw new Error('Rule not found');
        }

        const ruleData = rule.rows[0];

        await db.withTransaction(async (client) => {
            if (migrationChoice.type === 'preset') {
                const policy = await this.getOrCreatePolicy(ruleData.library_id, client);

                if (!migrationChoice.preset_id) {
                    throw createMigrationError(
                        'Preset id is required for preset migration',
                        'PRESET_ID_REQUIRED',
                        400
                    );
                }

                const presetResult = await client.query(
                    'SELECT id, is_system, is_public, user_id FROM content_presets WHERE id = $1',
                    [migrationChoice.preset_id]
                );

                if (presetResult.rows.length === 0) {
                    throw createMigrationError(
                        `Preset not found: ${migrationChoice.preset_id}`,
                        'PRESET_NOT_FOUND',
                        404
                    );
                }

                const preset = presetResult.rows[0];
                const isAllowed = preset.is_system
                    || preset.is_public
                    || (userId && preset.user_id === userId);

                if (!isAllowed) {
                    throw createMigrationError(
                        'Preset is not accessible to the current user',
                        'PRESET_NOT_ALLOWED',
                        403
                    );
                }

                await client.query(`
                    INSERT INTO policy_presets (policy_id, preset_id, weight)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (policy_id, preset_id) DO NOTHING
                `, [policy.id, migrationChoice.preset_id, 1.0]);

            } else if (migrationChoice.type === 'override') {
                const policy = await this.getOrCreatePolicy(ruleData.library_id, client);

                await client.query(`
                    INSERT INTO policy_overrides (
                        policy_id, signal_type, override_config, reason
                    ) VALUES ($1, $2, $3, $4)
                `, [
                    policy.id,
                    migrationChoice.override_config.match_field || 'custom',
                    JSON.stringify(migrationChoice.override_config),
                    migrationChoice.override_config.reason
                ]);
            }

            await client.query(`
                UPDATE library_custom_rules 
                SET migrated_at = NOW(), migrated_by = $2, migration_type = $3
                WHERE id = $1
            `, [ruleId, userId || null, migrationChoice.type]);
        });

        logger.info('Rule migrated successfully', {
            ruleId,
            migrationType: migrationChoice.type
        });

        return { success: true };
    }

    async getOrCreatePolicy(libraryId, txClient = db) {
        let policy = await txClient.query(`
            SELECT * FROM library_policies WHERE library_id = $1 LIMIT 1
        `, [libraryId]);

        if (policy.rows.length === 0) {
            policy = await txClient.query(`
                INSERT INTO library_policies (library_id, name, description, enabled)
                VALUES ($1, 'Default Policy', 'Auto-created during migration', true)
                RETURNING *
            `, [libraryId]);
        }

        return policy.rows[0];
    }

    async migrateLibrary(libraryId, userId, autoSuggest = true) {
        const rules = await this.getLegacyRules(libraryId);
        const results = [];

        for (const rule of rules) {
            const analysis = await this.analyzeRule(rule);

            if (autoSuggest && analysis.suggestions.length > 0) {
                try {
                    const topSuggestion = analysis.suggestions[0];
                    await this.migrateRule(rule.id, topSuggestion, userId);
                    results.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        migrated: true,
                        migration_type: topSuggestion.type
                    });
                } catch (error) {
                    results.push({
                        rule_id: rule.id,
                        rule_name: rule.name,
                        migrated: false,
                        error: error.message,
                        suggestions: analysis.suggestions
                    });
                }
            } else {
                results.push({
                    rule_id: rule.id,
                    rule_name: rule.name,
                    migrated: false,
                    suggestions: analysis.suggestions
                });
            }
        }

        return results;
    }

    async getMigrationStatus() {
        const result = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE migrated_at IS NULL)::int as pending,
                COUNT(*) FILTER (WHERE migrated_at IS NOT NULL)::int as migrated,
                COUNT(*)::int as total
            FROM library_custom_rules
        `);
        return result.rows[0];
    }
}

export const legacyMigrationService = new LegacyMigration();
