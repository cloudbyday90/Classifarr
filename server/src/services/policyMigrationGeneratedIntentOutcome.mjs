/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_REBUILD_PROPOSAL_STATUS_IDS,
} from './policyLibraryPolicyRebuild.mjs';

function buildPolicyMigrationGeneratedIntentOutcome(proposal = {}) {
  return {
    destinationLibraryId: proposal.library?.libraryId ?? null,
    destinationLibraryName: proposal.library?.libraryName ?? '',
    statusId: proposal.statusId,
    routeReady: proposal.readiness?.ready === true,
    blocked: proposal.statusId === POLICY_REBUILD_PROPOSAL_STATUS_IDS.BLOCKED,
    needsReview: proposal.statusId !== POLICY_REBUILD_PROPOSAL_STATUS_IDS.READY_FOR_REVIEW,
    confidenceScore: proposal.confidence?.score ?? null,
    confidenceLevel: proposal.confidence?.level ?? '',
  };
}

export {
  buildPolicyMigrationGeneratedIntentOutcome,
};
