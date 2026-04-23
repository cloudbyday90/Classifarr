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

const logger = createLogger('libraryLabelsService');

/**
 * Check if metadata matches a label's field+values criteria.
 * Pure — no SQL.
 *
 * @param {object} metadata
 * @param {object} label - label row with tmdb_match_field and tmdb_match_values
 * @returns {boolean}
 */
function metadataMatchesLabel(metadata, label) {
  const { tmdb_match_field, tmdb_match_values } = label;

  if (!tmdb_match_field || !tmdb_match_values || tmdb_match_values.length === 0) {
    return false;
  }

  switch (tmdb_match_field) {
    case 'certification':
      return tmdb_match_values.some(value =>
        metadata.certification && metadata.certification.toLowerCase() === value.toLowerCase()
      );

    case 'genres': {
      const genres = normalizeMetadataListLower(metadata.genres);
      if (genres.length === 0) return false;
      return tmdb_match_values.some(value => genres.some(g => g === value.toLowerCase()));
    }

    case 'keywords': {
      const keywords = normalizeMetadataListLower(metadata.keywords);
      if (keywords.length === 0) return false;
      return tmdb_match_values.some(value => keywords.includes(value.toLowerCase()));
    }

    case 'original_language':
      return tmdb_match_values.some(value =>
        metadata.original_language && metadata.original_language.toLowerCase() === value.toLowerCase()
      );

    default:
      return false;
  }
}

/**
 * Evaluate a custom rule's condition array (AND logic) against metadata.
 * Pure — no SQL.
 *
 * @param {object} metadata
 * @param {object|object[]} ruleJson - single condition or array of conditions
 * @returns {boolean}
 */
function evaluateCustomRule(metadata, ruleJson) {
  try {
    if (Array.isArray(ruleJson)) {
      return ruleJson.every(condition => evaluateSingleCondition(metadata, condition));
    }
    return evaluateSingleCondition(metadata, ruleJson);
  } catch (error) {
    logger.error('Error evaluating custom rule', { error: error.message });
    return false;
  }
}

/**
 * Evaluate one condition object against metadata fields.
 * Pure — no SQL.
 *
 * @param {object} metadata
 * @param {{field: string, operator: string, value: string}} condition
 * @returns {boolean}
 */
function evaluateSingleCondition(metadata, condition) {
  const { field, operator, value } = condition;

  let fieldValue;
  if (field === 'content_type') {
    fieldValue = metadata.contentAnalysis?.bestMatch?.type;
  } else {
    fieldValue = metadata[field];
  }

  if (!fieldValue) return false;

  switch (operator) {
    case 'contains':
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v => v.toLowerCase().includes(value.toLowerCase()));
      }
      return String(fieldValue).toLowerCase().includes(value.toLowerCase());
    case 'not_contains':
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(v => v.toLowerCase().includes(value.toLowerCase()));
      }
      return !String(fieldValue).toLowerCase().includes(value.toLowerCase());
    case 'equals':
      return String(fieldValue).toLowerCase() === String(value).toLowerCase();
    case 'not_equals':
      return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(value);
    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(value);
    case 'between': {
      // value format: "1990,1999"
      const yearVal = parseFloat(fieldValue);
      const [minYear, maxYear] = value.split(',').map(v => parseFloat(v.trim()));
      return yearVal >= minYear && yearVal <= maxYear;
    }
    default:
      return false;
  }
}

/**
 * Score each library against metadata using labels + custom rules.
 * Bulk-fetches all labels and custom rules in 2 parallel queries — fixes N+1
 * from the original per-library loop (2N queries → 2 queries always).
 *
 * @param {object} metadata
 * @param {object[]} libraries - active libraries for this media type
 * @param {object} [db]
 * @returns {Promise<{library, confidence, reason}|null>}
 */
async function matchRules(metadata, libraries, db = defaultDb) {
  if (!libraries || libraries.length === 0) return null;

  const libraryIds = libraries.map(l => l.id);

  // 2 queries total regardless of library count — run in parallel
  const [labelsResult, customRulesResult] = await Promise.all([
    db.query(
      `SELECT ll.library_id, ll.rule_type, lp.category, lp.name, lp.display_name,
              lp.tmdb_match_field, lp.tmdb_match_values
       FROM library_labels ll
       JOIN label_presets lp ON ll.label_preset_id = lp.id
       WHERE ll.library_id = ANY($1)`,
      [libraryIds]
    ),
    db.query(
      'SELECT * FROM library_custom_rules WHERE library_id = ANY($1) AND is_active = true',
      [libraryIds]
    ),
  ]);

  // Group by library_id in memory — O(n) passes, no further queries
  const labelsByLibrary = new Map();
  for (const row of labelsResult.rows) {
    if (!labelsByLibrary.has(row.library_id)) labelsByLibrary.set(row.library_id, []);
    labelsByLibrary.get(row.library_id).push(row);
  }
  const rulesByLibrary = new Map();
  for (const row of customRulesResult.rows) {
    if (!rulesByLibrary.has(row.library_id)) rulesByLibrary.set(row.library_id, []);
    rulesByLibrary.get(row.library_id).push(row);
  }

  let bestMatch = null;
  let highestScore = 0;

  for (const library of libraries) {
    let score = 0;
    const reasons = [];

    const labels = labelsByLibrary.get(library.id) || [];

    // EXCLUDE labels: disqualify if any match
    const excludeLabels = labels.filter(l => l.rule_type === 'exclude');
    let disqualified = false;
    for (const label of excludeLabels) {
      if (metadataMatchesLabel(metadata, label)) {
        score = -1000;
        disqualified = true;
        break;
      }
    }
    if (disqualified) continue;

    // INCLUDE labels: add score
    const includeLabels = labels.filter(l => l.rule_type === 'include');
    for (const label of includeLabels) {
      if (metadataMatchesLabel(metadata, label)) {
        score += 25;
        reasons.push(`Matches ${label.category}: ${label.display_name}`);
      }
    }

    // Custom rules
    const customRules = rulesByLibrary.get(library.id) || [];
    for (const rule of customRules) {
      if (evaluateCustomRule(metadata, rule.rule_json)) {
        score += 30;
        reasons.push(`Matches custom rule: ${rule.name}`);
      }
    }

    const confidence = Math.min(100, score);

    if (confidence > highestScore) {
      highestScore = confidence;
      bestMatch = {
        library,
        confidence,
        reason: reasons.join('; ') || 'Matched library criteria',
      };
    }
  }

  return bestMatch;
}

module.exports = { matchRules, metadataMatchesLabel, evaluateCustomRule, evaluateSingleCondition };
