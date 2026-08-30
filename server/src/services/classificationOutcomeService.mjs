/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Persists compact, queryable post-classification outcomes back onto the
 * original classification_history row so second-pass quality can be evaluated
 * against later human confirmation/correction/retry behavior.
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { resolveExecutor } from '../utils/dbUtils.mjs';
import { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';
import { isPlainObject } from '../utils/stringUtils.mjs';
import {
  buildCurrentLibraryCandidateRetrievalOutcomeAttributionProjection,
} from './currentLibraryCandidateRetrievalOutcomeAttribution.mjs';
import {
  buildPolicyCandidateContrastiveOutcomeAttributionProjection,
} from './policyCandidateContrastiveOutcomeAttribution.mjs';

const logger = createLogger('classificationOutcomeService');

function sanitizeOutcomeSnapshot(value) {
  return isPlainObject(value) ? { ...value } : {};
}

function buildOutcomeIdentity(outcome) {
  if (!isPlainObject(outcome)) return null;

  return [
    outcome.type || '',
    outcome.source || '',
    outcome.actor || '',
    outcome.final_library_id ?? '',
    outcome.final_library_name || '',
    outcome.selected_option || ''
  ].join('|');
}

function mergeOutcome(existing, patch, nowIso) {
  const merged = {
    ...existing,
    ...patch,
    recorded_at: existing.recorded_at || patch.recorded_at || nowIso,
    updated_at: nowIso
  };

  const existingRouting = isPlainObject(existing.routing) ? existing.routing : {};
  const patchRouting = isPlainObject(patch.routing) ? patch.routing : null;
  if (patchRouting) {
    merged.routing = {
      ...existingRouting,
      ...patchRouting
    };
  } else if (Object.keys(existingRouting).length > 0) {
    merged.routing = existingRouting;
  }

  return merged;
}

function normalizeTransitions(existingPath, existingOutcome) {
  const rawTransitions = Array.isArray(existingPath?.transitions)
    ? existingPath.transitions.filter(isPlainObject)
    : [];

  if (rawTransitions.length > 0) {
    return rawTransitions.map((transition, index) => ({
      ...transition,
      sequence: Number.isInteger(Number(transition.sequence))
        ? Number(transition.sequence)
        : index + 1
    }));
  }

  if (isPlainObject(existingPath?.latest_outcome) && Object.keys(existingPath.latest_outcome).length > 0) {
    return [{
      ...existingPath.latest_outcome,
      sequence: 1
    }];
  }

  if (isPlainObject(existingOutcome) && Object.keys(existingOutcome).length > 0) {
    return [{
      ...existingOutcome,
      sequence: 1
    }];
  }

  return [];
}

function buildOutcomePath(existingPath, existingOutcome, patch, nowIso) {
  const transitions = normalizeTransitions(existingPath, existingOutcome);
  const latestTransition = transitions[transitions.length - 1] || null;
  const latestIdentity = buildOutcomeIdentity(latestTransition);
  const patchIdentity = buildOutcomeIdentity({
    ...(latestTransition || {}),
    ...patch
  });

  let nextTransitions;
  if (latestTransition && latestIdentity && patchIdentity && latestIdentity === patchIdentity) {
    nextTransitions = [...transitions];
    nextTransitions[nextTransitions.length - 1] = {
      ...mergeOutcome(latestTransition, patch, nowIso),
      sequence: latestTransition.sequence || nextTransitions.length
    };
  } else {
    const nextTransition = {
      ...mergeOutcome({}, patch, nowIso),
      sequence: transitions.length + 1
    };
    nextTransitions = [...transitions, nextTransition];
  }

  const firstOutcome = sanitizeOutcomeSnapshot(nextTransitions[0]);
  const latestOutcome = sanitizeOutcomeSnapshot(nextTransitions[nextTransitions.length - 1]);

  return {
    first_outcome: firstOutcome,
    latest_outcome: latestOutcome,
    transitions: nextTransitions.map((transition, index) => ({
      ...transition,
      sequence: transition.sequence || index + 1
    })),
    first_type: firstOutcome.type || null,
    latest_type: latestOutcome.type || null,
    first_source: firstOutcome.source || null,
    latest_source: latestOutcome.source || null,
    first_recorded_at: firstOutcome.recorded_at || null,
    latest_recorded_at: latestOutcome.recorded_at || null,
    latest_updated_at: latestOutcome.updated_at || null,
    transition_count: nextTransitions.length,
    has_multi_step: nextTransitions.length > 1
  };
}

export class ClassificationOutcomeService {
  constructor(deps = {}) {
    this.db = deps.db || db;
    this.logger = deps.logger || logger;
  }

  async recordOutcome(classificationId, outcomePatch, { client = null } = {}) {
    if (!Number.isInteger(Number(classificationId)) || Number(classificationId) < 1) {
      return { updated: false, reason: 'invalid_classification_id' };
    }
    if (!isPlainObject(outcomePatch) || Object.keys(outcomePatch).length === 0) {
      return { updated: false, reason: 'empty_outcome_patch' };
    }

    const {
      current_library_candidate_retrieval_outcome_attribution: rawCurrentLibraryCandidateRetrievalOutcomeAttribution,
      policy_candidate_contrastive_outcome_attribution: rawPolicyCandidateContrastiveOutcomeAttribution,
      ...safeOutcomePatch
    } = outcomePatch;
    const currentLibraryCandidateRetrievalOutcomeAttribution =
      buildCurrentLibraryCandidateRetrievalOutcomeAttributionProjection(
        rawCurrentLibraryCandidateRetrievalOutcomeAttribution,
      );
    const policyCandidateContrastiveOutcomeAttribution =
      buildPolicyCandidateContrastiveOutcomeAttributionProjection(
        rawPolicyCandidateContrastiveOutcomeAttribution,
      );
    const executor = resolveExecutor(client, this.db);
    const selectSql = client
      ? 'SELECT metadata FROM classification_history WHERE id = $1 FOR UPDATE'
      : 'SELECT metadata FROM classification_history WHERE id = $1';

    try {
      const existingResult = await executor.query(selectSql, [classificationId]);
      if (existingResult.rows.length === 0) {
        return { updated: false, reason: 'not_found' };
      }

      const metadata = safeParseJsonObject(existingResult.rows[0].metadata, {});
      const classificationDetails = isPlainObject(metadata.classification_details)
        ? { ...metadata.classification_details }
        : {};
      const existingOutcome = isPlainObject(classificationDetails.outcome_link)
        ? classificationDetails.outcome_link
        : {};
      const existingOutcomePath = isPlainObject(classificationDetails.outcome_path)
        ? classificationDetails.outcome_path
        : {};
      const nowIso = new Date().toISOString();
      const mergedOutcome = mergeOutcome(existingOutcome, safeOutcomePatch, nowIso);
      const mergedOutcomePath = buildOutcomePath(
        existingOutcomePath,
        existingOutcome,
        safeOutcomePatch,
        nowIso,
      );

      classificationDetails.outcome_link = mergedOutcome;
      classificationDetails.outcome_path = mergedOutcomePath;
      if (currentLibraryCandidateRetrievalOutcomeAttribution) {
        classificationDetails.current_library_candidate_retrieval_outcome_attribution =
          currentLibraryCandidateRetrievalOutcomeAttribution;
      }
      if (policyCandidateContrastiveOutcomeAttribution) {
        classificationDetails.policy_candidate_contrastive_outcome_attribution =
          policyCandidateContrastiveOutcomeAttribution;
      }
      if (isPlainObject(classificationDetails.rag_loop_summary)) {
        classificationDetails.rag_loop_summary = {
          ...classificationDetails.rag_loop_summary,
          linked_outcome_type: mergedOutcomePath.latest_type || mergedOutcome.type || null,
          linked_outcome_source: mergedOutcomePath.latest_source || mergedOutcome.source || null,
          linked_outcome_first_type: mergedOutcomePath.first_type || null,
          linked_outcome_transition_count: mergedOutcomePath.transition_count || 0,
          linked_outcome_updated_at: mergedOutcomePath.latest_updated_at || mergedOutcome.updated_at
        };
      }

      metadata.classification_details = classificationDetails;

      await executor.query(
        'UPDATE classification_history SET metadata = $2::jsonb WHERE id = $1',
        [classificationId, JSON.stringify(metadata)]
      );

      return {
        updated: true,
        outcome: mergedOutcome,
        outcomePath: mergedOutcomePath
      };
    } catch (error) {
      this.logger.warn('Failed to record classification outcome link', {
        classificationId,
        error: error.message,
        outcomeType: outcomePatch.type || null,
        outcomeSource: outcomePatch.source || null
      });
      return {
        updated: false,
        reason: 'update_failed',
        error: error.message
      };
    }
  }
}

export const classificationOutcomeService = new ClassificationOutcomeService();
