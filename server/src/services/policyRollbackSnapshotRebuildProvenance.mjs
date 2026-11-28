/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { POLICY_CONVERSION_ACTOR_SOURCE_IDS } from './policyConversionActorSources.mjs';

const REBUILD_CAPTURE_REASON = 'library_rebuild_snapshot_persisted';
const SHA256_HEX = /^[a-f0-9]{64}$/u;

function readRollbackArchiveObject(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function hasRebuildRollbackAcceptance(payload) {
  return Object.hasOwn(readRollbackArchiveObject(payload) ?? {}, 'acceptance');
}

function buildRebuildCaptureEvidence(payload) {
  const acceptance = readRollbackArchiveObject(payload)?.acceptance;
  const transitionFingerprint = acceptance?.transition_fingerprint;
  const proposalFingerprint = acceptance?.proposal_fingerprint;
  const rollbackPlanFingerprint = acceptance?.rollback_plan_fingerprint;
  const actorReference = acceptance?.actor_reference;
  const actorSourceId = acceptance?.actor_source_id;
  if (actorSourceId !== POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR ||
      ![transitionFingerprint, proposalFingerprint, rollbackPlanFingerprint, actorReference]
        .every(value => typeof value === 'string' && SHA256_HEX.test(value))) {
    return null;
  }
  return {
    transitionFingerprint,
    proposalFingerprint,
    rollbackPlanFingerprint,
    actorSourceId,
    actorReference,
    idempotencyKey: `policy:library_rebuild_acceptance:${transitionFingerprint}`,
  };
}

export {
  buildRebuildCaptureEvidence,
  hasRebuildRollbackAcceptance,
  readRollbackArchiveObject,
  REBUILD_CAPTURE_REASON,
};
