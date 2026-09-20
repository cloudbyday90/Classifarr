/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { trainLinearRanker } from './inventoryLinearRankerMath.mjs';

try { parentPort.postMessage({ model: trainLinearRanker(workerData) }); }
catch { parentPort.postMessage({ failed: true }); }
