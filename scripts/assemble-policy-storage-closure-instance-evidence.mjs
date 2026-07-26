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
  buildPolicyStorageClosureInstanceEvidenceAssembly,
} from '../server/src/services/policyStorageClosureInstanceEvidenceAssembly.mjs';

function parseArgs(argv = []) {
  const options = {
    cwd: process.cwd(),
    completionAuditArtifactPath: null,
    validationEvidencePath: null,
    outputPath: null,
    currentClosureOutputPath: null,
    requirementAuditOutputPath: null,
    generatedAt: null,
    allowBlocked: false,
    requireComplete: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => argv[index + 1] || null;

    if (arg === '--cwd') {
      options.cwd = value() || options.cwd;
      index += 1;
    } else if (arg === '--completion-audit-artifact') {
      options.completionAuditArtifactPath = value();
      index += 1;
    } else if (arg === '--validation-evidence') {
      options.validationEvidencePath = value();
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = value();
      index += 1;
    } else if (arg === '--current-closure-output') {
      options.currentClosureOutputPath = value();
      index += 1;
    } else if (arg === '--requirement-audit-output') {
      options.requirementAuditOutputPath = value();
      index += 1;
    } else if (arg === '--generated-at') {
      options.generatedAt = value();
      index += 1;
    } else if (arg === '--allow-blocked') {
      options.allowBlocked = true;
    } else if (arg === '--require-complete') {
      options.requireComplete = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/assemble-policy-storage-closure-instance-evidence.mjs [options]',
    '',
    'Options:',
    '  --cwd <path>                       Selected repository checkout. Defaults to process cwd.',
    '  --completion-audit-artifact <json> Required fingerprint-valid completion-audit artifact JSON.',
    '  --validation-evidence <json>       Required fingerprint-valid validation evidence JSON.',
    '  --output <json>                    Write the assembled evidence chain.',
    '  --current-closure-output <json>    Write the assembled current-closure audit.',
    '  --requirement-audit-output <json>  Write the assembled requirement audit.',
    '  --allow-blocked                     Allow writing blocked assembled evidence.',
    '  --require-complete                  Exit non-zero unless the assembly completes.',
    '  --generated-at <iso>               Optional stable artifact timestamp.',
    '  --help                             Print this help message.',
  ].join('\n');
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 2;
  }

  if (options.help) {
    console.log(usage());
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
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  const assembly = await buildPolicyStorageClosureInstanceEvidenceAssembly({
    cwd,
    completionAuditArtifact,
    validationEvidence,
    generatedAt: options.generatedAt,
  });

  if (assembly.complete !== true && options.allowBlocked !== true) {
    console.error('Policy storage instance evidence assembly is blocked; pass --allow-blocked to write its diagnostic artifacts.');
    console.error(JSON.stringify({
      statusId: assembly.statusId,
      summary: assembly.summary,
      nextStep: assembly.nextStep,
    }, null, 2));
    return 1;
  }

  try {
    writePolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.outputPath,
      value: assembly,
    });
    writePolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.currentClosureOutputPath,
      value: assembly.currentClosureAudit,
    });
    writePolicyStorageClosureArtifactJson({
      cwd,
      filePath: options.requirementAuditOutputPath,
      value: assembly.requirementAudit,
    });
  } catch (error) {
    console.error(`Could not write policy storage instance evidence assembly JSON: ${error.message}`);
    return 2;
  }

  console.log(JSON.stringify(assembly, null, 2));
  return assembly.complete === true ? 0 : 1;
}

main().then(exitCode => {
  process.exitCode = exitCode;
}).catch(error => {
  process.exitCode = 2;
  console.error(`Could not assemble policy storage instance evidence: ${error.message}`);
});
