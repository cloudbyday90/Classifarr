/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runSourcePairQualityCommand } from '../../scripts/runSourcePairQualityExperiment.mjs';
import { readPrivateStudyJsonFile } from '../../scripts/privateStudyFileBoundary.mjs';
import { qualitySnapshot, qualityReferences } from '../fixtures/sourcePairQualityFixture.mjs';
import { prepareSourcePairQualityProtocol } from '../../services/sourcePairQualityProtocol.mjs';
import { executeSourcePairQualityExperiment } from '../../services/sourcePairQualityExperiment.mjs';

const saved = Object.fromEntries(['LOG_LEVEL', 'FILE_LOGGING_ENABLED', 'PGOPTIONS'].map(key => [key, process.env[key]]));
afterEach(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

test.each([[], ['--prepare'], ['--bad'], ['--output-file'], ['--prepare', '--prepare'], ['--output-file', '--prepare'],
  ['--prepare', '--reference-file', '.tmp/a.json', '--output-file', '.tmp/b.json'],
  ['--prepare', '--protocol-file', '.tmp/a.json', '--output-file', '.tmp/b.json']].map(argv => [argv]))('invalid arguments %j never evaluate', async argv => {
  const evaluate = jest.fn();
  await expect(runSourcePairQualityCommand({ argv, evaluate })).rejects.toThrow('quality_arguments_invalid');
  expect(evaluate).not.toHaveBeenCalled();
});

test('private protocol creation is exclusive; receipts omit names, case identifiers and paths', async () => {
  const protocol = prepareSourcePairQualityProtocol(qualitySnapshot()).protocol;
  const output = `.tmp/quality-command-${randomUUID()}.json`;
  const evaluate = jest.fn(async () => {
    expect(process.env.LOG_LEVEL).toBe('fatal'); expect(process.env.FILE_LOGGING_ENABLED).toBe('false');
    expect(process.env.PGOPTIONS).toContain('default_transaction_read_only=on'); return protocol;
  });
  const argv = ['--prepare', '--output-file', output];
  const receipt = await runSourcePairQualityCommand({ argv, evaluate });
  expect(receipt).toEqual({ status: 'prepared', cases: 48, protocolId: protocol.id, providerCalls: 0, routingWrites: 0 });
  expect(await readPrivateStudyJsonFile(output)).toEqual(protocol);
  await expect(runSourcePairQualityCommand({ argv, evaluate })).rejects.toThrow();
  expect(await readPrivateStudyJsonFile(output)).toEqual(protocol);
});

test('separate protocol/reference files reach evaluation only after contract validation', async () => {
  const snapshot = qualitySnapshot(), protocol = prepareSourcePairQualityProtocol(snapshot).protocol, reference = qualityReferences(protocol);
  const argv = ['--protocol-file', '.tmp/protocol.json', '--reference-file', '.tmp/references.json', '--output-file', '.tmp/report.json'];
  const readJson = jest.fn(async file => file.includes('protocol') ? protocol : reference), writeJson = jest.fn();
  const evaluate = jest.fn(async input => executeSourcePairQualityExperiment(snapshot, input.protocol, input.reference));
  const receipt = await runSourcePairQualityCommand({ argv, readJson, writeJson, evaluate });
  expect(receipt).toMatchObject({ status: 'synthetic_only', cases: 48, paired: 0, referenceLabels: 48, promotionAllowed: false });
  expect(evaluate).toHaveBeenCalledWith({ protocol, reference });
  expect(writeJson).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(receipt)).not.toMatch(/PRIVATE|target|\.tmp|item/);
  reference.labels[0].reviewerCount = 1;
  await expect(runSourcePairQualityCommand({ argv, readJson, writeJson, evaluate })).rejects.toThrow('quality_reference_invalid');
  expect(evaluate).toHaveBeenCalledTimes(1);
});

test('invalid protocols or worker results cannot be written', async () => {
  const writeJson = jest.fn(), evaluate = jest.fn(async () => ({ private: 'PRIVATE' }));
  await expect(runSourcePairQualityCommand({ argv: ['--protocol-file', '.tmp/x.json', '--output-file', '.tmp/y.json'],
    readJson: async () => ({}), writeJson, evaluate })).rejects.toThrow('quality_protocol_invalid');
  expect(evaluate).not.toHaveBeenCalled();
  await expect(runSourcePairQualityCommand({ argv: ['--prepare', '--output-file', '.tmp/y.json'], writeJson, evaluate })).rejects.toThrow('quality_result_invalid');
  expect(writeJson).not.toHaveBeenCalled();
});

test('fresh-process CLI imports stay silent; invalid input produces a fixed private-safe failure', async () => {
  const script = new URL('../../scripts/runSourcePairQualityExperiment.mjs', import.meta.url);
  const loaded = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(script.href)});`],
    { env: { ...process.env, LOG_LEVEL: 'debug', FILE_LOGGING_ENABLED: 'false' } });
  expect(loaded).toEqual({ stdout: '', stderr: '' });
  try {
    await promisify(execFile)(process.execPath, [fileURLToPath(script), '--protocol-file', '.tmp/PRIVATE-missing.json', '--output-file', '.tmp/out.json']);
    throw new Error('Expected failure');
  } catch (error) {
    expect(error.code).toBe(1); expect(error.stdout).toBe('');
    expect(error.stderr).toBe('Quality experiment did not complete. No routing changes were made.\n');
  }
});
