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
} from './policyPurposeCoverageReviewPersistence.mjs';

export class PolicyPurposeCoverageReviewService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    loadRecords = loadPolicyPurposeCoverageReviewRecords,
    buildReview = buildPolicyPurposeCoverageReview,
  } = {}) {
    this.db = db;
    this.now = now;
    this.loadRecords = loadRecords;
    this.buildReview = buildReview;
  }

  async getReview({ dbClient = this.db, limit, now = this.now() } = {}) {
    const normalizedLimit = normalizePolicyPurposeCoverageReviewLimit(limit);
    const loadedRecords = await this.loadRecords({
      db: dbClient,
      limit: normalizedLimit + 1,
    });
    const records = Array.isArray(loadedRecords) ? loadedRecords : [];

    return this.buildReview({
      records: records.slice(0, normalizedLimit),
      evaluatedAt: now,
      limit: normalizedLimit,
      truncated: records.length > normalizedLimit,
    });
  }
}

export const policyPurposeCoverageReviewService = new PolicyPurposeCoverageReviewService();
