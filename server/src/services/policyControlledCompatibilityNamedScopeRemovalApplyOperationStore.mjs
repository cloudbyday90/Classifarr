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

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION,
  asObject,
  cleanString,
  isSha256Fingerprint,
  isTrustedAdminActor,
  normalizeActor,
  normalizeAuthorizationId,
  normalizeTimestamp,
} from './policyControlledCompatibilityNamedScopeRemovalApplyShared.mjs';

const POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_AUTHORIZATION_VERSION =
  'policy.controlled_compatibility_named_scope_removal_apply_authorization.v1';

const OPERATION_DIRECTORY_IDS = Object.freeze({
  CONSUMED: 'consumed',
  OUTCOMES: 'outcomes',
  PENDING: 'pending',
  ROLLBACK: 'rollback',
});

function isSameOrNestedPath(parentPath, childPath, pathModule = path) {
  const relativePath = pathModule.relative(parentPath, childPath);

  return relativePath === '' || (!relativePath.startsWith(`..${pathModule.sep}`) &&
    relativePath !== '..' && !pathModule.isAbsolute(relativePath));
}

function serialize(value) {
  return `${JSON.stringify(value)}\n`;
}

function summarizeAuthorization(record = {}) {
  const value = asObject(record);

  return {
    authorizationId: normalizeAuthorizationId(value.authorizationId),
    expiresAt: normalizeTimestamp(value.expiresAt),
    issuedAt: normalizeTimestamp(value.issuedAt),
    scopeIdentity: cleanString(value.reviewContext?.selectedEntryIdentity) || null,
  };
}

function normalizeReviewContext(reviewContext = {}) {
  const value = asObject(reviewContext);
  const review = asObject(value.review);
  const reviewArtifact = asObject(value.reviewArtifact);

  if (
    Object.prototype.hasOwnProperty.call(value, 'scopeRemovalDryRun') ||
    !cleanString(value.selectedEntryIdentity).startsWith('named_test_scope:') ||
    !isSha256Fingerprint(reviewArtifact.fingerprint) ||
    !cleanString(review.reviewedBy) ||
    !cleanString(review.reviewReason) ||
    !normalizeTimestamp(review.reviewedAt) ||
    Object.keys(asObject(value.executionGate)).length === 0
  ) {
    return null;
  }

  return {
    executionGate: value.executionGate,
    review: {
      reviewReason: cleanString(review.reviewReason),
      reviewedAt: normalizeTimestamp(review.reviewedAt),
      reviewedBy: cleanString(review.reviewedBy),
    },
    reviewArtifact: value.reviewArtifact,
    selectedEntryIdentity: cleanString(value.selectedEntryIdentity),
  };
}

async function writeJsonExclusive(fsPromises, filePath, value) {
  const handle = await fsPromises.open(filePath, 'wx', 0o600);

  try {
    await handle.writeFile(serialize(value), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readJsonIfPresent(fsPromises, filePath) {
  try {
    return JSON.parse(await fsPromises.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function createPolicyControlledCompatibilityNamedScopeRemovalApplyOperationStore({
  evidenceRoot,
  fsPromises = fs,
  now = () => new Date().toISOString(),
  pathModule = path,
  repoRoot,
  uuid = randomUUID,
} = {}) {
  let directoriesPromise = null;

  async function ensureDirectories() {
    if (directoriesPromise) return directoriesPromise;

    directoriesPromise = (async () => {
      if (!pathModule.isAbsolute(evidenceRoot) || !pathModule.isAbsolute(repoRoot)) {
        throw new Error('Controlled scope removal operation storage requires absolute roots.');
      }
      const realRepoRoot = await fsPromises.realpath(repoRoot);
      await fsPromises.mkdir(evidenceRoot, { mode: 0o700, recursive: true });
      const rootStats = await fsPromises.lstat(evidenceRoot);
      if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
        throw new Error('Controlled scope removal evidence root must be a non-symlink directory.');
      }
      const realEvidenceRoot = await fsPromises.realpath(evidenceRoot);
      if (isSameOrNestedPath(realRepoRoot, realEvidenceRoot, pathModule)) {
        throw new Error('Controlled scope removal evidence root must remain outside the repository.');
      }

      const directories = Object.fromEntries(await Promise.all(
        Object.values(OPERATION_DIRECTORY_IDS).map(async directoryId => {
          const directoryPath = pathModule.join(realEvidenceRoot, directoryId);
          await fsPromises.mkdir(directoryPath, { mode: 0o700, recursive: true });
          const directoryStats = await fsPromises.lstat(directoryPath);
          if (!directoryStats.isDirectory() || directoryStats.isSymbolicLink()) {
            throw new Error(`Controlled scope removal ${directoryId} directory is unsafe.`);
          }
          return [directoryId, directoryPath];
        })
      ));

      return directories;
    })();

    return directoriesPromise;
  }

  async function pendingRecordPath(authorizationId) {
    const directories = await ensureDirectories();

    return pathModule.join(directories[OPERATION_DIRECTORY_IDS.PENDING], `${authorizationId}.json`);
  }

  async function issueAuthorization({ actor, expiresAt, reviewContext } = {}) {
    const normalizedActor = normalizeActor(actor);
    const normalizedContext = normalizeReviewContext(reviewContext);
    const issuedAt = normalizeTimestamp(now());
    const normalizedExpiresAt = normalizeTimestamp(expiresAt);

    if (!isTrustedAdminActor(normalizedActor) || !normalizedContext || !issuedAt ||
        !normalizedExpiresAt || Date.parse(normalizedExpiresAt) <= Date.parse(issuedAt)) {
      throw new Error('Controlled scope removal authorization input is invalid.');
    }

    const authorizationId = normalizeAuthorizationId(uuid());
    if (!authorizationId) {
      throw new Error('Controlled scope removal authorization generator returned an invalid ID.');
    }

    const record = {
      authorizationId,
      authorizedActor: normalizedActor,
      expiresAt: normalizedExpiresAt,
      issuedAt,
      reviewContext: normalizedContext,
      statusId: 'issued',
      version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_AUTHORIZATION_VERSION,
    };
    await writeJsonExclusive(fsPromises, await pendingRecordPath(authorizationId), record);

    return summarizeAuthorization(record);
  }

  async function getAuthorization({ authorizationId } = {}) {
    const normalizedAuthorizationId = normalizeAuthorizationId(authorizationId);
    if (!normalizedAuthorizationId) return { statusId: 'invalid_authorization_id' };

    const authorization = await readJsonIfPresent(
      fsPromises,
      await pendingRecordPath(normalizedAuthorizationId)
    );

    if (!authorization) {
      const directories = await ensureDirectories();
      const consumedAuthorization = await readJsonIfPresent(
        fsPromises,
        pathModule.join(
          directories[OPERATION_DIRECTORY_IDS.CONSUMED],
          `${normalizedAuthorizationId}.json`
        )
      );
      if (consumedAuthorization) return { statusId: 'authorization_already_consumed' };
    }

    return authorization
      ? { authorization, statusId: 'available' }
      : { statusId: 'authorization_not_found' };
  }

  async function consumeAuthorization({ actor, authorizationId, consumedAt = now() } = {}) {
    const normalizedActor = normalizeActor(actor);
    const normalizedAuthorizationId = normalizeAuthorizationId(authorizationId);
    const normalizedConsumedAt = normalizeTimestamp(consumedAt);
    if (!normalizedAuthorizationId || !isTrustedAdminActor(normalizedActor) || !normalizedConsumedAt) {
      return { statusId: 'invalid_authorization' };
    }

    const pendingPath = await pendingRecordPath(normalizedAuthorizationId);
    const authorization = await readJsonIfPresent(fsPromises, pendingPath);
    if (!authorization) {
      const directories = await ensureDirectories();
      const consumedAuthorization = await readJsonIfPresent(
        fsPromises,
        pathModule.join(
          directories[OPERATION_DIRECTORY_IDS.CONSUMED],
          `${normalizedAuthorizationId}.json`
        )
      );
      return consumedAuthorization
        ? { statusId: 'authorization_already_consumed' }
        : { statusId: 'authorization_not_found' };
    }
    if (authorization.statusId !== 'issued' ||
        authorization.version !== POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_AUTHORIZATION_VERSION ||
        authorization.authorizedActor?.id !== normalizedActor.id ||
        authorization.authorizedActor?.role !== normalizedActor.role) {
      return { statusId: 'authorization_actor_mismatch' };
    }
    if (!normalizeTimestamp(authorization.expiresAt) ||
        Date.parse(authorization.expiresAt) <= Date.parse(normalizedConsumedAt)) {
      return { statusId: 'authorization_expired' };
    }

    const directories = await ensureDirectories();
    const consumedAuthorization = {
      ...authorization,
      consumedAt: normalizedConsumedAt,
      statusId: 'consumed',
    };
    const consumedPath = pathModule.join(
      directories[OPERATION_DIRECTORY_IDS.CONSUMED],
      `${normalizedAuthorizationId}.json`
    );
    try {
      await writeJsonExclusive(fsPromises, consumedPath, consumedAuthorization);
    } catch (error) {
      if (error?.code === 'EEXIST') return { statusId: 'authorization_already_consumed' };
      throw error;
    }
    await fsPromises.rm(pendingPath, { force: true });

    return { authorization: consumedAuthorization, statusId: 'consumed' };
  }

  async function writeRollbackEvidence({
    authorization,
    originalSourceText,
    sourceFingerprint,
    sourcePath,
    resultFingerprint,
    writtenAt = now(),
  } = {}) {
    const authorizationId = normalizeAuthorizationId(authorization?.authorizationId);
    const timestamp = normalizeTimestamp(writtenAt);
    if (!authorizationId || typeof originalSourceText !== 'string' || !timestamp ||
        !isSha256Fingerprint(sourceFingerprint) || !isSha256Fingerprint(resultFingerprint) ||
        !cleanString(sourcePath)) {
      throw new Error('Controlled scope removal rollback evidence input is invalid.');
    }

    const directories = await ensureDirectories();
    const evidence = {
      authorizationId,
      originalSourceText,
      resultFingerprint: cleanString(resultFingerprint).toLowerCase(),
      scopeIdentity: cleanString(authorization.reviewContext?.selectedEntryIdentity) || null,
      sourceFingerprint: cleanString(sourceFingerprint).toLowerCase(),
      sourcePath: cleanString(sourcePath),
      statusId: 'prepared',
      version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION,
      writtenAt: timestamp,
    };
    await writeJsonExclusive(
      fsPromises,
      pathModule.join(directories[OPERATION_DIRECTORY_IDS.ROLLBACK], `${authorizationId}.json`),
      evidence
    );

    return { evidenceId: authorizationId, sourceFingerprint: evidence.sourceFingerprint };
  }

  async function recordOutcome({ authorization, outcomeId, resultFingerprint, writtenAt = now() } = {}) {
    const authorizationId = normalizeAuthorizationId(authorization?.authorizationId);
    const timestamp = normalizeTimestamp(writtenAt);
    if (!authorizationId || !timestamp || !cleanString(outcomeId) ||
        !isSha256Fingerprint(resultFingerprint)) {
      throw new Error('Controlled scope removal outcome input is invalid.');
    }

    const directories = await ensureDirectories();
    await writeJsonExclusive(
      fsPromises,
      pathModule.join(directories[OPERATION_DIRECTORY_IDS.OUTCOMES], `${authorizationId}.json`),
      {
        authorizationId,
        outcomeId: cleanString(outcomeId),
        resultFingerprint: cleanString(resultFingerprint).toLowerCase(),
        scopeIdentity: cleanString(authorization.reviewContext?.selectedEntryIdentity) || null,
        version: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_VERSION,
        writtenAt: timestamp,
      }
    );

    return { outcomeId: cleanString(outcomeId) };
  }

  return {
    consumeAuthorization,
    getAuthorization,
    issueAuthorization,
    recordOutcome,
    writeRollbackEvidence,
  };
}

export {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_APPLY_AUTHORIZATION_VERSION,
  createPolicyControlledCompatibilityNamedScopeRemovalApplyOperationStore,
};
