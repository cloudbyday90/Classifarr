/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { readPrivateStudyJsonFile, writePrivateStudyJsonFile } from './privateStudyFileBoundary.mjs';
import { validQualityProtocol, readQualityReferences } from '../services/sourcePairQualityContract.mjs';
import { validSourcePairQualityReport } from '../services/sourcePairQualityReport.mjs';

function argumentsFor(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    if (!['--prepare', '--protocol-file', '--reference-file', '--output-file'].includes(key) || Object.hasOwn(values, key)) throw new Error('quality_arguments_invalid');
    const value = key === '--prepare' ? true : argv[++index];
    if (!value || typeof value === 'string' && value.startsWith('--')) throw new Error('quality_arguments_invalid');
    values[key] = value;
  }
  if (!values['--output-file'] || (values['--prepare'] ? values['--protocol-file'] || values['--reference-file'] : !values['--protocol-file'])) {
    throw new Error('quality_arguments_invalid');
  }
  return values;
}

/** Separate protocol/reference inputs; aggregate stdout and exclusive bounded private output only. */
export async function runSourcePairQualityCommand({ argv = process.argv.slice(2), readJson = readPrivateStudyJsonFile,
  writeJson = writePrivateStudyJsonFile, evaluate } = {}) {
  const values = argumentsFor(argv);
  const protocol = values['--prepare'] ? null : await readJson(values['--protocol-file']);
  const reference = values['--reference-file'] ? await readJson(values['--reference-file']) : null;
  if (protocol !== null) { if (!validQualityProtocol(protocol)) throw new Error('quality_protocol_invalid'); readQualityReferences(reference, protocol); }
  process.env.LOG_LEVEL = 'fatal'; process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000`.trim();
  const run = evaluate ?? (await import('../services/sourcePairQualityRuntime.mjs')).runSourcePairQualityRuntime;
  const result = await run({ protocol, reference });
  if (!(protocol === null ? validQualityProtocol(result) : validSourcePairQualityReport(result) && result.protocolId === protocol.id)) throw new Error('quality_result_invalid');
  await writeJson(values['--output-file'], result, { label: 'Quality experiment' });
  return protocol === null ? { status: 'prepared', cases: result.cases.length, protocolId: result.id, providerCalls: 0, routingWrites: 0 }
    : { status: result.status, protocolId: result.protocolId, cases: result.total.sampled, paired: result.total.paired,
      referenceLabels: result.total.independent.labels, providerCalls: 0, routingWrites: 0, promotionAllowed: false };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runSourcePairQualityCommand().then(result => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!['prepared', 'measured'].includes(result.status)) process.exitCode = 2;
  }).catch(() => { process.stderr.write('Quality experiment did not complete. No routing changes were made.\n'); process.exitCode = 1; });
}
