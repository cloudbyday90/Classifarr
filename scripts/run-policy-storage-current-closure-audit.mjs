#!/usr/bin/env node
/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import path from 'node:path';
import process from 'node:process';

import {
  readPolicyStorageClosureArtifactJson,
  writePolicyStorageClosureArtifactJson,
} from './lib/policyStorageClosureArtifactFiles.mjs';
import {
  buildPolicyStorageCurrentClosureAudit,
} from '../server/src/services/policyStorageCurrentClosureAudit.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    completionAuditArtifactPath: null,
    validationEvidencePath: null,
    outputPath: null,
    checkpointArtifactOutputPath: null,
    finalReadoutOutputPath: null,
    requireComplete: false,
    allowBlocked: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--cwd') {
      options.cwd = argv[index + 1] || options.cwd;
      index += 1;
      continue;
    }
    if (arg === '--completion-audit-artifact') {
      options.completionAuditArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--validation-evidence') {
      options.validationEvidencePath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--checkpoint-artifact-output') {
      options.checkpointArtifactOutputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--final-readout-output') {
      options.finalReadoutOutputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--require-complete') {
      options.requireComplete = true;
      continue;
    }
    if (arg === '--allow-blocked') {
      options.allowBlocked = true;
      continue;
    }
    if (arg === '--generated-at') {
      options.generatedAt = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/run-policy-storage-current-closure-audit.mjs [options]',
    '',
    'Options:',
    '  --cwd <path>                         Repository root and base for relative artifact paths. Defaults to process cwd.',
    '  --completion-audit-artifact <json>   Required compatibility-removal completion-audit artifact JSON.',
    '  --validation-evidence <json>         Required policy storage validation evidence JSON.',
    '  --output <json>                      Write full policy storage current closure audit JSON.',
    '  --checkpoint-artifact-output <json>  Write generated policy storage completion-checkpoint artifact JSON.',
    '  --final-readout-output <json>        Write generated policy storage final closure readout JSON.',
    '  --allow-blocked                      Allow writing blocked audit output.',
    '  --require-complete                   Exit non-zero unless the audit is complete.',
    '  --generated-at <iso>                 Optional generatedAt timestamp for stable tests.',
    '  --help                               Print this help message.',
  ].join('\n');
}

function writeOutput(stream, value) {
  return new Promise((resolve, reject) => {
    stream.write(`${value}\n`, err => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    await writeOutput(process.stderr, err.message);
    await writeOutput(process.stderr, '');
    await writeOutput(process.stderr, usage());
    return 2;
  }

  if (options.help) {
    await writeOutput(process.stdout, usage());
    return 0;
  }

  const cwd = path.resolve(process.cwd(), options.cwd);
  let completionAuditArtifact;
  let validationEvidence;

  try {
    completionAuditArtifact = readPolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.completionAuditArtifactPath,
      label: 'completion audit artifact',
      required: true,
    });
    validationEvidence = readPolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.validationEvidencePath,
      label: 'validation evidence',
      required: true,
    });
  } catch (err) {
    await writeOutput(process.stderr, err.message);
    return 2;
  }

  const audit = await buildPolicyStorageCurrentClosureAudit({
    cwd,
    completionAuditArtifact,
    validationEvidence,
    generatedAt: options.generatedAt,
  });

  if (audit.statusId !== 'complete' && options.allowBlocked !== true) {
    await writeOutput(process.stderr,
      'Policy storage current closure audit is blocked; pass --allow-blocked to write diagnostic output.'
    );
    await writeOutput(process.stderr, JSON.stringify({
      statusId: audit.statusId,
      riskCount: audit.riskCount,
      risks: audit.risks,
      summary: audit.summary,
      finalReadout: audit.finalReadout.operatorSummary,
    }, null, 2));
    return 1;
  }

  try {
    writePolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.outputPath,
      value: audit,
    });
    writePolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.checkpointArtifactOutputPath,
      value: audit.checkpointArtifact,
    });
    writePolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.finalReadoutOutputPath,
      value: audit.finalReadout,
    });
  } catch (err) {
    await writeOutput(
      process.stderr,
      `Could not write policy storage current closure audit JSON: ${err.message}`
    );
    return 2;
  }

  await writeOutput(process.stdout, JSON.stringify(audit, null, 2));

  return audit.statusId === 'complete' && (
    options.requireComplete !== true || audit.complete === true
  ) ? 0 : 1;
}

main().then(exitCode => {
  process.exitCode = exitCode;
}).catch(async err => {
  process.exitCode = 2;
  await writeOutput(
    process.stderr,
    `Could not run policy storage current closure audit: ${err.message}`
  );
});
