/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import {
    classifyLibraryProfileRecovery, LIBRARY_PROFILE_RECOVERY_GRACE_MS,
    libraryProfileRecoveryReasonSql,
} from '../services/libraryProfileRecoveryAssessment.mjs';

const now = '2026-09-23T12:00:00.000Z';
const minutesAgo = minutes => new Date(Date.parse(now) - minutes * 60_000).toISOString();
const dirty = { is_active: true, dirty: true, changed_at: minutesAgo(30),
    processing_state: null, job_updated_at: null };

test('overdue reasons honor the grace boundary and durable queue clocks', () => {
    expect(LIBRARY_PROFILE_RECOVERY_GRACE_MS).toBe(900_000);
    expect(classifyLibraryProfileRecovery(dirty, now)).toBe('planner_overdue');
    expect(classifyLibraryProfileRecovery({ ...dirty, changed_at: minutesAgo(14) }, now)).toBeNull();
    expect(classifyLibraryProfileRecovery({ ...dirty, job_updated_at: minutesAgo(2) }, now)).toBeNull();
    expect(classifyLibraryProfileRecovery({ ...dirty, processing_state: 'pending',
        available_at: minutesAgo(16) }, now)).toBe('worker_overdue');
    expect(classifyLibraryProfileRecovery({ ...dirty, processing_state: 'pending',
        available_at: minutesAgo(14) }, now)).toBeNull();
    expect(classifyLibraryProfileRecovery({ ...dirty, processing_state: 'processing',
        lease_expires_at: minutesAgo(16) }, now)).toBe('lease_recovery_overdue');
    expect(classifyLibraryProfileRecovery({ ...dirty, processing_state: 'processing',
        lease_expires_at: minutesAgo(14) }, now)).toBeNull();
    expect(classifyLibraryProfileRecovery({ ...dirty, processing_state: 'failed',
        probe_at: minutesAgo(16) }, now)).toBe('planner_overdue');
    expect(classifyLibraryProfileRecovery({ ...dirty, processing_state: 'failed',
        probe_at: minutesAgo(14) }, now)).toBeNull();
    expect(classifyLibraryProfileRecovery({ ...dirty, is_active: false }, now)).toBeNull();
    expect(classifyLibraryProfileRecovery({ ...dirty, dirty: false }, now)).toBeNull();
});

test('SQL assessment accepts only its fixed internal context', () => {
    expect(libraryProfileRecoveryReasonSql('library_state', 2)).toContain('lease_recovery_overdue');
    expect(() => libraryProfileRecoveryReasonSql('user_input', 2)).toThrow(TypeError);
});
