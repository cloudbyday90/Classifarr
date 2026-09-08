/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { randomBytes } from 'node:crypto';
import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { buildHeldOutSemanticStudyBundle } from './heldOutSemanticStudyBundle.mjs';
import { createHeldOutSemanticStudyCapture } from './heldOutSemanticStudyCapture.mjs';
import { createHeldOutSemanticStudyCohortPlanner } from './heldOutSemanticStudyCohortPlanner.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM,
  readHeldOutSemanticStudyInventoryFrame,
} from './heldOutSemanticStudyInventorySource.mjs';
import { createHeldOutSemanticStudyPreparation } from './heldOutSemanticStudyPreparation.mjs';
import { heldOutSemanticStudyConfigurationFingerprint } from './heldOutSemanticStudyProvenance.mjs';

export const HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS = Object.freeze({
  CAPTURE_FAILED: 'capture_failed',
  CAPTURED_PENDING_INDEPENDENT_LABELS: 'captured_pending_independent_labels',
  CONFIGURATION_CHANGED: 'configuration_changed',
  INSUFFICIENT_ELIGIBLE_CASES: 'insufficient_eligible_cases',
  INVALID_CANDIDATE_SOURCE: 'invalid_candidate_source',
});

function configurationFingerprint(readConfig, preparation) {
  return Promise.all([readConfig(), preparation.loadPolicies()]).then(([config, policies]) => (
    heldOutSemanticStudyConfigurationFingerprint(config, policies)
  ));
}

function projectStatus(planStatusId) {
  if (planStatusId === 'insufficient_eligible_cases') {
    return HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.INSUFFICIENT_ELIGIBLE_CASES;
  }
  if (planStatusId === 'invalid_candidate_source') {
    return HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.INVALID_CANDIDATE_SOURCE;
  }
  return HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CAPTURE_FAILED;
}

/**
 * Coordinates a private, read-only real-inventory capture. The planner sees
 * only broad-policy eligibility; the held-out retriever receives a frozen
 * cohort only after selection completes.
 */
export function createHeldOutSemanticStudyCohortCapture({
  capture = null,
  loadCandidates = ({ selectionSeed, perStratum }) => readHeldOutSemanticStudyInventoryFrame({
    query: db.query,
    selectionSeed,
    perStratum,
  }),
  planner = null,
  preparation = createHeldOutSemanticStudyPreparation(),
  random = randomBytes,
  readConfig = () => embeddingRouter.getConfig(),
} = {}) {
  const cohortPlanner = planner ?? createHeldOutSemanticStudyCohortPlanner({ preparation });
  const heldOutCapture = capture ?? createHeldOutSemanticStudyCapture({ preparation, readConfig });

  return Object.freeze({
    async capture({
      caseCount = 28,
      perStratum = HELD_OUT_SEMANTIC_STUDY_INVENTORY_FRAME_PER_STRATUM,
    } = {}) {
      try {
        const selectionSeed = random(32).toString('hex');
        const selectionSecret = random(32);
        const [initialConfig, policies] = await Promise.all([
          readConfig(),
          preparation.loadPolicies(),
        ]);
        const initialFingerprint = heldOutSemanticStudyConfigurationFingerprint(initialConfig, policies);
        const candidates = await loadCandidates({ perStratum, selectionSeed });
        const plan = await cohortPlanner.plan({ candidates, caseCount, policies, selectionSecret });
        if (!plan.request) {
          return Object.freeze({
            bundle: null,
            receipt: plan.receipt,
            status: Object.freeze({ id: projectStatus(plan.receipt.statusId) }),
          });
        }

        const beforeCaptureFingerprint = await configurationFingerprint(readConfig, preparation);
        if (beforeCaptureFingerprint !== initialFingerprint) {
          return Object.freeze({
            bundle: null,
            receipt: plan.receipt,
            status: Object.freeze({ id: HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CONFIGURATION_CHANGED }),
          });
        }

        const result = await heldOutCapture.capture(plan.request);
        if (result?.status?.id !== 'complete' || !result.document) {
          return Object.freeze({
            bundle: null,
            receipt: plan.receipt,
            status: Object.freeze({ id: HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CAPTURE_FAILED }),
          });
        }
        const bundle = buildHeldOutSemanticStudyBundle({
          selected: plan.selected,
          snapshotDocument: result.document,
        });
        if (!bundle) {
          return Object.freeze({
            bundle: null,
            receipt: plan.receipt,
            status: Object.freeze({ id: HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CAPTURE_FAILED }),
          });
        }
        return Object.freeze({
          bundle,
          receipt: plan.receipt,
          status: Object.freeze({ id: HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CAPTURED_PENDING_INDEPENDENT_LABELS }),
        });
      } catch {
        return Object.freeze({
          bundle: null,
          receipt: null,
          status: Object.freeze({ id: HELD_OUT_SEMANTIC_STUDY_COHORT_CAPTURE_STATUS_IDS.CAPTURE_FAILED }),
        });
      }
    },
  });
}
