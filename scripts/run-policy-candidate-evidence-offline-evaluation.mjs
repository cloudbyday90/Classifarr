/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { readFile } from 'node:fs/promises';

import {
  evaluatePolicyCandidateEvidenceOfflineFixtureDocument,
} from '../server/src/services/policyCandidateEvidenceOfflineEvaluation.mjs';
import {
  validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocumentForScript,
} from './lib/policyCandidateEvidenceOfflineEvaluationFixtureDocument.mjs';

const FIXTURE_DOCUMENT_URL = new URL(
  './fixtures/policy-candidate-evidence-offline-evaluation.fixtures.json',
  import.meta.url,
);

async function loadFixtureDocument() {
  const source = await readFile(FIXTURE_DOCUMENT_URL, 'utf8');
  return JSON.parse(source);
}

async function main() {
  const document = await loadFixtureDocument();
  const validation = validatePolicyCandidateEvidenceOfflineEvaluationFixtureDocumentForScript(document);
  const report = evaluatePolicyCandidateEvidenceOfflineFixtureDocument(document);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!validation.ok || !report.validation.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write('Offline policy-candidate evidence evaluation could not run.\n');
  process.exitCode = 1;
});
