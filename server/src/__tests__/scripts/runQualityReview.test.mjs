/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runQualityReviewCommand } from '../../scripts/runQualityReview.mjs';
import { qualityReviewFailure, qualityReviewReceiptFile } from '../../scripts/qualityReviewCommandArguments.mjs';
import { readPrivateStudyJsonFile, writePrivateStudyJsonFile } from '../../scripts/privateStudyFileBoundary.mjs';
import { writeOrVerifyPrivateStudyJsonFile } from '../../scripts/privateStudyFileReplay.mjs';
import { qualityReviewFixture, qualityTestSubmission } from '../fixtures/qualityReviewFixture.mjs';

const common = ['--protocol-file', '.tmp/protocol.json', '--packet-file', '.tmp/packet.json', '--output-file', '.tmp/reference.json'];
const primary = ['--reviewer-one-file', '.tmp/one.json', '--reviewer-two-file', '.tmp/two.json'];
function memory() {
  const input = qualityReviewFixture(400), files = new Map([
    ['.tmp/protocol.json', input.protocol], ['.tmp/packet.json', input.packet],
    ['.tmp/one.json', qualityTestSubmission(input, 'one')], ['.tmp/two.json', qualityTestSubmission(input, 'two')],
  ]);
  const fileKey = path => path.replaceAll('\\', '/');
  const cloneJson = value => JSON.parse(JSON.stringify(value));
  const readJson = jest.fn(async path => { if (!files.has(fileKey(path))) throw new Error('PRIVATE missing file'); return cloneJson(files.get(fileKey(path))); });
  const writeJson = jest.fn(async (path, value) => {
    if (files.has(fileKey(path))) throw Object.assign(new Error('PRIVATE exists'), { code: 'EEXIST' });
    files.set(fileKey(path), cloneJson(value));
  });
  return { input, files, readJson, writeJson, now: input.now };
}

test.each([
  [], ['unknown'], ['template'], ['compose', ...common], ['__proto__', ...common],
  ['compose', ...common, ...primary, '--PRIVATE', 'secret'], ['compose', ...common, ...primary, '--output-file', '.tmp/again.json'],
  ['finalize', ...common, '--template-file', '.tmp/t.json', '--reviewer-one-file', '.tmp/one.json'],
  ['compose', ...common, '--reviewer-one-file', '--reviewer-two-file', '.tmp/two.json'],
].map(argv => [argv]))('invalid arguments do not read files (%#)', async argv => {
  const readJson = jest.fn();
  await expect(runQualityReviewCommand({ argv, readJson })).rejects.toThrow('quality_review_arguments_invalid');
  expect(readJson).not.toHaveBeenCalled();
});

test('template and finalization never fill missing judgments; stdout receipt omits identities and context', async () => {
  const state = memory();
  const templateResult = await runQualityReviewCommand({ ...state, argv: ['template', ...common, '--reviewer-id', 'new-reviewer', '--provenance', 'synthetic_fixture.v1'] });
  expect(templateResult).toMatchObject({ status: 'template_created', cases: 300, providerCalls: 0, databaseWrites: 0 });
  const template = state.files.get('.tmp/reference.json'); expect(template.labels.every(row => row.target === null)).toBe(true);
  state.files.delete('.tmp/reference.json'); state.files.set('.tmp/template.json', template);
  const submission = await runQualityReviewCommand({ ...state, argv: ['finalize', ...common, '--template-file', '.tmp/template.json'] });
  expect(submission).toMatchObject({ status: 'submission_created', cases: 300 });
  expect(JSON.stringify([submission, templateResult])).not.toMatch(/PRIVATE|new-reviewer|protocolId|packetDigest|labels/);
});

test('partial composition, blinded third-review preparation and stale output conflict use the existing reference format', async () => {
  const state = memory(), row = state.files.get('.tmp/two.json').labels[0];
  row.target = state.input.protocol.destinations.find(target => target.mediaType === row.mediaType && target.target !== row.target).target;
  const result = await runQualityReviewCommand({ ...state, argv: ['compose', ...common, ...primary] });
  expect(result).toMatchObject({ status: 'incomplete', summary: { total: 300, resolved: 299, disagreement: 1 } });
  expect(state.files.get('.tmp/reference.json')).toMatchObject({ version: 'source_pair_quality_reference.v1', labels: expect.any(Array) });
  expect(state.files.get('.tmp/reference.review.json').unresolved).toHaveLength(1);
  const thirdCommon = common.map(value => value === '.tmp/reference.json' ? '.tmp/third-template.json' : value);
  expect(await runQualityReviewCommand({ ...state, argv: ['adjudication-template', ...thirdCommon, ...primary, '--reviewer-id', 'third'] })).toMatchObject({ cases: 1 });
  const template = state.files.get('.tmp/third-template.json'); template.labels[0].target = row.target;
  const finalizedCommon = common.map(value => value === '.tmp/reference.json' ? '.tmp/third.json' : value);
  await runQualityReviewCommand({ ...state, argv: ['finalize', ...finalizedCommon, ...primary, '--template-file', '.tmp/third-template.json'] });
  await expect(runQualityReviewCommand({ ...state, argv: ['compose', ...common, ...primary, '--adjudication-file', '.tmp/third.json'] })).rejects.toMatchObject({ code: 'STUDY_OUTPUT_CONFLICT' });
  expect(state.files.get('.tmp/reference.review.json').status).toBe('incomplete');
  const newCommon = common.map(value => value === '.tmp/reference.json' ? '.tmp/resolved.json' : value);
  expect(await runQualityReviewCommand({ ...state, argv: ['compose', ...newCommon, ...primary, '--adjudication-file', '.tmp/third.json'] })).toMatchObject({ status: 'complete', summary: { resolved: 300, adjudicated: 1 } });
});

test('interrupted composition retries identical output and completes the missing receipt', async () => {
  const state = memory(), argv = ['compose', ...common, ...primary], write = state.writeJson.getMockImplementation();
  state.writeJson.mockImplementationOnce(write).mockRejectedValueOnce(Object.assign(new Error('disk full'), { code: 'ENOSPC' }));
  await expect(runQualityReviewCommand({ ...state, argv })).rejects.toThrow('disk full');
  const original = structuredClone(state.files.get('.tmp/reference.json'));
  expect(state.files.has('.tmp/reference.review.json')).toBe(false);
  expect(await runQualityReviewCommand({ ...state, argv })).toMatchObject({ status: 'complete' });
  expect(state.files.get('.tmp/reference.json')).toEqual(original);
  expect(await runQualityReviewCommand({ ...state, argv })).toMatchObject({ status: 'complete' });
});

test('private replay never treats access failures, malformed existing content or changed output as success', async () => {
  const readJson = jest.fn();
  const writeJson = jest.fn(async () => { throw Object.assign(new Error('denied'), { code: 'EACCES' }); });
  await expect(writeOrVerifyPrivateStudyJsonFile('.tmp/x.json', {}, { readJson, writeJson })).rejects.toThrow('denied');
  expect(readJson).not.toHaveBeenCalled();
  writeJson.mockRejectedValue(Object.assign(new Error('exists'), { code: 'EEXIST' }));
  readJson.mockRejectedValue(new Error('invalid JSON'));
  await expect(writeOrVerifyPrivateStudyJsonFile('.tmp/x.json', {}, { readJson, writeJson })).rejects.toThrow('invalid JSON');
  expect(() => qualityReviewReceiptFile('.tmp/file.txt')).toThrow('quality_review_arguments_invalid');
  expect(qualityReviewReceiptFile('.tmp/a.JSON')).toMatch(/a\.review\.json$/);
  expect(qualityReviewFailure(new Error('PRIVATE path and contents'))).toMatchObject({ code: 'quality_review_file_error' });
  expect(JSON.stringify(qualityReviewFailure(new Error('PRIVATE')))).not.toContain('PRIVATE');
  expect(qualityReviewFailure(new Error('quality_review_duplicate_reviewers')).guidance).toContain('distinct reviewers');
  expect(qualityReviewFailure({ code: 'STUDY_OUTPUT_CONFLICT' }).code).toBe('STUDY_OUTPUT_CONFLICT');
});

test('fresh CLI uses no database, emits safe exit codes and preserves private files', async () => {
  const input = qualityReviewFixture(300, new Date().toISOString()), base = `.tmp/quality-review-cli-${randomUUID()}`;
  const paths = { protocol: `${base}/protocol.json`, packet: `${base}/packet.json`, one: `${base}/one.json`, two: `${base}/two.json`, reference: `${base}/reference.json` };
  await Promise.all([
    writePrivateStudyJsonFile(paths.protocol, input.protocol), writePrivateStudyJsonFile(paths.packet, input.packet),
    writePrivateStudyJsonFile(paths.one, qualityTestSubmission(input, 'one')), writePrivateStudyJsonFile(paths.two, qualityTestSubmission(input, 'two')),
  ]);
  const script = fileURLToPath(new URL('../../scripts/runQualityReview.mjs', import.meta.url));
  const run = argv => promisify(execFile)(process.execPath, [script, ...argv], { timeout: 30000,
    env: { ...process.env, POSTGRES_HOST: '127.0.0.1', POSTGRES_PORT: '1' } });
  const argv = ['compose', '--protocol-file', paths.protocol, '--packet-file', paths.packet, '--reviewer-one-file', paths.one,
    '--reviewer-two-file', paths.two, '--output-file', paths.reference];
  const result = await run(argv).catch(error => error);
  expect(result.code).toBe(2); expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({ status: 'complete', provenance: 'synthetic_fixture.v1', summary: { resolved: 300 }, databaseWrites: 0 });
  const reference = await readPrivateStudyJsonFile(paths.reference); expect(reference.labels).toHaveLength(300);
  await expect(run(argv)).rejects.toMatchObject({ code: 2, stderr: '' });
  expect(await readPrivateStudyJsonFile(paths.reference)).toEqual(reference);
  const failure = await run(['PRIVATE']).catch(error => error);
  expect(failure.code).toBe(1); expect(failure.stdout).toBe('');
  expect(JSON.parse(failure.stderr)).toMatchObject({ code: 'quality_review_arguments_invalid', guidance: expect.any(String) });
  expect(failure.stderr).not.toContain('PRIVATE');
});

test('importing the CLI is silent', async () => {
  const script = new URL('../../scripts/runQualityReview.mjs', import.meta.url);
  const result = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(script.href)})`]);
  expect(result.stdout + result.stderr).toBe('');
});
