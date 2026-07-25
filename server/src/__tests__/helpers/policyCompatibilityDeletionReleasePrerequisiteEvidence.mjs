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

import {
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_VERSION,
  POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS,
  buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint,
} from '../../services/policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs';

function buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence(
  context = {},
  {
    generatedAt = new Date().toISOString(),
    subject = {
      subjectId: 'operator:release',
      subjectType: 'release_operator',
    },
  } = {}
) {
  return {
    version: POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_EVIDENCE_VERSION,
    generatedAt,
    subject,
    contextFingerprint:
      buildPolicyCompatibilityDeletionReleasePrerequisiteContextFingerprint(context),
    attestations: [
      {
        prerequisiteId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS.ROLLBACK_SUPPORT,
        statusId: 'verified',
      },
      {
        prerequisiteId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS.SUPPORT_DIAGNOSTICS,
        statusId: 'verified',
      },
      {
        prerequisiteId:
          POLICY_COMPATIBILITY_DELETION_RELEASE_PREREQUISITE_IDS
            .DELETION_MANIFEST_APPROVAL,
        statusId: 'approved',
      },
    ],
  };
}

export {
  buildReadyPolicyCompatibilityDeletionReleasePrerequisiteEvidence,
};
