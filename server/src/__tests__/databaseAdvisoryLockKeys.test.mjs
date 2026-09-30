/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { DB_ADVISORY_LOCKS } from '../config/database.mjs';
import { METADATA_REFILL_OWNER_LOCK } from '../services/queueRefillCoordination.mjs';

test('named database operations have distinct advisory keys', () => {
  const values = Object.values(DB_ADVISORY_LOCKS);
  expect(values.every(Number.isSafeInteger)).toBe(true);
  expect(new Set(values).size).toBe(values.length);
});

test('AI readiness cannot collide with existing refill or restore coordination', () => {
  expect(DB_ADVISORY_LOCKS.OLLAMA_READINESS_BACKFILL).not.toBe(METADATA_REFILL_OWNER_LOCK);
  expect(DB_ADVISORY_LOCKS.BACKUP_RESTORE).toBe(2023);
  expect(DB_ADVISORY_LOCKS.RUNTIME_MAINTENANCE).toBe(2024);
});
