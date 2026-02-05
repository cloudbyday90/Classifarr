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

const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('LegacyMigration');

const createMigrationError = (message, code, status) => {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
};

class LegacyMigration {
    
    /**
     * Get all libraries with legacy rules
     */
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
    
    /**
     * Get legacy rules for a library
     */
    async getLegacyRules(libraryId) {
        const result = await db.query(`
            SELECT * FROM library_custom_rules
            WHERE library_id = $1 AND migrated_at IS NULL
            ORDER BY created_at DESC
        `, [libraryId]);
        return result.rows;
    }
    
    /**
     * Check if rule items match preset items (case-insensitive exact match)
     */
    matchItems(ruleItems, presetItems) {
        const ruleItemsLower = ruleItems.map(item => item.toLowerCase());
        const presetItemsLower = presetItems.map(item => item.toLowerCase());
        return ruleItemsLower.filter(item => presetItemsLower.includes(item)).length;
    }
    
    /**
     * Analyze a legacy rule and suggest equivalent preset(s)
     */
    async analyzeRule(rule) {
        const suggestions = [];
        
        // Analyze rule conditions
        const conditions = rule.rule_json || {};
        
        // Check for genre-based rules
        if (conditions.genres || conditions.value) {
            const genreValue = conditions.genres || (conditions.field === 'genres' ? conditions.value : null);
            if (genreValue) {
                const genres = Array.isArray(genreValue) ? genreValue : [genreValue];
                
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
        
        // Check for certification-based rules
        if (conditions.certification || (conditions.field === 'certification' && conditions.value)) {
            const certValue = conditions.certification || conditions.value;
            const certifications = Array.isArray(certValue) ? certValue : [certValue];
            
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
        
        // Check for keyword-based rules
        if (conditions.keywords || (conditions.field === 'keywords' && conditions.value)) {
            const keywordValue = conditions.keywords || conditions.value;
            const keywords = Array.isArray(keywordValue) ? keywordValue : [keywordValue];
            
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
        
        // Sort by confidence
        suggestions.sort((a, b) => b.confidence - a.confidence);
        
        // If no preset matches, add override suggestion at the end (not sorted)
        // This ensures preset suggestions with lower confidence are still visible
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
    
    /**
     * Calculate match confidence between rule conditions and preset signals
     */
    calculateMatchConfidence(conditions, signals) {
        let matchScore = 0;
        let totalConditions = 0;
        
        // Check genre match
        const genreValue = conditions.genres || (conditions.field === 'genres' ? conditions.value : null);
        if (genreValue && signals.genres) {
            const ruleGenres = Array.isArray(genreValue) ? genreValue : [genreValue];
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
        
        // Check certification match
        const certValue = conditions.certification || (conditions.field === 'certification' ? conditions.value : null);
        if (certValue && signals.certifications) {
            const ruleCerts = Array.isArray(certValue) ? certValue : [certValue];
            if (ruleCerts.length > 0) {
                totalConditions++;
                const presetCerts = signals.certifications.include || [];
                
                const matches = this.matchItems(ruleCerts, presetCerts);
                matchScore += matches / ruleCerts.length;
            }
        }
        
        // Check keyword match
        const keywordValue = conditions.keywords || (conditions.field === 'keywords' && conditions.value);
        if (keywordValue && signals.keywords) {
            const ruleKeywords = Array.isArray(keywordValue) ? keywordValue : [keywordValue];
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
    
    /**
     * Convert a legacy rule to policy override format
     */
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
    
    /**
     * Determine the match field for an override
     */
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
    
    /**
     * Determine the match value for an override
     * Note: When multiple values exist, they are joined with '|' for use in override matching
     */
    determineMatchValue(conditions) {
        // Handle explicit value field
        if (conditions.value) {
            return Array.isArray(conditions.value) 
                ? conditions.value.join('|') 
                : conditions.value;
        }
        
        // Handle specific condition types
        if (conditions.studio) return conditions.studio;
        if (conditions.collection) return conditions.collection;
        if (conditions.network) return conditions.network;
        
        // Handle array values - preserve all values
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
        
        // Fallback to JSON for complex conditions
        return JSON.stringify(conditions);
    }
    
    /**
     * Migrate a single rule to policy/override
     */
    async migrateRule(ruleId, migrationChoice, userId) {
        const rule = await db.query(`
            SELECT * FROM library_custom_rules WHERE id = $1
        `, [ruleId]);
        
        if (!rule.rows[0]) {
            throw new Error('Rule not found');
        }
        
        const ruleData = rule.rows[0];
        
        await db.query('BEGIN');
        
        try {
              if (migrationChoice.type === 'preset') {
                  // Attach preset to library's policy
                  const policy = await this.getOrCreatePolicy(ruleData.library_id);

                  if (!migrationChoice.preset_id) {
                      throw createMigrationError(
                          'Preset id is required for preset migration',
                          'PRESET_ID_REQUIRED',
                          400
                      );
                  }

                  const presetResult = await db.query(
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

                  await db.query(`
                      INSERT INTO policy_presets (policy_id, preset_id, weight)
                      VALUES ($1, $2, $3)
                      ON CONFLICT (policy_id, preset_id) DO NOTHING
                `, [policy.id, migrationChoice.preset_id, 1.0]);
                
            } else if (migrationChoice.type === 'override') {
                // Create policy override
                const policy = await this.getOrCreatePolicy(ruleData.library_id);
                
                await db.query(`
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
            
            // Mark rule as migrated
            await db.query(`
                UPDATE library_custom_rules 
                SET migrated_at = NOW(), migrated_by = $2, migration_type = $3
                WHERE id = $1
            `, [ruleId, userId || null, migrationChoice.type]);
            
            await db.query('COMMIT');
            
            logger.info('Rule migrated successfully', { 
                ruleId, 
                migrationType: migrationChoice.type 
            });
            
            return { success: true };
            
        } catch (error) {
            await db.query('ROLLBACK');
            logger.error('Migration failed', { ruleId, error: error.message });
            throw error;
        }
    }
    
    /**
     * Get or create a default policy for a library
     */
    async getOrCreatePolicy(libraryId) {
        let policy = await db.query(`
            SELECT * FROM library_policies WHERE library_id = $1 LIMIT 1
        `, [libraryId]);
        
        if (policy.rows.length === 0) {
            policy = await db.query(`
                INSERT INTO library_policies (library_id, name, description, enabled)
                VALUES ($1, 'Default Policy', 'Auto-created during migration', true)
                RETURNING *
            `, [libraryId]);
        }
        
        return policy.rows[0];
    }
    
    /**
     * Bulk migrate all rules for a library
     */
    async migrateLibrary(libraryId, userId, autoSuggest = true) {
        const rules = await this.getLegacyRules(libraryId);
        const results = [];
        
        for (const rule of rules) {
            const analysis = await this.analyzeRule(rule);
            
            if (autoSuggest && analysis.suggestions.length > 0) {
                try {
                    // Auto-apply top suggestion
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
    
    /**
     * Get migration status summary
     */
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

module.exports = new LegacyMigration();
