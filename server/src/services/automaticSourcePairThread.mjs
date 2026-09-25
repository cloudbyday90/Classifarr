/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { computeAutomaticSourcePair } from './automaticSourcePairComputation.mjs';

try {
  parentPort.postMessage({ result: computeAutomaticSourcePair(workerData.snapshot, workerData.state) });
} catch {
  parentPort.postMessage({ failed: true });
}
