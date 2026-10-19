/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';

const shared = ['soakData.mjs','soakWorker.mjs','soakInference.mjs','soakWorkload.mjs','soakProfile.mjs',
  'studyHistory.mjs','studyMeasurements.mjs','studyResource.mjs','studyDatabase.mjs','archiveQualificationProbe.mjs','archiveQualificationResources.mjs',
  'historyQueryProfile.mjs','historyQueryReference.mjs','historyPlanSummary.mjs','restoreStudyContract.mjs','restoreStudyHeap.mjs',
  'restoreStudyMetrics.mjs','restoreStudySource.mjs','restoreStudyWorker.mjs'];
const row = ['rowModeContract.mjs','rowModeCandidate.mjs','rowModeContent.mjs','rowModeObservations.mjs','rowModeProbe.mjs','rowModeWorker.mjs'];
const extra = { inference:['soakInference.mjs'], history:['historyQueryProfile.mjs'],
  restores:['restoreStudySource.mjs','restoreStudyWorker.mjs'], rowmode:['restoreStudySource.mjs','rowModeWorker.mjs'] };

export function studyPolicy(study, profile) {
  assert.ok(Object.hasOwn(extra,study), 'study_kind_invalid');
  assert.ok(['regression','extended'].includes(profile) && (study === 'inference' || profile === 'extended'), 'study_profile_invalid');
  return { files:[...shared,...(study === 'rowmode' ? row : [])], entries:['soakData.mjs','soakWorker.mjs',...extra[study]],
    application:study === 'rowmode' ? ['catalogRowReader.mjs','catalogContent.mjs'] : [] };
}

export function studyBindingRecord(binding, entry) {
  const { version,study,profile,fixtureRevision,imageRevision,image } = binding.manifest;
  return { fixture:'study-binding',version,study,profile,fixtureRevision,imageRevision,image,sha256:binding.sha256,entry };
}

export function requireBoundStudyRecords(rows, binding, entry) {
  assert.deepEqual(rows[0],studyBindingRecord(binding,entry),'study_output_binding_mismatch');
  assert.ok(rows.slice(1).every(row => !['study-binding','study-binding-failed'].includes(row.fixture)));
  return rows.slice(1);
}
