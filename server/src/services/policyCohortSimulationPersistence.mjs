/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_COHORT_SIMULATION_WINDOW_DAYS = 90;
export const POLICY_COHORT_SIMULATION_MAXIMUM_ITEMS = 100;

export const POLICY_COHORT_SIMULATION_DETERMINISTIC_METHODS = Object.freeze([
  'policy_auto',
  'policy_prompt',
  'policy_recheck',
  'policy_engine',
  'signal_calculation',
  'rule_match',
  'custom_rule',
  'library_rule',
]);

export const POLICY_COHORT_SIMULATION_HISTORY_STATUSES = Object.freeze([
  'completed',
  'corrected',
  'verified',
  'reclassified',
  'routed',
]);

export async function loadPolicyCohortSimulationContext({ db, policyId } = {}) {
  const policyResult = await db.query(`
    SELECT
      lp.*,
      l.name AS library_name,
      l.media_type AS library_media_type,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', cp.id,
            'key', cp.key,
            'name', cp.name,
            'signals', cp.signals,
            'weight', pp.weight,
            'custom_signals', pp.custom_signals
          )
          ORDER BY pp.sort_order, pp.id
        ) FILTER (WHERE pp.id IS NOT NULL),
        '[]'::jsonb
      ) AS presets
    FROM library_policies lp
    JOIN libraries l ON l.id = lp.library_id
    LEFT JOIN policy_presets pp ON pp.policy_id = lp.id
    LEFT JOIN content_presets cp ON cp.id = pp.preset_id
    WHERE lp.id = $1
    GROUP BY lp.id, l.id
  `, [policyId]);

  return policyResult.rows?.[0] || null;
}

export async function loadPolicyCohortSimulationItems({
  db,
  mediaType,
  cutoff,
  maximumItems = POLICY_COHORT_SIMULATION_MAXIMUM_ITEMS,
} = {}) {
  const result = await db.query(`
    SELECT
      ch.id,
      ch.media_type,
      ch.title,
      ch.year,
      ch.library_id,
      ch.method,
      ch.status,
      ch.created_at,
      ch.genre_names,
      ch.primary_studio_name,
      ch.metadata
    FROM classification_history ch
    WHERE ch.media_type = $1
      AND ch.created_at >= $2
      AND ch.method = ANY($3::varchar[])
      AND ch.status = ANY($4::varchar[])
    ORDER BY ch.created_at DESC, ch.id DESC
    LIMIT $5
  `, [
    mediaType,
    cutoff,
    POLICY_COHORT_SIMULATION_DETERMINISTIC_METHODS,
    POLICY_COHORT_SIMULATION_HISTORY_STATUSES,
    maximumItems,
  ]);

  return result.rows || [];
}
