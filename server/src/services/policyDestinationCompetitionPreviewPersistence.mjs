/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_DESTINATION_COMPETITION_MAXIMUM_COMPETITORS = 25;

/**
 * Returns only server-selected competitor configurations. The caller's draft,
 * destination choices, and policy limit never influence the SQL structure or
 * scope. Competitor identities remain inside the service boundary.
 */
export async function loadPolicyDestinationCompetitionCompetitors({
  db,
  policyId,
  mediaType,
  maximumCompetitors = POLICY_DESTINATION_COMPETITION_MAXIMUM_COMPETITORS,
} = {}) {
  const result = await db.query(`
    SELECT
      lp.*,
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
    WHERE lp.id <> $1
      AND lp.enabled = TRUE
      AND l.is_active = TRUE
      AND l.media_type = $2
    GROUP BY lp.id, l.id
    ORDER BY COALESCE(lp.priority, 0) DESC, COALESCE(lp.sort_order, 0) ASC, lp.id ASC
    LIMIT $3
  `, [policyId, mediaType, maximumCompetitors]);

  return result.rows || [];
}
