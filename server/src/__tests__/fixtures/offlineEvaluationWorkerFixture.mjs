/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort } from 'node:worker_threads';
import { loadServerEnv } from '../../config/env.mjs';
import { pool } from '../../config/database.mjs';
import { assertOfflineEvaluationClean, isOfflineEvaluationWorker } from '../../config/offlineEvaluation.mjs';

const result = { offline: isOfflineEvaluationWorker, environmentSkipped: Object.keys(loadServerEnv()).length === 0,
  inheritedSecret: Boolean(process.env.EVALUATION_TEST_SECRET), queryBlocked: false, connectBlocked: false, publicationBlocked: false };
try { pool.query('SELECT 1'); } catch { result.queryBlocked = true; }
try { await pool.connect(); } catch { result.connectBlocked = true; }
try { assertOfflineEvaluationClean(); } catch { result.publicationBlocked = true; }
parentPort.postMessage(result);
