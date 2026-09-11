/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { expect, jest, test } from '@jest/globals';

import {
  runHeldOutSemanticStudyRetrievalEvaluationCompletion,
} from '../../scripts/runHeldOutSemanticStudyRetrievalEvaluationCompletion.mjs';
import { readPrivateStudyJsonFile, writePrivateStudyJsonFile } from '../../scripts/privateStudyFileBoundary.mjs';

const argv = [
  '--confirm-private-study-evaluation',
  '--packet-file', '.tmp/study/packet.json',
  '--reviewer-one-file', '.tmp/study/reviewer-one.json',
  '--reviewer-two-file', '.tmp/study/reviewer-two.json',
  '--adjudication-file', '.tmp/study/adjudication.json',
  '--output-file', '.tmp/study/results.json',
];

test('requires explicit confirmation and derives private study companions without exposing paths', async () => {
  const complete = jest.fn(async () => ({ status: { id: 'complete' } }));
  const createWorkflow = jest.fn(() => ({ complete }));

  await expect(runHeldOutSemanticStudyRetrievalEvaluationCompletion({
    argv: argv.slice(1),
    createWorkflow,
  })).rejects.toThrow('arguments_invalid');
  expect(createWorkflow).not.toHaveBeenCalled();

  const result = await runHeldOutSemanticStudyRetrievalEvaluationCompletion({ argv, createWorkflow });

  expect(result).toEqual({ status: { id: 'complete' } });
  expect(complete).toHaveBeenCalledWith({
    adjudicationFile: '.tmp/study/adjudication.json',
    paths: {
      bundleFile: join('.tmp', 'study', 'packet.evaluation-bundle.json'),
      packetFile: '.tmp/study/packet.json',
      referenceSetFile: join('.tmp', 'study', 'results.reference-set.json'),
      representationArtifactFile: join('.tmp', 'study', 'results.representation-artifact.json'),
      resultsOutputFile: '.tmp/study/results.json',
      scorerSubmissionFile: join('.tmp', 'study', 'results.scorer-submission.json'),
      scoringInputFile: join('.tmp', 'study', 'packet.scoring-input.json'),
    },
    reviewerOneFile: '.tmp/study/reviewer-one.json',
    reviewerTwoFile: '.tmp/study/reviewer-two.json',
  });
  expect(JSON.stringify(result)).not.toContain('.tmp');
});

test('retries after provider failure using freshly validated consensus and rejects changed labels', async () => {
  const projectRoot = resolve(import.meta.dirname, '../../../..');
  await mkdir(join(projectRoot, '.tmp'), { recursive: true });
  const directory = await mkdtemp(join(projectRoot, '.tmp', 'evaluation-recovery-'));
  const localFile = (name) => relative(projectRoot, join(directory, name));
  const fingerprint = `sha256:${'a'.repeat(64)}`;
  const labels = Array.from({ length: 24 }, (_, index) => ({
    fixtureId: `fixture_${String(index).padStart(16, '0')}`,
    referenceDecisionId: index % 2 === 0 ? 'admit' : 'review',
  }));
  const submission = (submissionId, decisions = labels) => ({
    fixtureDocumentFingerprint: fingerprint,
    labels: decisions,
    submissionId,
    version: 'policy.candidate_semantic_reviewer_submission.v1',
  });
  const packet = {
    cases: labels.map(({ fixtureId }) => ({ fixtureId })),
    fixtureDocumentFingerprint: fingerprint,
    instructions: { boundary: 'Synthetic test data only.' },
    packetId: `review_packet_${'b'.repeat(64)}`,
    studyWindow: { startsAt: '2026-09-10T12:00:00.000Z', expiresAt: '2026-09-11T12:00:00.000Z' },
    version: 'policy.held_out_semantic_study_reviewer_packet.v1',
  };
  const argumentsFor = (one, two) => [
    '--confirm-private-study-evaluation',
    '--packet-file', localFile('packet.json'),
    '--reviewer-one-file', localFile(one),
    '--reviewer-two-file', localFile(two),
    '--output-file', localFile('results.json'),
  ];
  // Only the unavailable provider is stubbed: argument parsing, orchestration,
  // independent consensus, and private filesystem writes are real.
  const runScorer = jest.fn(async () => ({ submissionWritten: false, status: { id: 'evaluator_unavailable' } }));
  const runArtifacts = jest.fn();
  const runResults = jest.fn();
  try {
    await writePrivateStudyJsonFile(localFile('packet.json'), packet);
    await writePrivateStudyJsonFile(localFile('one.json'), submission('reviewer_one'));
    await writePrivateStudyJsonFile(localFile('two.json'), submission('reviewer_two'));
    const run = (one = 'one.json', two = 'two.json') => runHeldOutSemanticStudyRetrievalEvaluationCompletion({
      argv: argumentsFor(one, two), runScorer, runArtifacts, runResults,
    });
    await expect(run()).resolves.toMatchObject({ status: { id: 'scorer_unavailable' } });
    const original = await readPrivateStudyJsonFile(localFile('results.reference-set.json'));
    await expect(run()).resolves.toMatchObject({ status: { id: 'scorer_unavailable' } });
    expect(runScorer).toHaveBeenCalledTimes(2);

    const changed = labels.map((label) => ({ ...label, referenceDecisionId: 'review' }));
    await writePrivateStudyJsonFile(localFile('changed-one.json'), submission('reviewer_one', changed));
    await writePrivateStudyJsonFile(localFile('changed-two.json'), submission('reviewer_two', changed));
    await expect(run('changed-one.json', 'changed-two.json')).resolves.toMatchObject({
      status: { id: 'reference_set_conflict' },
    });
    expect(runScorer).toHaveBeenCalledTimes(2);
    expect(runArtifacts).not.toHaveBeenCalled();
    expect(runResults).not.toHaveBeenCalled();
    await expect(readPrivateStudyJsonFile(localFile('results.reference-set.json'))).resolves.toEqual(original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
