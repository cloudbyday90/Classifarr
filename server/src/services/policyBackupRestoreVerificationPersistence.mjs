/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const RESTORE_MODES = new Set(['replace', 'merge']);
const MAX_BACKUP_VERSION_LENGTH = 64;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstRow(result) {
  return asArray(result?.rows)[0] || null;
}

function normalizeBackupVersion(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return normalized && normalized.length <= MAX_BACKUP_VERSION_LENGTH ? normalized : null;
}

function normalizeRestoreMode(value) {
  return RESTORE_MODES.has(value) ? value : null;
}

function normalizeTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isVerifiedRestore(verification = {}) {
  return verification?.verified === true &&
    verification.schemaParity === true &&
    verification.nativeAuthorityIntegrity === true &&
    Number(verification.policyLibraryMismatchCount) === 0;
}

export function createPolicyBackupRestoreVerificationRecord({
  restoreMode,
  backupVersion,
  verification,
  verifiedAt,
} = {}) {
  const normalizedRestoreMode = normalizeRestoreMode(restoreMode);
  const normalizedBackupVersion = normalizeBackupVersion(backupVersion);
  const normalizedVerifiedAt = normalizeTimestamp(verifiedAt);

  if (!normalizedRestoreMode || !normalizedBackupVersion || !normalizedVerifiedAt) {
    throw new TypeError('Backup restore verification requires a valid mode, backup version, and verification timestamp.');
  }

  if (!isVerifiedRestore(verification)) {
    throw new TypeError('Backup restore verification requires verified schema and native-authority state.');
  }

  return {
    restoreMode: normalizedRestoreMode,
    backupVersion: normalizedBackupVersion,
    verifiedAt: normalizedVerifiedAt,
  };
}

export async function insertPolicyBackupRestoreVerification({
  db,
  restoreMode,
  backupVersion,
  verification,
  verifiedAt,
} = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('A database client with query(text) is required.');
  }

  const record = createPolicyBackupRestoreVerificationRecord({
    restoreMode,
    backupVersion,
    verification,
    verifiedAt,
  });
  const result = await db.query(
    `INSERT INTO policy_backup_restore_verifications (
       restore_mode,
       backup_version,
       verification_status,
       schema_parity_verified,
       native_authority_verified,
       policy_library_mismatch_count,
       verified_at
     )
     VALUES ($1, $2, 'verified', TRUE, TRUE, 0, $3)
     RETURNING id, verification_version, verification_status, verified_at`,
    [record.restoreMode, record.backupVersion, record.verifiedAt],
  );

  return firstRow(result);
}

export {
  MAX_BACKUP_VERSION_LENGTH,
  isVerifiedRestore,
  normalizeBackupVersion,
  normalizeRestoreMode,
};
