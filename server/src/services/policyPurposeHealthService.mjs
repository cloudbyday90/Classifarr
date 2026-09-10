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
  MAX_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS,
} from './policyPurposeCoverageReviewContract.mjs';
import {
  loadPolicyPurposeCoverageReviewRecords,
} from './policyPurposeCoverageReviewPersistence.mjs';
import {
  buildPolicyPurposeHealthSummary,
} from './policyPurposeHealthContract.mjs';

/**
 * Produces the Command Center's fixed, bounded purpose-health aggregate. This
 * read intentionally avoids the detailed review, lifecycle receipt, media,
 * and profile payloads used by the maintenance view.
 */
export class PolicyPurposeHealthService {
  constructor({
    db = defaultDb,
    loadRecords = loadPolicyPurposeCoverageReviewRecords,
    buildSummary = buildPolicyPurposeHealthSummary,
    limit = MAX_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS,
  } = {}) {
    this.db = db;
    this.loadRecords = loadRecords;
    this.buildSummary = buildSummary;
    this.limit = Math.max(1, Math.min(MAX_POLICY_PURPOSE_COVERAGE_REVIEW_ROWS, Number(limit) || 1));
  }

  async getSummary({ dbClient = this.db } = {}) {
    const loadedRecords = await this.loadRecords({
      db: dbClient,
      limit: this.limit + 1,
    });
    const records = Array.isArray(loadedRecords) ? loadedRecords : [];
    return this.buildSummary({
      records: records.slice(0, this.limit),
      truncated: records.length > this.limit,
    });
  }
}

export const policyPurposeHealthService = new PolicyPurposeHealthService();
