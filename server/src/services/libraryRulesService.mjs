/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { detectEventTypesFromMetadata } from './classificationMetadataService.mjs';
import { buildLibraryRuleContext, evaluateRuleCondition } from './shared/libraryRuleEvaluation.mjs';

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

  const itemData = buildLibraryRuleContext(metadata, {
    detectEventTypesFromMetadata,
  });

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

    const allMatch = conditions.every(condition =>
      evaluateRuleCondition(itemData[condition.field], condition.operator, condition.value)
    );

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
