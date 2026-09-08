/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as database from '../config/database.mjs';
import {
  auditHeldOutSemanticStudyReadiness,
  buildHeldOutSemanticStudyReadiness,
  buildHeldOutSemanticStudyReadinessUnavailable,
} from './heldOutSemanticStudyReadiness.mjs';
import {
  loadHeldOutSemanticStudyLifecycleReauditPurposeEvidenceRecord,
} from './heldOutSemanticStudyLifecycleReauditPurposeEvidence.mjs';
import {
  loadHeldOutSemanticStudyLifecycleReauditSourceRecord,
} from './heldOutSemanticStudyLifecycleReauditSource.mjs';
import {
  loadHeldOutSemanticStudyLifecycleReauditState,
} from './heldOutSemanticStudyLifecycleReauditPersistence.mjs';

/**
 * Reads existing aggregate sources and, when available, one stored aggregate
 * audit state. It does not schedule the audit, call a provider, expose
 * configuration, mutate policy state, or route media.
 */
export function createHeldOutSemanticStudyReadinessService({
  db = database,
  buildReadiness = buildHeldOutSemanticStudyReadiness,
  auditReadiness = auditHeldOutSemanticStudyReadiness,
  loadLifecycleRecord = loadHeldOutSemanticStudyLifecycleReauditSourceRecord,
  loadAuditState = loadHeldOutSemanticStudyLifecycleReauditState,
  loadPurposeEvidenceRecord = loadHeldOutSemanticStudyLifecycleReauditPurposeEvidenceRecord,
  buildUnavailable = buildHeldOutSemanticStudyReadinessUnavailable,
} = {}) {
  return Object.freeze({
    async getReport({ dbClient = db } = {}) {
      try {
        const [lifecycleRecord, purposeEvidenceRecord] = await Promise.all([
          loadLifecycleRecord({ db: dbClient }),
          loadPurposeEvidenceRecord({ db: dbClient }),
        ]);
        let auditState = null;
        try {
          auditState = await loadAuditState({ db: dbClient });
        } catch {
          // The source prerequisite remains safe to report when its optional
          // aggregate audit receipt is temporarily unavailable.
        }
        const report = buildReadiness({ auditState, lifecycleRecord, purposeEvidenceRecord });
        return auditReadiness(report).ok === true ? report : buildUnavailable();
      } catch {
        return buildUnavailable();
      }
    },
  });
}

export const heldOutSemanticStudyReadinessService =
  createHeldOutSemanticStudyReadinessService();
