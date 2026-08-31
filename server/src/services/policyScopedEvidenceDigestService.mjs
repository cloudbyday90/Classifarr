/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as defaultDb from '../config/database.mjs';
import {
  buildPolicyScopedEvidenceDigest,
  buildPolicyScopedEvidenceDigestUnavailable,
  POLICY_SCOPED_EVIDENCE_HISTORY_WINDOW_DAYS,
} from './policyScopedEvidenceDigestContract.mjs';
import {
  loadPolicyScopedEvidenceDigestContext,
} from './policyScopedEvidenceDigestPersistence.mjs';

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function getHistorySince(now) {
  const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp - (POLICY_SCOPED_EVIDENCE_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000));
}

export class PolicyScopedEvidenceDigestService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    loadContext = loadPolicyScopedEvidenceDigestContext,
    buildDigest = buildPolicyScopedEvidenceDigest,
  } = {}) {
    this.db = db;
    this.now = now;
    this.loadContext = loadContext;
    this.buildDigest = buildDigest;
  }

  async getDigest({ dbClient = this.db, policyId, now = this.now() } = {}) {
    const normalizedPolicyId = normalizePositiveInteger(policyId);
    const historySince = getHistorySince(now);
    if (!normalizedPolicyId || !historySince || typeof dbClient?.query !== 'function') {
      return buildPolicyScopedEvidenceDigestUnavailable({ policyId: normalizedPolicyId });
    }

    try {
      const context = await this.loadContext({
        db: dbClient,
        policyId: normalizedPolicyId,
        since: historySince,
      });
      if (!context) return null;

      return this.buildDigest({
        ...context,
        evaluatedAt: now,
        historyWindowDays: POLICY_SCOPED_EVIDENCE_HISTORY_WINDOW_DAYS,
      });
    } catch {
      return buildPolicyScopedEvidenceDigestUnavailable({ policyId: normalizedPolicyId });
    }
  }
}

export const policyScopedEvidenceDigestService = new PolicyScopedEvidenceDigestService();
