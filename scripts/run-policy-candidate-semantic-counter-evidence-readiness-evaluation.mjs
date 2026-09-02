/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import {
  evaluatePolicyCandidateSemanticCounterEvidenceStudy,
} from '../server/src/services/policyCandidateSemanticCounterEvidenceStudy.mjs';
import {
  loadPolicyCandidateSemanticCounterEvidenceStudyInputs,
} from './lib/policy-candidate-semantic-counter-evidence-study-inputs.mjs';

const FIXTURE_DOCUMENT_URL = new URL(
  './fixtures/policy-candidate-evidence-offline-evaluation.fixtures.json',
  import.meta.url,
);
const SNAPSHOT_DOCUMENT_URL = new URL(
  './fixtures/policy-candidate-evidence-offline-semantic-snapshots.json',
  import.meta.url,
);
const MANIFEST_URL = new URL(
  './fixtures/policy-candidate-evidence-offline-semantic-snapshot.manifest.json',
  import.meta.url,
);

async function loadJsonDocument(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

async function loadCheckedInStudyDocuments() {
  const [fixtureDocument, snapshotDocument, manifest] = await Promise.all([
    loadJsonDocument(FIXTURE_DOCUMENT_URL),
    loadJsonDocument(SNAPSHOT_DOCUMENT_URL),
    loadJsonDocument(MANIFEST_URL),
  ]);
  return Object.freeze({ fixtureDocument, manifest, snapshotDocument });
}

async function main() {
  const studyInputs = await loadPolicyCandidateSemanticCounterEvidenceStudyInputs({
    argv: process.argv.slice(2),
    loadCheckedInStudyDocuments,
  });
  const report = evaluatePolicyCandidateSemanticCounterEvidenceStudy(studyInputs);

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status.id === 'invalid_evaluation') process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write('Offline semantic counter-evidence readiness evaluation could not run.\n');
  process.exitCode = 1;
});
