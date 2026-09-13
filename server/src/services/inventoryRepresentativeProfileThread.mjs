/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { buildInventoryRepresentativeProfile } from './inventoryRepresentativeProfile.mjs';

try {
  parentPort.postMessage({ model: await buildInventoryRepresentativeProfile(workerData) });
} catch {
  parentPort.postMessage({ failed: true });
}
