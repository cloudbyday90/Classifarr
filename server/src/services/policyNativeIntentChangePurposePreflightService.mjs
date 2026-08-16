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
  buildPolicyNativeIntentChangePurposePreflight,
  buildPolicyNativeIntentChangePurposePreflightCandidate,
} from './policyNativeIntentChangePurposePreflightContract.mjs';
import {
  loadPolicyNativeIntentChangePurposePreflightContext,
  loadPolicyNativeIntentChangePurposePreflightOverlap,
} from './policyNativeIntentChangePurposePreflightPersistence.mjs';

export class PolicyNativeIntentChangePurposePreflightNotFoundError extends Error {
  constructor() {
    super('Policy not found for native purpose change preflight.');
    this.name = 'PolicyNativeIntentChangePurposePreflightNotFoundError';
    this.code = 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_POLICY_NOT_FOUND';
  }
}

export class PolicyNativeIntentChangePurposePreflightAuthorityError extends Error {
  constructor() {
    super('The current native policy authority cannot accept a purpose change preflight.');
    this.name = 'PolicyNativeIntentChangePurposePreflightAuthorityError';
    this.code = 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_AUTHORITY_UNAVAILABLE';
  }
}

export class PolicyNativeIntentChangePurposePreflightStaleRevisionError extends Error {
  constructor() {
    super('The native policy revision changed. Reload before requesting another purpose preflight.');
    this.name = 'PolicyNativeIntentChangePurposePreflightStaleRevisionError';
    this.code = 'POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_STALE_REVISION';
  }
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

export class PolicyNativeIntentChangePurposePreflightService {
  constructor({
    db = defaultDb,
    now = () => new Date(),
    buildCandidate = buildPolicyNativeIntentChangePurposePreflightCandidate,
    loadContext = loadPolicyNativeIntentChangePurposePreflightContext,
    loadOverlap = loadPolicyNativeIntentChangePurposePreflightOverlap,
    buildPreflight = buildPolicyNativeIntentChangePurposePreflight,
  } = {}) {
    this.db = db;
    this.now = now;
    this.buildCandidate = buildCandidate;
    this.loadContext = loadContext;
    this.loadOverlap = loadOverlap;
    this.buildPreflight = buildPreflight;
  }

  async preflight({
    dbClient = this.db,
    policyId,
    expectedRevision,
    changeCommand,
    now = this.now(),
  } = {}) {
    const normalizedExpectedRevision = normalizePositiveInteger(expectedRevision);
    if (!normalizedExpectedRevision) {
      throw new PolicyNativeIntentChangePurposePreflightStaleRevisionError();
    }

    const candidate = this.buildCandidate(changeCommand);
    const context = await this.loadContext({ db: dbClient, policyId });
    if (!context) throw new PolicyNativeIntentChangePurposePreflightNotFoundError();
    if (context.authority?.authoritative !== true || !context.activeIntent) {
      throw new PolicyNativeIntentChangePurposePreflightAuthorityError();
    }

    const currentRevision = normalizePositiveInteger(context.activeIntent.intent_version);
    if (!currentRevision || currentRevision !== normalizedExpectedRevision) {
      throw new PolicyNativeIntentChangePurposePreflightStaleRevisionError();
    }

    const overlap = await this.loadOverlap({
      db: dbClient,
      candidateTerms: candidate.terms,
      libraryId: context.library_id,
      mediaType: context.library_media_type,
    });

    return this.buildPreflight({
      context: { ...context, intent_version: currentRevision },
      candidate,
      overlap,
      expectedRevision: normalizedExpectedRevision,
      evaluatedAt: now,
    });
  }
}

export const policyNativeIntentChangePurposePreflightService =
  new PolicyNativeIntentChangePurposePreflightService();
