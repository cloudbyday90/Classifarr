/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { ValidationError } from '../utils/appError.mjs';
import { canonicalDatabaseBigintId, normalizeDatabaseBigintId } from './databaseIntegerValues.mjs';

export function requireQueueTaskId(value) {
  const id = normalizeDatabaseBigintId(value);
  if (id === null) throw new ValidationError('Valid task id is required', { code: 'invalid_task_id' });
  return id;
}

export function requireQueueTaskIdText(value) {
  const id = canonicalDatabaseBigintId(value);
  if (id === null) throw new ValidationError('Invalid task ID');
  return id;
}
