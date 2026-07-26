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
  buildPolicyPostRemovalRuntimeVerificationArtifact,
} from '../server/src/services/policyPostRemovalRuntimeVerificationArtifact.mjs';
import {
  evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover,
} from '../server/src/services/policyCompatibilityRemovalRuntimeEvidenceCutover.mjs';
import {
  POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS,
  buildPolicyCompatibilityRemovalExporterDiagnostic,
} from './lib/policyCompatibilityRemovalExporterDiagnostic.mjs';

function parseArgs(argv = []) {
  const options = {
    applyResultPath: null,
    inputPath: null,
    outputPath: null,
    runtimeEvidenceOutputPath: null,
    artifactOutputPath: null,
    allowBlocked: false,
    generatedAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--apply-result') {
      options.applyResultPath = argv[index + 1] || null;
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
    if (arg === '--runtime-evidence-output') {
      options.runtimeEvidenceOutputPath = argv[index + 1] || null;
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
    'Usage: node scripts/generate-policy-post-removal-verification.mjs [options]',
    '',
    'Options:',
    '  --apply-result <json>     Required controlled-removal apply-result JSON.',
    '  --input <json>            Required post-removal verification input JSON.',
    '  --output <json>           Write nested verification JSON to this path.',
    '  --runtime-evidence-output <json>  Write fingerprinted runtime evidence JSON for next-batch authorization.',
    '  --artifact-output <json>  Write wrapper artifact JSON to this path.',
    '  --allow-blocked           Allow writing non-authorizing or blocked verification output.',
    '  --generated-at <iso>      Optional generatedAt timestamp for stable tests.',
    '  --help                    Print this help message.',
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

  let applyEvidence;
  let input;

  try {
    applyEvidence = readJsonFile(options.applyResultPath, 'apply result', {
      required: true,
    });
    input = readJsonFile(options.inputPath, 'post-removal verification input evidence', {
      required: true,
    });
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const artifact = await buildPolicyPostRemovalRuntimeVerificationArtifact({
    applyEvidence,
    input,
    generatedAt: options.generatedAt,
  });
  const runtimeEvidenceCutover =
    evaluatePolicyCompatibilityRemovalRuntimeEvidenceCutover({
      runtimeEvidenceArtifact: artifact.runtimeEvidenceArtifact,
    });

  if (runtimeEvidenceCutover.ready !== true) {
    const diagnostic = buildPolicyCompatibilityRemovalExporterDiagnostic({
      exporterId:
        POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS.POST_REMOVAL_VERIFICATION,
      runtimeEvidenceCutover,
    });

    if (options.allowBlocked === true) {
      try {
        writeJsonFile(options.outputPath, diagnostic);
      } catch (err) {
        console.error(`Could not write post-removal verification diagnostic JSON: ${err.message}`);
        process.exit(2);
      }

      console.log(JSON.stringify(diagnostic, null, 2));
    } else {
      console.error(
        'Post-removal runtime evidence contract is blocked; pass --allow-blocked to write a bounded diagnostic.'
      );
      console.error(JSON.stringify(diagnostic, null, 2));
    }

    process.exit(1);
  }

  if (artifact.verified !== true && options.allowBlocked !== true) {
    console.error(
      artifact.partialApplyVerified === true
        ? 'Post-removal runtime verification verified only a partial apply; it cannot authorize another batch or completion audit. Pass --allow-blocked to write diagnostic output.'
        : 'Post-removal runtime verification artifact is blocked; pass --allow-blocked to write diagnostic output.'
    );
    console.error(JSON.stringify({
      statusId: artifact.statusId,
      riskCount: artifact.riskCount,
      risks: artifact.risks,
      verificationStatusId: artifact.verification.statusId,
      verificationRiskCount: artifact.verification.riskCount,
      verificationRisks: artifact.verification.risks,
    }, null, 2));
    process.exit(1);
  }

  try {
    writeJsonFile(options.outputPath, artifact.verification);
    writeJsonFile(options.runtimeEvidenceOutputPath, artifact.runtimeEvidenceArtifact);
    writeJsonFile(options.artifactOutputPath, artifact);
  } catch (err) {
    console.error(`Could not write post-removal verification JSON: ${err.message}`);
    process.exit(2);
  }

  console.log(JSON.stringify(artifact, null, 2));
  process.exit(artifact.verified === true ? 0 : 1);
}

main();
