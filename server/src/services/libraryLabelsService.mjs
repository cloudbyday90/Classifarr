/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { evaluateMetadataRuleCondition } from './shared/libraryRuleEvaluation.mjs';

const logger = createLogger('libraryLabelsService');

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

function evaluateSingleCondition(metadata, condition) {
  return evaluateMetadataRuleCondition(metadata, condition);
}

async function matchRules(metadata, libraries, queryDb = db) {
  if (!libraries || libraries.length === 0) return null;

  const libraryIds = libraries.map(l => l.id);

  const [labelsResult, customRulesResult] = await Promise.all([
    queryDb.query(
      `SELECT ll.library_id, ll.rule_type, lp.category, lp.name, lp.display_name,
              lp.tmdb_match_field, lp.tmdb_match_values
       FROM library_labels ll
       JOIN label_presets lp ON ll.label_preset_id = lp.id
       WHERE ll.library_id = ANY($1)`,
      [libraryIds]
    ),
    queryDb.query(
      'SELECT * FROM library_custom_rules WHERE library_id = ANY($1) AND is_active = true',
      [libraryIds]
    ),
  ]);

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

    const includeLabels = labels.filter(l => l.rule_type === 'include');
    for (const label of includeLabels) {
      if (metadataMatchesLabel(metadata, label)) {
        score += 25;
        reasons.push(`Matches ${label.category}: ${label.display_name}`);
      }
    }

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

export { matchRules, metadataMatchesLabel, evaluateCustomRule, evaluateSingleCondition };
