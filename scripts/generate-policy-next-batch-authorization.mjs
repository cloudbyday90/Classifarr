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
  buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact,
} from '../server/src/services/policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs';
import {
  evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover,
} from '../server/src/services/policyCompatibilityRemovalRuntimeEvidenceCutover.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS,
  buildPolicyCompatibilityRemovalExporterDiagnostic,
} from './lib/policyCompatibilityRemovalExporterDiagnostic.mjs';

function parseArgs(argv = []) {
  const options = {
    runtimeEvidenceArtifactPath: null,
    executionPlanArtifactPath: null,
    pathStateEvidencePath: null,
    inputPath: null,
    outputPath: null,
    artifactOutputPath: null,
    allowBlocked: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--runtime-evidence-artifact') {
      options.runtimeEvidenceArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--execution-plan-artifact') {
      options.executionPlanArtifactPath = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg === '--path-state-evidence') {
      options.pathStateEvidencePath = argv[index + 1] || null;
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
    'Usage: node scripts/generate-policy-next-batch-authorization.mjs [options]',
    '',
    'Options:',
    '  --runtime-evidence-artifact <json>  Required fingerprinted post-removal runtime evidence artifact JSON.',
    '  --execution-plan-artifact <json>    Required ready fingerprint-valid execution-plan artifact JSON.',
    '  --path-state-evidence <json>        Required replay-verified checkout path-state evidence JSON.',
    '  --input <json>                      Required next-batch authorization input JSON.',
    '  --output <json>                     Write nested authorization JSON to this path.',
    '  --artifact-output <json>            Write wrapper artifact JSON to this path.',
    '  --allow-blocked                     Allow writing blocked authorization output.',
    '  --generated-at <iso>                Optional generatedAt timestamp for stable tests.',
    '  --help                              Print this help message.',
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

async function main() {
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

  let runtimeEvidenceArtifact;
  let executionPlanArtifact;
  let pathStateEvidence;
  let input;

  try {
    runtimeEvidenceArtifact = readJsonFile(
      options.runtimeEvidenceArtifactPath,
      'runtime evidence artifact',
      { required: true }
    );
    executionPlanArtifact = readJsonFile(
      options.executionPlanArtifactPath,
      'execution plan artifact',
      {
        required: true,
      }
    );
    pathStateEvidence = readJsonFile(
      options.pathStateEvidencePath,
      'path-state evidence',
      {
        required: true,
      }
    );
    input = readJsonFile(options.inputPath, 'next-batch authorization input evidence', {
      required: true,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const runtimeEvidenceCutover =
    evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
      runtimeEvidenceArtifact,
      expectedExecutionPlanArtifactFingerprint:
        executionPlanArtifact?.artifactFingerprint?.fingerprint,
    });

  if (runtimeEvidenceCutover.ready !== true) {
    const diagnostic = buildPolicyCompatibilityRemovalExporterDiagnostic({
      exporterId:
        POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS.NEXT_BATCH_AUTHORIZATION,
      runtimeEvidenceCutover,
    });

    if (options.allowBlocked === true) {
      try {
        writeJsonFile(options.outputPath, diagnostic);
      } catch (err) {
        console.error(`Could not write next-batch authorization diagnostic JSON: ${err.message}`);
        process.exit(2);
      }

      console.log(JSON.stringify(diagnostic, null, 2));
    } else {
      console.error(
        'Next-batch authorization requires current runtime evidence; pass --allow-blocked to write a bounded diagnostic.'
      );
      console.error(JSON.stringify(diagnostic, null, 2));
    }

    process.exit(1);
  }

  const artifact =
    await buildPolicyNextCompatibilityRemovalBatchAuthorizationArtifact({
      runtimeEvidenceArtifact,
      executionPlanArtifact,
      pathStateEvidence,
      input,
      generatedAt: options.generatedAt,
    });

  if (
    artifact.readyForNextBatch !== true &&
    artifact.completedNoRemainingPaths !== true &&
    options.allowBlocked !== true
  ) {
    console.error(
      'Next compatibility removal batch authorization artifact is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: artifact.statusId,
      riskCount: artifact.riskCount,
      risks: artifact.risks,
      authorizationStatusId: artifact.authorization.statusId,
      authorizationRiskCount: artifact.authorization.riskCount,
      authorizationRisks: artifact.authorization.risks,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, artifact.authorization);
    writeJsonFile(options.artifactOutputPath, artifact);
  } catch (err) {
    console.error(`Could not write next-batch authorization JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(artifact, null, 2));
  process.exit(artifact.statusId === 'blocked' ? 1 : 0);
}

main().catch(err => {
  console.error(err.message);
  process.exit(2);
});
