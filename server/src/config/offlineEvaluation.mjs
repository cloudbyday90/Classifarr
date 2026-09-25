/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { isMainThread, workerData } from 'node:worker_threads';

// Fixed worker role, never an HTTP input or an inherited environment setting.
export const isOfflineEvaluationWorker = !isMainThread && workerData?.role === 'automatic-source-pair';
let forbiddenCalls = 0;
const forbidden = () => { forbiddenCalls++; throw new Error('offline_evaluation_database_forbidden'); };
export function assertOfflineEvaluationClean() {
  if (forbiddenCalls) throw new Error('offline_evaluation_database_forbidden');
}
export class OfflineEvaluationPool {
  constructor() { this.options = {}; }
  on() {}
  query() { return forbidden(); }
  connect() { return forbidden(); }
  async end() {}
}
