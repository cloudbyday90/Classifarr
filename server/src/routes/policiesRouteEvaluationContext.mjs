/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  buildAiClassificationEvaluationPolicyContext,
} from '../services/aiClassificationEvaluationPolicyContext.mjs';

async function fetchPolicyEvaluationContextRows(db) {
  const [
    policiesResult,
    presetAttachmentsResult,
    activeNativeIntentsResult,
    activeNativeRulesResult,
    activeNativeTemplatesResult,
  ] = await Promise.all([
    db.query(`
      SELECT
        to_jsonb(lp) AS policy,
        jsonb_build_object(
          'id', library.id,
          'media_type', library.media_type,
          'is_active', library.is_active
        ) AS library
      FROM library_policies lp
      JOIN libraries library ON library.id = lp.library_id
      ORDER BY lp.id ASC
    `),
    db.query(`
      SELECT
        to_jsonb(pp) AS attachment,
        to_jsonb(cp) AS preset
      FROM policy_presets pp
      JOIN content_presets cp ON cp.id = pp.preset_id
      ORDER BY pp.policy_id ASC, pp.preset_id ASC, pp.id ASC
    `),
    db.query(`
      SELECT to_jsonb(policy_intents) AS intent
      FROM policy_intents
      WHERE active = TRUE
      ORDER BY policy_id ASC, intent_version ASC, id ASC
    `),
    db.query(`
      SELECT to_jsonb(rule) AS rule
      FROM policy_intent_rules rule
      JOIN policy_intents intent ON intent.id = rule.intent_id
      WHERE intent.active = TRUE
      ORDER BY rule.intent_id ASC, rule.collection ASC, rule.sort_order ASC, rule.id ASC
    `),
    db.query(`
      SELECT to_jsonb(template) AS template
      FROM policy_intent_template_applications template
      JOIN policy_intents intent ON intent.id = template.intent_id
      WHERE intent.active = TRUE
      ORDER BY template.intent_id ASC, template.preset_id ASC, template.id ASC
    `),
  ]);

  return {
    policies: policiesResult.rows || [],
    presetAttachments: presetAttachmentsResult.rows || [],
    activeNativeIntents: activeNativeIntentsResult.rows || [],
    activeNativeRules: activeNativeRulesResult.rows || [],
    activeNativeTemplates: activeNativeTemplatesResult.rows || [],
  };
}

export function registerPolicyEvaluationContextRoute(router, { db }) {
  router.get('/evaluation-context', asyncHandler(async (_req, res) => {
    const rows = await fetchPolicyEvaluationContextRows(db);
    return sendData(res, buildAiClassificationEvaluationPolicyContext(rows));
  }));
}

export { fetchPolicyEvaluationContextRows };
