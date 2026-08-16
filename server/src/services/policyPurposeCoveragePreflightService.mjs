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
  buildPolicyPurposeCoveragePreflight,
  buildPolicyPurposeCoveragePreflightCandidate,
} from './policyPurposeCoveragePreflightContract.mjs';
import {
  loadPolicyPurposeCoveragePreflightContext,
  loadPolicyPurposeCoveragePreflightOverlap,
} from './policyPurposeCoveragePreflightPersistence.mjs';

export class PolicyPurposeCoveragePreflightNotFoundError extends Error {
  constructor() {
    super('Policy not found for purpose coverage preflight.');
    this.name = 'PolicyPurposeCoveragePreflightNotFoundError';
    this.code = 'POLICY_PURPOSE_COVERAGE_PREFLIGHT_POLICY_NOT_FOUND';
  }
}

export class PolicyPurposeCoveragePreflightService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    buildCandidate = buildPolicyPurposeCoveragePreflightCandidate,
    loadContext = loadPolicyPurposeCoveragePreflightContext,
    loadOverlap = loadPolicyPurposeCoveragePreflightOverlap,
    buildPreflight = buildPolicyPurposeCoveragePreflight,
  } = {}) {
    this.db = db;
    this.now = now;
    this.buildCandidate = buildCandidate;
    this.loadContext = loadContext;
    this.loadOverlap = loadOverlap;
    this.buildPreflight = buildPreflight;
  }

  async preflight({ dbClient = this.db, policyId, draft, now = this.now() } = {}) {
    const candidate = this.buildCandidate(draft);
    const context = await this.loadContext({ db: dbClient, policyId });
    if (!context) throw new PolicyPurposeCoveragePreflightNotFoundError();

    const overlap = await this.loadOverlap({
      db: dbClient,
      candidateTerms: candidate.terms,
      libraryId: context.library_id,
      mediaType: context.library_media_type,
    });

    return this.buildPreflight({
      context,
      candidate,
      overlap,
      evaluatedAt: now,
    });
  }
}

export const policyPurposeCoveragePreflightService = new PolicyPurposeCoveragePreflightService();
