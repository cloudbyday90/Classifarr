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

const defaultDb = require('../config/database');
const { createLogger } = require('../utils/logger');
const { normalizeMetadataListLower } = require('../utils/metadataNormalization');
const classificationMetadataService = require('./classificationMetadataService');

const logger = createLogger('libraryRulesService');

/**
 * Check library_rules_v2 for a matching rule against the given metadata.
 * Rules are checked in priority order (library priority DESC, rule priority ASC).
 * Returns the first matching rule result or null.
 *
 * @param {object} metadata
 * @param {object[]} libraries - active libraries for this media type
 * @param {object} [db]
 * @returns {Promise<{library, isException, matchedRule, reason}|null>}
 */
async function checkLibraryRules(metadata, libraries, db = defaultDb) {
  // Get all active rules from the v2 table
  const rulesResult = await db.query(`
    SELECT r.*, l.name as library_name
    FROM library_rules_v2 r
    JOIN libraries l ON r.library_id = l.id
    WHERE r.is_active = true AND l.is_active = true
    ORDER BY l.priority DESC, r.priority ASC
  `);

  if (rulesResult.rows.length === 0) {
    return null;
  }

  // Prepare metadata for matching
  const itemData = {
    rating: (metadata.certification || '').toUpperCase(),
    genre: normalizeMetadataListLower(metadata.genres),
    keyword: normalizeMetadataListLower(metadata.keywords),
    language: (metadata.original_language || '').toLowerCase(),
    year: metadata.year ? parseInt(metadata.year) : null,
    title: (metadata.title || '').toLowerCase(),
    overview: (metadata.overview || '').toLowerCase(),
    content_type: metadata.contentAnalysis?.bestMatch?.type || null,
    // Detect event types for rule matching
    event_type: classificationMetadataService.detectEventTypesFromMetadata(metadata),
  };

  // Check each rule
  for (const rule of rulesResult.rows) {
    // Parse conditions JSON
    let conditions;
    try {
      conditions = typeof rule.conditions === 'string'
        ? JSON.parse(rule.conditions)
        : rule.conditions;
    } catch (e) {
      logger.warn('Failed to parse rule conditions', { ruleId: rule.id, error: e.message });
      continue;
    }

    if (!conditions || !Array.isArray(conditions)) continue;

    // All conditions must match (AND logic)
    const allMatch = conditions.every(condition => {
      const { field, operator, value } = condition;
      const itemValue = itemData[field];
      const ruleValues = value.split(',').map(v => v.trim().toLowerCase());

      if (itemValue === null || itemValue === undefined) return false;

      // Handle array fields (genre, keyword)
      if (Array.isArray(itemValue)) {
        switch (operator) {
          case 'includes':
            return ruleValues.some(v => itemValue.includes(v));
          case 'excludes':
            return !ruleValues.some(v => itemValue.includes(v));
          case 'contains':
            return ruleValues.some(v => itemValue.some(item => item.includes(v)));
          default:
            return false;
        }
      }

      // Handle string fields (rating, language, title, overview, content_type)
      const strValue = String(itemValue).toLowerCase();
      switch (operator) {
        case 'equals':
        case 'is':
          return ruleValues.includes(strValue);
        case 'includes':
          return ruleValues.includes(strValue);
        case 'excludes':
          return !ruleValues.includes(strValue);
        case 'contains':
          return ruleValues.some(v => strValue.includes(v));
        case 'not_contains':
          return !ruleValues.some(v => strValue.includes(v));
        case 'greater_than':
          return parseFloat(itemValue) > parseFloat(ruleValues[0]);
        case 'less_than':
          return parseFloat(itemValue) < parseFloat(ruleValues[0]);
        case 'between': {
          // value format: "1990,1999" or value + value2
          const yearVal = parseFloat(itemValue);
          const [minYear, maxYear] = ruleValues[0].includes(',')
            ? ruleValues[0].split(',').map(v => parseFloat(v.trim()))
            : [parseFloat(ruleValues[0]), parseFloat(ruleValues[1] || ruleValues[0])];
          return yearVal >= minYear && yearVal <= maxYear;
        }
        default:
          return false;
      }
    });

    if (allMatch) {
      const library = libraries.find(l => l.id === rule.library_id);
      if (library) {
        const conditionsSummary = conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ');
        return {
          library,
          isException: false,
          matchedRule: conditionsSummary,
          reason: rule.description || `Matched rule: ${rule.name}`,
        };
      }
    }
  }

  return null;
}

module.exports = { checkLibraryRules };
