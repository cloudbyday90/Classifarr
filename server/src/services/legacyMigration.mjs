/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataList } from '../utils/metadataNormalization.mjs';

const logger = createLogger('LegacyMigration');

export const createMigrationError = (message, code, status) => {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
};

class LegacyMigration {
    normalizeRuleItems(values) {
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
    
    matchItems(ruleItems, presetItems) {
        const ruleItemsLower = this.normalizeRuleItems(ruleItems).map(item => item.toLowerCase());
        const presetItemsLower = this.normalizeRuleItems(presetItems).map(item => item.toLowerCase());
        return ruleItemsLower.filter(item => presetItemsLower.includes(item)).length;
    }
    
    async analyzeRule(rule) {
        const suggestions = [];
        
        const conditions = rule.rule_json || {};
        
        if (conditions.genres || conditions.value) {
            const genreValue = conditions.genres || (conditions.field === 'genres' ? conditions.value : null);
            if (genreValue) {
                const genres = this.normalizeRuleItems(genreValue);
                
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
                    
                    const matchCount = this.matchItems(genres, presetGenres);
                    
                    if (matchCount > 0) {
                        suggestions.push({
                            type: 'preset',
                            preset_id: preset.id,
                            preset_key: preset.key,
                            preset_name: preset.name,
                            confidence: this.calculateMatchConfidence(conditions, preset.signals),
                            reason: `Matches genre requirements: ${genres.join(', ')}`
                        });
                    }
                }
            }
        }
        
        if (conditions.certification || (conditions.field === 'certification' && conditions.value)) {
            const certValue = conditions.certification || conditions.value;
            const certifications = this.normalizeRuleItems(certValue);
            
            const matchingPresets = await db.query(`
                SELECT id, key, name, signals
                FROM content_presets
                WHERE signals->'certifications' IS NOT NULL
                AND is_system = true
            `);
            
            for (const preset of matchingPresets.rows) {
                const certIncludes = preset.signals.certifications?.include || [];
                const matches = this.matchItems(certifications, certIncludes);
                
                if (matches > 0) {
                    suggestions.push({
                        type: 'preset',
                        preset_id: preset.id,
                        preset_key: preset.key,
                        preset_name: preset.name,
                        confidence: this.calculateMatchConfidence(conditions, preset.signals),
                        reason: `Matches certification: ${certifications.join(', ')}`
                    });
                }
            }
        }
        
        if (conditions.keywords || (conditions.field === 'keywords' && conditions.value)) {
            const keywordValue = conditions.keywords || conditions.value;
            const keywords = this.normalizeRuleItems(keywordValue);
            
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
                
                const matchCount = this.matchItems(keywords, keywordReqs);
                
                if (matchCount > 0) {
                    suggestions.push({
                        type: 'preset',
                        preset_id: preset.id,
                        preset_key: preset.key,
                        preset_name: preset.name,
                        confidence: this.calculateMatchConfidence(conditions, preset.signals),
                        reason: `Matches keywords: ${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? '...' : ''}`
                    });
                }
            }
        }
        
        suggestions.sort((a, b) => b.confidence - a.confidence);
        
        if (suggestions.length === 0) {
            suggestions.push({
                type: 'override',
                override_config: this.ruleToOverride(rule),
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
    
    calculateMatchConfidence(conditions, signals) {
        let matchScore = 0;
        let totalConditions = 0;
        
        const genreValue = conditions.genres || (conditions.field === 'genres' ? conditions.value : null);
        if (genreValue && signals.genres) {
            const ruleGenres = this.normalizeRuleItems(genreValue);
            if (ruleGenres.length > 0) {
                totalConditions++;
                const presetGenres = [
                    ...(signals.genres.require_any || []),
                    ...(signals.genres.require_all || []),
                    ...(signals.genres.prefer || [])
                ];
                
                const matches = this.matchItems(ruleGenres, presetGenres);
                matchScore += matches / ruleGenres.length;
            }
        }
        
        const certValue = conditions.certification || (conditions.field === 'certification' ? conditions.value : null);
        if (certValue && signals.certifications) {
            const ruleCerts = this.normalizeRuleItems(certValue);
            if (ruleCerts.length > 0) {
                totalConditions++;
                const presetCerts = signals.certifications.include || [];
                
                const matches = this.matchItems(ruleCerts, presetCerts);
                matchScore += matches / ruleCerts.length;
            }
        }
        
        const keywordValue = conditions.keywords || (conditions.field === 'keywords' && conditions.value);
        if (keywordValue && signals.keywords) {
            const ruleKeywords = this.normalizeRuleItems(keywordValue);
            if (ruleKeywords.length > 0) {
                totalConditions++;
                const presetKeywords = [
                    ...(signals.keywords.require_any || []),
                    ...(signals.keywords.require_all || []),
                    ...(signals.keywords.prefer || [])
                ];
                
                const matches = this.matchItems(ruleKeywords, presetKeywords);
                matchScore += matches / ruleKeywords.length;
            }
        }
        
        return totalConditions > 0 ? (matchScore / totalConditions) * 100 : 0;
    }
    
    ruleToOverride(rule) {
        const conditions = rule.rule_json || {};
        
        return {
            override_type: 'include',
            match_field: this.determineMatchField(conditions),
            match_value: this.determineMatchValue(conditions),
            priority: rule.priority || 100,
            enabled: true,
            reason: `Migrated from legacy rule: ${rule.name}`,
            original_rule_id: rule.id
        };
    }
    
    determineMatchField(conditions) {
        if (conditions.field) return conditions.field;
        if (conditions.studio) return 'studio';
        if (conditions.collection) return 'collection';
        if (conditions.network) return 'network';
        if (conditions.genres) return 'genres';
        if (conditions.keywords) return 'keywords';
        if (conditions.certification) return 'certification';
        if (conditions.tmdb_id) return 'tmdb_id';
        return 'custom';
    }
    
    determineMatchValue(conditions) {
        if (conditions.value) {
            return Array.isArray(conditions.value) 
                ? conditions.value.join('|') 
                : conditions.value;
        }
        
        if (conditions.studio) return conditions.studio;
        if (conditions.collection) return conditions.collection;
        if (conditions.network) return conditions.network;
        
        if (conditions.genres) {
            return Array.isArray(conditions.genres) 
                ? conditions.genres.join('|') 
                : conditions.genres;
        }
        if (conditions.keywords) {
            return Array.isArray(conditions.keywords) 
                ? conditions.keywords.join('|') 
                : conditions.keywords;
        }
        if (conditions.certification) return conditions.certification;
        if (conditions.tmdb_id) return conditions.tmdb_id.toString();
        
        return JSON.stringify(conditions);
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

const instance = new LegacyMigration();
export default instance;
