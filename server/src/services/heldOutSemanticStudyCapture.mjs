/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { embeddingRouter } from './embeddingRouter.mjs';
import { currentLibraryCandidateSemanticRetriever } from './currentLibraryCandidateSemanticRetriever.mjs';
import { createPolicyCandidateCurrentInventorySemanticStudyCapture } from './policyCandidateCurrentInventorySemanticStudyCapture.mjs';
import { POLICY_CANDIDATE_CURRENT_INVENTORY_SEMANTIC_STUDY_IDENTIFIER_PATTERNS as IDS } from './policyCandidateCurrentInventorySemanticStudySnapshotContract.mjs';
import { createHeldOutSemanticStudyPreparation } from './heldOutSemanticStudyPreparation.mjs';
import { createHeldOutSemanticStudyScope, HELD_OUT_SEMANTIC_STUDY_PROTOCOL } from './heldOutSemanticStudyScope.mjs';
import { HELD_OUT_SEMANTIC_STUDY_DOCUMENT_VERSION, heldOutSemanticStudyConfigurationFingerprint } from './heldOutSemanticStudyProvenance.mjs';

const METADATA_KEYS = new Set([
  'tmdb_id', 'media_type', 'title', 'year', 'genres', 'overview', 'keywords',
  'certification', 'original_language', 'production_companies', 'rating',
]);

function freezeRequest(input) {
  // Own the input through every asynchronous boundary; enforce the CLI's bound
  // for programmatic callers too. Never retain caller candidate contracts.
  const json = JSON.stringify(input);
  if (!json || Buffer.byteLength(json) > 128 * 1024) throw new Error('invalid_held_out_request');
  const request = JSON.parse(json);
  if (!request || Object.keys(request).sort().join(',') !== 'cases,snapshotSetId' ||
      typeof request.snapshotSetId !== 'string' ||
      !IDS.SNAPSHOT_SET_ID.test(request.snapshotSetId) || !Array.isArray(request.cases)) {
    throw new Error('invalid_held_out_request');
  }
  const fixtures = new Set();
  const snapshots = new Set();
  for (const item of request.cases) {
    if (!item || Object.keys(item).sort().join(',') !== 'fixtureId,metadata,snapshotId' ||
        typeof item.fixtureId !== 'string' || typeof item.snapshotId !== 'string' ||
        !IDS.FIXTURE_ID.test(item.fixtureId) || !IDS.SNAPSHOT_ID.test(item.snapshotId) ||
        fixtures.has(item.fixtureId) || snapshots.has(item.snapshotId) ||
        !item.metadata || Array.isArray(item.metadata) ||
        Object.keys(item.metadata).some((key) => !METADATA_KEYS.has(key)) ||
        typeof item.metadata.title !== 'string' || !item.metadata.title.trim() ||
        item.metadata.title.length > 220) throw new Error('invalid_held_out_case');
    fixtures.add(item.fixtureId);
    snapshots.add(item.snapshotId);
  }
  const heldOutScope = createHeldOutSemanticStudyScope(request.cases.map((item) => item.metadata));
  return { request, heldOutScope };
}

/** Two phases: freeze all identities, then prepare every case before capture. */
export function createHeldOutSemanticStudyCapture({
  preparation = createHeldOutSemanticStudyPreparation(),
  retriever = currentLibraryCandidateSemanticRetriever,
  readConfig = () => embeddingRouter.getConfig(),
} = {}) {
  return Object.freeze({
    async capture(input) {
      try {
        const { request, heldOutScope } = freezeRequest(input);
        const policies = await preparation.loadPolicies();
        const configurationFingerprint = heldOutSemanticStudyConfigurationFingerprint(await readConfig(), policies);
        let configurationInvalid = false;
        const verifyConfiguration = async () => {
          try {
            const current = heldOutSemanticStudyConfigurationFingerprint(await readConfig(), await preparation.loadPolicies());
            if (configurationInvalid || current !== configurationFingerprint) throw new Error('held_out_configuration_changed');
          } catch (error) {
            configurationInvalid = true;
            throw error;
          }
        };
        const cases = [];
        for (const item of request.cases) {
          await verifyConfiguration();
          const contract = await preparation.prepare({ metadata: item.metadata, heldOutScope, policies });
          if (!contract?.valid) throw new Error('held_out_case_ineligible');
          cases.push({ ...item, contract });
        }
        const capture = createPolicyCandidateCurrentInventorySemanticStudyCapture({
          retriever: {
            async retrieve(value) {
              // The outer final check ensures drift cannot become an abstention
              // and then leave behind an apparently complete study.
              await verifyConfiguration();
              return retriever.retrieve({ ...value, heldOutScope });
            },
          },
        });
        const result = await capture.capture({ cases, snapshotSetId: request.snapshotSetId });
        await verifyConfiguration();
        if (!result.document) throw new Error('invalid_held_out_capture');
        return Object.freeze({
          ...result,
          document: Object.freeze({
            ...result.document,
            version: HELD_OUT_SEMANTIC_STUDY_DOCUMENT_VERSION,
            studyProvenance: Object.freeze({
              configurationFingerprint,
              excludedIdentityCount: cases.length,
              exclusionSetFingerprint: heldOutScope.fingerprint,
              protocolVersion: HELD_OUT_SEMANTIC_STUDY_PROTOCOL,
            }),
          }),
        });
      } catch {
        return Object.freeze({ document: null, status: Object.freeze({ id: 'invalid_request' }) });
      }
    },
  });
}
