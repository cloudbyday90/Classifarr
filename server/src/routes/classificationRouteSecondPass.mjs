/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildOutcomeRateSet,
  createDefaultOutcomeCohorts,
  createEmptyOutcomeTypeBreakdown,
  parsePositiveIntWithBounds,
} from './classificationRouteHelpers.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';

export function registerSecondPassRoute(router, { db }) {
  router.get('/second-pass-evaluation', asyncHandler(async (req, res) => {
    const days = parsePositiveIntWithBounds(req.query.days, 30, { min: 1, max: 365 });

    const result = await db.query(
      `WITH classified AS (
       SELECT
         CASE
           WHEN COALESCE((metadata->'classification_details'->'rag_loop_summary'->>'ran')::boolean, false) = false
             THEN 'baseline'
           WHEN COALESCE((metadata->'classification_details'->'rag_loop_summary'->>'adopted')::boolean, false) = true
             THEN 'pass2_adopted'
           ELSE 'pass2_not_adopted'
         END AS cohort,
         COALESCE(
           NULLIF(metadata->'classification_details'->'outcome_path'->>'latest_type', ''),
           NULLIF(metadata->'classification_details'->'outcome_link'->>'type', '')
         ) AS latest_outcome_type,
         NULLIF(metadata->'classification_details'->'outcome_path'->>'first_type', '') AS first_outcome_type,
         COALESCE((metadata->'classification_details'->'outcome_path'->>'has_multi_step')::boolean, false) AS has_multi_step
       FROM classification_history
       WHERE method != 'source_library'
         AND created_at >= NOW() - ($1 || ' days')::INTERVAL
       )
       SELECT
         cohort,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE latest_outcome_type IS NOT NULL)::int AS linked_outcomes,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'verified')::int AS verified,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'corrected')::int AS corrected,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'resolved')::int AS resolved,
         COUNT(*) FILTER (WHERE latest_outcome_type = 'retried')::int AS retried,
         COUNT(*) FILTER (WHERE first_outcome_type = 'verified')::int AS first_verified,
         COUNT(*) FILTER (WHERE first_outcome_type = 'corrected')::int AS first_corrected,
         COUNT(*) FILTER (WHERE first_outcome_type = 'resolved')::int AS first_resolved,
         COUNT(*) FILTER (WHERE first_outcome_type = 'retried')::int AS first_retried,
         COUNT(*) FILTER (WHERE has_multi_step = true)::int AS multi_step_outcomes
       FROM classified
       GROUP BY cohort
       ORDER BY cohort ASC`,
      [days]
    );

    const defaultCohorts = createDefaultOutcomeCohorts();

    for (const row of result.rows) {
      if (!defaultCohorts[row.cohort]) {
        continue;
      }

      const total = Number.parseInt(row.total, 10) || 0;
      const linkedOutcomes = Number.parseInt(row.linked_outcomes, 10) || 0;
      const corrected = Number.parseInt(row.corrected, 10) || 0;
      const verified = Number.parseInt(row.verified, 10) || 0;
      const resolved = Number.parseInt(row.resolved, 10) || 0;
      const retried = Number.parseInt(row.retried, 10) || 0;
      const multiStepOutcomes = Number.parseInt(row.multi_step_outcomes, 10) || 0;
      const firstOutcomeBreakdown = {
        verified: Number.parseInt(row.first_verified, 10) || 0,
        corrected: Number.parseInt(row.first_corrected, 10) || 0,
        resolved: Number.parseInt(row.first_resolved, 10) || 0,
        retried: Number.parseInt(row.first_retried, 10) || 0,
      };
      const rateSet = buildOutcomeRateSet({
        total,
        linkedOutcomes,
        verified,
        corrected,
        resolved,
        retried,
      });

      defaultCohorts[row.cohort] = {
        cohort: row.cohort,
        total,
        linkedOutcomes,
        verified,
        corrected,
        resolved,
        retried,
        multiStepOutcomes,
        firstOutcomeBreakdown,
        latestOutcomeBreakdown: {
          verified,
          corrected,
          resolved,
          retried,
        },
        perTotal: rateSet.perTotal,
        perLinkedOutcome: rateSet.perLinkedOutcome,
        linkedOutcomeRate: rateSet.perTotal.linkedOutcomeRate,
        correctedRate: rateSet.perLinkedOutcome.correctedRate,
        verifiedRate: rateSet.perLinkedOutcome.verifiedRate,
        resolvedRate: rateSet.perLinkedOutcome.resolvedRate,
        retriedRate: rateSet.perLinkedOutcome.retriedRate,
      };
    }

    const cohorts = [
      defaultCohorts.baseline,
      defaultCohorts.pass2_not_adopted,
      defaultCohorts.pass2_adopted,
    ];
    const totals = cohorts.reduce(
      (acc, cohort) => {
        acc.total += cohort.total;
        acc.linkedOutcomes += cohort.linkedOutcomes;
        acc.verified += cohort.verified;
        acc.corrected += cohort.corrected;
        acc.resolved += cohort.resolved;
        acc.retried += cohort.retried;
        acc.multiStepOutcomes += cohort.multiStepOutcomes;
        acc.firstOutcomeBreakdown.verified += cohort.firstOutcomeBreakdown.verified;
        acc.firstOutcomeBreakdown.corrected += cohort.firstOutcomeBreakdown.corrected;
        acc.firstOutcomeBreakdown.resolved += cohort.firstOutcomeBreakdown.resolved;
        acc.firstOutcomeBreakdown.retried += cohort.firstOutcomeBreakdown.retried;
        return acc;
      },
      {
        total: 0,
        linkedOutcomes: 0,
        verified: 0,
        corrected: 0,
        resolved: 0,
        retried: 0,
        multiStepOutcomes: 0,
        firstOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
      }
    );

    const totalRateSet = buildOutcomeRateSet(totals);

    res.json({
      windowDays: days,
      totals: {
        ...totals,
        latestOutcomeBreakdown: {
          verified: totals.verified,
          corrected: totals.corrected,
          resolved: totals.resolved,
          retried: totals.retried,
        },
        perTotal: totalRateSet.perTotal,
        perLinkedOutcome: totalRateSet.perLinkedOutcome,
        linkedOutcomeRate: totalRateSet.perTotal.linkedOutcomeRate,
        correctedRate: totalRateSet.perLinkedOutcome.correctedRate,
        verifiedRate: totalRateSet.perLinkedOutcome.verifiedRate,
        resolvedRate: totalRateSet.perLinkedOutcome.resolvedRate,
        retriedRate: totalRateSet.perLinkedOutcome.retriedRate,
      },
      cohorts,
    });
  }));
}
