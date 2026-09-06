/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { Buffer } from 'node:buffer';
import { requireScopedRepairId } from '../libraryScopedRepair/contract.mjs';

export const CLEANUP_LIMITS = Object.freeze({ rows: 128, manifestBytes: 65536 });
export const CLEANUP_LOCK_NAMESPACE = 0x434c434a;
export function cleanupKind(kind) {
    if (!['prune', 'library', 'server'].includes(kind)) throw new Error('Invalid cleanup kind');
    return kind;
}
export function cleanupId(id) {
    if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error('Invalid cleanup job ID');
    return id;
}
export function cleanupBudget(budget) {
    if (!Number.isInteger(budget) || budget < 1 || budget > CLEANUP_LIMITS.rows) throw new Error('Invalid cleanup row budget');
    return budget;
}
export function manifestIds(ids) {
    if (!Array.isArray(ids) || ids.length > CLEANUP_LIMITS.rows || ids.some(id =>
        typeof id !== 'string' || !id.trim() || [...id].length > 100 || id.includes('\0')) ||
        Buffer.byteLength(JSON.stringify(ids)) > CLEANUP_LIMITS.manifestBytes) throw new Error('Invalid cleanup manifest batch');
    return [...new Set(ids)];
}
export function cleanupTarget(kind, id) { cleanupKind(kind); return requireScopedRepairId(id); }
export function parentTable(kind) {
    return cleanupKind(kind) === 'server' ? 'scoped_repair_lab.sync_servers' : 'scoped_repair_lab.sync_libraries';
}
export function sourcePredicate(kind) {
    return cleanupKind(kind) === 'server' ? 's.media_server_id=$1' : 's.library_id=$1';
}
