/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runQualityEvidenceStudyCommand } from '../../scripts/runQualityEvidenceStudy.mjs';
import { readPrivateStudyJsonFile } from '../../scripts/privateStudyFileBoundary.mjs';
import { qualitySnapshot } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { emptyQualityEvidence } from '../../services/qualityEvidenceContract.mjs';
import { reportQualityEvidence } from '../../services/qualityEvidenceReport.mjs';

const saved = Object.fromEntries(['LOG_LEVEL', 'FILE_LOGGING_ENABLED', 'PGOPTIONS'].map(key => [key, process.env[key]]));
afterEach(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
const protocol = prepareSourcePairQualityProtocol(qualitySnapshot()).protocol;
test.each([[], ['--start'], ['--unknown'], ['--stop'], ['--start', '--output-file', '.tmp/x.json'],
  ['--collect', '--output-file', '.tmp/x.json', '--reference-file', '.tmp/ref.json'],
  ['--report', '--output-file', '.tmp/x.json', '--output-file', '.tmp/x.json'],
  ['--packet', '--output-file', '.tmp/x.json', '--protocol-file', '.tmp/a.json'],
  ['--stop', '--protocol-file', '.tmp/p.json', '--output-file', '.tmp/x.json']].map(argv => [argv]))('rejects invalid arguments before database access %j', async argv => {
  const evaluate = jest.fn(); await expect(runQualityEvidenceStudyCommand({ argv, evaluate })).rejects.toThrow('quality_arguments_invalid');
  expect(evaluate).not.toHaveBeenCalled();
});

test('start uses the already saved frozen protocol; receipt contains no case identifiers', async () => {
  const evaluate = jest.fn(async input => {
    expect(input).toEqual({ operation: 'start', protocol, reference: null });
    expect(process.env.LOG_LEVEL).toBe('fatal'); expect(process.env.FILE_LOGGING_ENABLED).toBe('false');
    expect(process.env.PGOPTIONS).toContain('default_transaction_read_only=off'); return protocol;
  });
  const writeJson = jest.fn(), options = { argv: ['--start', '--protocol-file', '.tmp/protocol.json'], readJson: async () => protocol, evaluate, writeJson };
  expect(await runQualityEvidenceStudyCommand(options)).toEqual({ operation: 'start', cases: 48, protocolId: protocol.id, providerCalls: 0, routingWrites: 0, promotionAllowed: false });
  expect(writeJson).not.toHaveBeenCalled();
});

test('report artifact creation is private and exclusive', async () => {
  const path = `.tmp/quality-study-${randomUUID()}.json`;
  const result = { version: 'quality_study_report.v1', studyState: 'active', report: reportQualityEvidence(emptyQualityEvidence(protocol), protocol) };
  const options = { argv: ['--report', '--output-file', path], evaluate: async () => result };
  await runQualityEvidenceStudyCommand(options);
  expect(await readPrivateStudyJsonFile(path)).toEqual(result);
  await expect(runQualityEvidenceStudyCommand(options)).rejects.toThrow();
  expect(await readPrivateStudyJsonFile(path)).toEqual(result);
});

test('report is read-only and sanitized, stop is explicit, malformed output never writes', async () => {
  const writeJson = jest.fn(), result = { version: 'quality_study_report.v1', studyState: 'drifted', report: reportQualityEvidence(emptyQualityEvidence(protocol), protocol) };
  const evaluate = jest.fn(async () => { expect(process.env.PGOPTIONS).toContain('default_transaction_read_only=on'); return result; });
  expect(await runQualityEvidenceStudyCommand({ argv: ['--report', '--output-file', '.tmp/result.json'], writeJson, evaluate }))
    .toMatchObject({ studyState: 'drifted', status: 'insufficient_reference_labels', paired: 0 });
  expect(writeJson).toHaveBeenCalledTimes(1);
  await expect(runQualityEvidenceStudyCommand({ argv: ['--packet', '--output-file', '.tmp/result.json'], writeJson,
    evaluate: async () => ({ version: 'quality_blind_packet.v1', cases: [], secret: 'PRIVATE' }) })).rejects.toThrow('quality_result_invalid');
  expect(writeJson).toHaveBeenCalledTimes(1);
  expect(await runQualityEvidenceStudyCommand({ argv: ['--stop', '--protocol-file', '.tmp/p.json'], readJson: async () => protocol,
    evaluate: async () => ({ stopped: true }) })).toEqual({ stopped: true, providerCalls: 0, routingWrites: 0 });
});

test('CLI import is silent and failure output omits private data', async () => {
  const script = new URL('../../scripts/runQualityEvidenceStudy.mjs', import.meta.url);
  const loaded = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(script.href)});`]);
  expect(loaded.stdout + loaded.stderr).toBe('');
  await expect(promisify(execFile)(process.execPath, [fileURLToPath(script), '--PRIVATE'])).rejects.toMatchObject({
    code: 1, stdout: '', stderr: 'Quality study did not complete. No routing changes were made.\n' });
});
