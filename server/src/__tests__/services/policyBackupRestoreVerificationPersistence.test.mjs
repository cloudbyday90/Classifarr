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

import { jest } from '@jest/globals';

import {
  createPolicyBackupRestoreVerificationRecord,
  insertPolicyBackupRestoreVerification,
} from '../../services/policyBackupRestoreVerificationPersistence.mjs';

const VERIFIED_AT = '2026-07-25T12:00:00.000Z';

function verifiedRestore(overrides = {}) {
  return {
    verified: true,
    schemaParity: true,
    nativeAuthorityIntegrity: true,
    policyLibraryMismatchCount: 0,
    ...overrides,
  };
}

describe('policyBackupRestoreVerificationPersistence', () => {
  test('normalizes a bounded successful verification record', () => {
    expect(createPolicyBackupRestoreVerificationRecord({
      restoreMode: 'replace',
      backupVersion: ' 2.0 ',
      verification: verifiedRestore(),
      verifiedAt: VERIFIED_AT,
    })).toEqual({
      restoreMode: 'replace',
      backupVersion: '2.0',
      verifiedAt: VERIFIED_AT,
    });
  });

  test('persists only success metadata using a parameterized query', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: 3, verification_version: 1, verification_status: 'verified' }],
      }),
    };

    const result = await insertPolicyBackupRestoreVerification({
      db,
      restoreMode: 'merge',
      backupVersion: '2.0',
      verification: verifiedRestore(),
      verifiedAt: VERIFIED_AT,
    });

    expect(result).toEqual(expect.objectContaining({ id: 3 }));
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO policy_backup_restore_verifications'),
      ['merge', '2.0', VERIFIED_AT],
    );
  });

  test('rejects incomplete verification facts before writing', async () => {
    const db = { query: jest.fn() };

    await expect(insertPolicyBackupRestoreVerification({
      db,
      restoreMode: 'replace',
      backupVersion: '2.0',
      verification: verifiedRestore({ policyLibraryMismatchCount: 1 }),
      verifiedAt: VERIFIED_AT,
    })).rejects.toThrow('verified schema and native-authority state');
    expect(db.query).not.toHaveBeenCalled();
  });
});
