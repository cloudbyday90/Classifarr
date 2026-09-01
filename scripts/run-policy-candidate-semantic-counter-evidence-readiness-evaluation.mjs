/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import {
  evaluatePolicyCandidateSemanticCounterEvidenceReadiness,
} from '../server/src/services/policyCandidateSemanticCounterEvidenceReadiness.mjs';
import {
  evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument,
} from '../server/src/services/policyCandidateSemanticSnapshotOfflineEvaluation.mjs';

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

async function main() {
  const [fixtureDocument, snapshotDocument, manifest] = await Promise.all([
    loadJsonDocument(FIXTURE_DOCUMENT_URL),
    loadJsonDocument(SNAPSHOT_DOCUMENT_URL),
    loadJsonDocument(MANIFEST_URL),
  ]);
  const snapshotReport = evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
    fixtureDocument,
    manifest,
    snapshotDocument,
  });
  const report = evaluatePolicyCandidateSemanticCounterEvidenceReadiness({
    fixtureDocument,
    snapshotReport,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status.id === 'invalid_evaluation') process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write('Offline semantic counter-evidence readiness evaluation could not run.\n');
  process.exitCode = 1;
});
