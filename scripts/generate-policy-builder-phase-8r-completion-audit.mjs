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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  buildPolicyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact,
} from '../server/src/services/policyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact.mjs';

function parseArgs(argv = []) {
  const options = {
    completionAuthorizationPath: null,
    executionPlanPath: null,
    inputPath: null,
    outputPath: null,
    artifactOutputPath: null,
    allowBlocked: false,
    requireComplete: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--completion-authorization') {
      options.completionAuthorizationPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--execution-plan') {
      options.executionPlanPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--input') {
      options.inputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--output') {
      options.outputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--artifact-output') {
      options.artifactOutputPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--allow-blocked') {
      options.allowBlocked = true;
      continue;
    }
    if (arg === '--require-complete') {
      options.requireComplete = true;
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
    'Usage: node scripts/generate-policy-builder-phase-8r-completion-audit.mjs [options]',
    '',
    'Options:',
    '  --completion-authorization <json>  Required Phase 8R.20 authorization JSON.',
    '  --execution-plan <json>            Required Phase 8R.15 execution-plan JSON.',
    '  --input <json>                     Required Phase 8R.21 audit input JSON.',
    '  --output <json>                    Write nested audit JSON to this path.',
    '  --artifact-output <json>           Write wrapper artifact JSON to this path.',
    '  --allow-blocked                    Allow writing blocked audit output.',
    '  --require-complete                 Exit non-zero unless the audit is complete.',
    '  --generated-at <iso>               Optional generatedAt timestamp for stable tests.',
    '  --help                             Print this help message.',
  ].join('\n');
}

function readJsonFile(filePath, label, { required = false } = {}) {
  if (!filePath) {
    if (required) {
      throw new Error(`Missing required ${label} JSON path.`);
    }

    return {};
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);

  try {
    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${label} JSON at ${resolvedPath}: ${err.message}`);
  }
}

function writeJsonFile(filePath, value) {
  if (!filePath) {
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error('');
    console.error(usage());
    process.exit(2);
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  let completionAuthorization;
  let executionPlan;
  let input;

  try {
    completionAuthorization = readJsonFile(
      options.completionAuthorizationPath,
      'completion authorization',
      { required: true }
    );
    executionPlan = readJsonFile(options.executionPlanPath, 'execution plan', {
      required: true,
    });
    input = readJsonFile(options.inputPath, 'completion audit input evidence', {
      required: true,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const artifact = buildPolicyBuilderPhase8CompatibilityRemovalCompletionAuditArtifact({
    completionAuthorization,
    executionPlan,
    input,
    generatedAt: options.generatedAt,
  });

  if (artifact.statusId === 'blocked' && options.allowBlocked !== true) {
    console.error(
      'Phase 8R compatibility removal completion audit artifact is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: artifact.statusId,
      riskCount: artifact.riskCount,
      risks: artifact.risks,
      auditStatusId: artifact.audit.statusId,
      auditRiskCount: artifact.audit.riskCount,
      auditRisks: artifact.audit.risks,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, artifact.audit);
    writeJsonFile(options.artifactOutputPath, artifact);
  } catch (err) {
    console.error(`Could not write compatibility removal completion audit JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(artifact, null, 2));

  if (options.requireComplete && artifact.complete !== true) {
    process.exit(1);
  }

  process.exit(artifact.statusId === 'blocked' ? 1 : 0);
}

main();
