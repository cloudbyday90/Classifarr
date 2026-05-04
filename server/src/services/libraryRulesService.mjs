/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import classificationMetadataService from './classificationMetadataService.mjs';

const logger = createLogger('libraryRulesService');

async function checkLibraryRules(metadata, libraries, db = defaultDb) {
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

  const itemData = {
    rating: (metadata.certification || '').toUpperCase(),
    genre: normalizeMetadataListLower(metadata.genres),
    keyword: normalizeMetadataListLower(metadata.keywords),
    language: (metadata.original_language || '').toLowerCase(),
    year: metadata.year ? parseInt(metadata.year) : null,
    title: (metadata.title || '').toLowerCase(),
    overview: (metadata.overview || '').toLowerCase(),
    content_type: metadata.contentAnalysis?.bestMatch?.type || null,
    event_type: classificationMetadataService.detectEventTypesFromMetadata(metadata),
  };

  for (const rule of rulesResult.rows) {
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

    const allMatch = conditions.every(condition => {
      const { field, operator, value } = condition;
      const itemValue = itemData[field];
      const ruleValues = value.split(',').map(v => v.trim().toLowerCase());

      if (itemValue === null || itemValue === undefined) return false;

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

export { checkLibraryRules };
export default { checkLibraryRules };
