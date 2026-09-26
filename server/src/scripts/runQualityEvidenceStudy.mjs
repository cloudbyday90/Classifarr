/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolve } from 'node:path';
import { readPrivateStudyJsonFile, writePrivateStudyJsonFile } from './privateStudyFileBoundary.mjs';
import { validQualityProtocol, exactQualityKeys } from '../services/sourcePairQualityContract.mjs';
import { validSourcePairQualityReport } from '../services/sourcePairQualityReport.mjs';
import { validQualityReviewPacket } from '../services/qualityReviewPacket.mjs';

function parse(argv) {
  const operation = argv[0]?.replace(/^--/, '');
  if (!['start', 'collect', 'report', 'packet', 'stop'].includes(operation) || argv[0] !== `--${operation}`) throw new Error('quality_arguments_invalid');
  const options = { operation };
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index], value = argv[index + 1];
    if (!['--protocol-file', '--reference-file', '--output-file'].includes(key) || !value || value.startsWith('--') || Object.hasOwn(options, key)) throw new Error('quality_arguments_invalid');
    options[key] = value;
  }
  const lifecycle = ['start', 'stop'].includes(operation);
  if (!lifecycle && !options['--output-file'] || lifecycle && (!options['--protocol-file'] || options['--output-file']) ||
      options['--protocol-file'] && !lifecycle ||
      options['--reference-file'] && operation !== 'report') throw new Error('quality_arguments_invalid');
  return options;
}

export async function runQualityEvidenceStudyCommand({ argv = process.argv.slice(2), evaluate,
  readJson = readPrivateStudyJsonFile, writeJson = writePrivateStudyJsonFile } = {}) {
  const args = parse(argv), operation = args.operation;
  const protocol = args['--protocol-file'] ? await readJson(args['--protocol-file']) : null;
  if (protocol !== null && !validQualityProtocol(protocol)) throw new Error('quality_protocol_invalid');
  const reference = args['--reference-file'] ? await readJson(args['--reference-file']) : null;
  process.env.LOG_LEVEL = 'fatal'; process.env.FILE_LOGGING_ENABLED = 'false';
  const readOnly = ['report', 'packet'].includes(operation);
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=${readOnly ? 'on' : 'off'} -c statement_timeout=15000 -c lock_timeout=1000`.trim();
  const run = evaluate ?? (await import('../services/qualityStudyRuntime.mjs')).runQualityStudyRuntime;
  const result = await run({ operation, protocol, reference });
  if (operation === 'stop') {
    if (!exactQualityKeys(result, ['stopped']) || typeof result.stopped !== 'boolean') throw new Error('quality_result_invalid');
    return { ...result, providerCalls: 0, routingWrites: 0 };
  }
  if (operation === 'start') {
    if (!validQualityProtocol(result) || result.id !== protocol.id) throw new Error('quality_result_invalid');
    return { operation, cases: result.cases.length, protocolId: result.id, providerCalls: 0, routingWrites: 0, promotionAllowed: false };
  }
  if (['collect', 'report'].includes(operation) &&
      (!exactQualityKeys(result, ['version', 'studyState', 'report']) || result.version !== 'quality_study_report.v1' ||
        !['active', 'drifted', 'conflicted'].includes(result.studyState) || !validSourcePairQualityReport(result.report))) throw new Error('quality_result_invalid');
  // Packet shape and exact protocol membership are validated by the fixed worker before returning.
  if (operation === 'packet' && !validQualityReviewPacket(result)) throw new Error('quality_result_invalid');
  await writeJson(args['--output-file'], result, { label: 'Quality study' });
  return { operation, ...(result.report ? { studyState: result.studyState, status: result.report.status, paired: result.report.total.paired }
    : { cases: result.cases.length }), providerCalls: 0, routingWrites: 0, promotionAllowed: false };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runQualityEvidenceStudyCommand().then(result => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status && (result.studyState !== 'active' || result.status !== 'measured')) process.exitCode = 2;
  }).catch(() => { process.stderr.write('Quality study did not complete. No routing changes were made.\n'); process.exitCode = 1; });
}
