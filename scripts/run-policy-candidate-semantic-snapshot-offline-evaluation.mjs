/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

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
  const report = evaluatePolicyCandidateSemanticSnapshotOfflineFixtureDocument({
    fixtureDocument,
    manifest,
    snapshotDocument,
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.evaluation?.validation?.ok) process.exitCode = 1;
}

main().catch(() => {
  process.stderr.write('Offline policy-candidate semantic snapshot evaluation could not run.\n');
  process.exitCode = 1;
});
