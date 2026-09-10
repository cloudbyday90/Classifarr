/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { resolve } from 'node:path';

import { createHeldOutSemanticStudyReviewerPacketWorkflow } from '../services/heldOutSemanticStudyReviewerPacketWorkflow.mjs';
import { heldOutSemanticStudyReadinessService } from '../services/heldOutSemanticStudyReadinessService.mjs';
import { writePrivateStudyPacket } from './writePrivateStudyPacket.mjs';

const CONFIRMATION_FLAG = '--confirm-private-reviewer-packet';
const OUTPUT_FLAG = '--output-file';

function parseArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 3 || argv[0] !== CONFIRMATION_FLAG ||
      argv[1] !== OUTPUT_FLAG || typeof argv[2] !== 'string' || !argv[2]) {
    throw new Error('private_reviewer_packet_arguments_invalid');
  }
  return Object.freeze({ outputFile: argv[2] });
}

async function loadPrivateRuntime() {
  process.env.LOG_LEVEL = 'fatal';
  process.env.FILE_LOGGING_ENABLED = 'false';
  process.env.PGOPTIONS = `${process.env.PGOPTIONS || ''} -c default_transaction_read_only=on`.trim();
  const db = await import('../config/database.mjs');
  try {
    const { createHeldOutSemanticStudyCohortCapture } = await import('../services/heldOutSemanticStudyCohortCapture.mjs');
    return Object.freeze({
      cohortCapture: createHeldOutSemanticStudyCohortCapture(),
      close: () => db.pool.end(),
      readReadiness: () => heldOutSemanticStudyReadinessService.getReport({ dbClient: db }),
    });
  } catch (error) {
    await db.pool.end();
    throw error;
  }
}

/**
 * Creates a short-lived local reviewer packet after an explicit shell action.
 * Packet content is written 0600 under .tmp and is never echoed to stdout.
 */
export async function runHeldOutSemanticStudyReviewerPacket({
  argv = process.argv.slice(2),
  loadRuntime = loadPrivateRuntime,
  writePacket = writePrivateStudyPacket,
} = {}) {
  const { outputFile } = parseArguments(argv);
  const runtime = await loadRuntime();
  try {
    const workflow = createHeldOutSemanticStudyReviewerPacketWorkflow({
      cohortCapture: runtime.cohortCapture,
      readReadiness: runtime.readReadiness,
      writePacket,
    });
    return workflow.create({ outputFile });
  } finally {
    await runtime.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  runHeldOutSemanticStudyReviewerPacket().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status.id !== 'packet_created') process.exitCode = 1;
  }).catch(() => {
    process.stderr.write('Held-out reviewer packet could not run.\n');
    process.exitCode = 1;
  });
}
