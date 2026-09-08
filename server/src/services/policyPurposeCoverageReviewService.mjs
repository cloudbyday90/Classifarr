/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import {
  buildPolicyPurposeCoverageReview,
  normalizePolicyPurposeCoverageReviewLimit,
} from './policyPurposeCoverageReviewContract.mjs';
import {
  loadPolicyPurposeCoverageReviewRecords,
  loadPolicyPurposeCoverageStudySourceReadinessRecord,
} from './policyPurposeCoverageReviewPersistence.mjs';
import {
  DEFAULT_POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_ROWS,
} from './policyPurposeLifecycleProvenanceReceipt.mjs';
import {
  loadPolicyPurposeLifecycleProvenanceReceiptRecords,
} from './policyPurposeLifecycleProvenanceReceiptPersistence.mjs';

export class PolicyPurposeCoverageReviewService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    loadRecords = loadPolicyPurposeCoverageReviewRecords,
    loadStudySourceReadinessRecord = loadPolicyPurposeCoverageStudySourceReadinessRecord,
    loadLifecycleReceiptRecords = loadPolicyPurposeLifecycleProvenanceReceiptRecords,
    lifecycleReceiptLimit = DEFAULT_POLICY_PURPOSE_LIFECYCLE_PROVENANCE_RECEIPT_ROWS,
    buildReview = buildPolicyPurposeCoverageReview,
  } = {}) {
    this.db = db;
    this.now = now;
    this.loadRecords = loadRecords;
    this.loadStudySourceReadinessRecord = loadStudySourceReadinessRecord;
    this.loadLifecycleReceiptRecords = loadLifecycleReceiptRecords;
    this.lifecycleReceiptLimit = lifecycleReceiptLimit;
    this.buildReview = buildReview;
  }

  async getReview({ dbClient = this.db, limit, now = this.now() } = {}) {
    const normalizedLimit = normalizePolicyPurposeCoverageReviewLimit(limit);
    const lifecycleReceiptLimit = Math.max(1, Number(this.lifecycleReceiptLimit) || 1);
    const [loadedRecords, studySourceReadinessRecord, loadedLifecycleReceiptRecords] = await Promise.all([
      this.loadRecords({
        db: dbClient,
        limit: normalizedLimit + 1,
      }),
      this.loadStudySourceReadinessRecord({ db: dbClient }),
      this.loadLifecycleReceiptRecords({
        db: dbClient,
        limit: lifecycleReceiptLimit + 1,
      }),
    ]);
    const records = Array.isArray(loadedRecords) ? loadedRecords : [];
    const lifecycleReceiptRecords = Array.isArray(loadedLifecycleReceiptRecords)
      ? loadedLifecycleReceiptRecords
      : [];

    return this.buildReview({
      records: records.slice(0, normalizedLimit),
      studySourceReadinessRecord,
      lifecycleReceiptRecords: lifecycleReceiptRecords.slice(0, lifecycleReceiptLimit),
      lifecycleReceiptLimit,
      lifecycleReceiptTruncated: lifecycleReceiptRecords.length > lifecycleReceiptLimit,
      evaluatedAt: now,
      limit: normalizedLimit,
      truncated: records.length > normalizedLimit,
    });
  }
}

export const policyPurposeCoverageReviewService = new PolicyPurposeCoverageReviewService();
