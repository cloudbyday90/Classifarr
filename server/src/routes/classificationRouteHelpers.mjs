/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export { safeParseJsonObject } from '../utils/classificationRetryPayloads.mjs';

export function safeParsePolicyQuestion(value) {
  if (!value) {
    return null;
  }
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    return null;
  }
}

export function parsePositiveIntWithBounds(value, fallback, { min = 1, max = 365 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

export function buildOutcomeRateSet({ total, linkedOutcomes, verified, corrected, resolved, retried }) {
  const perTotal = {
    linkedOutcomeRate: total > 0 ? Number((linkedOutcomes / total).toFixed(4)) : 0,
    correctedRate: total > 0 ? Number((corrected / total).toFixed(4)) : 0,
    verifiedRate: total > 0 ? Number((verified / total).toFixed(4)) : 0,
    resolvedRate: total > 0 ? Number((resolved / total).toFixed(4)) : 0,
    retriedRate: total > 0 ? Number((retried / total).toFixed(4)) : 0,
  };

  const perLinkedOutcome = {
    correctedRate: linkedOutcomes > 0 ? Number((corrected / linkedOutcomes).toFixed(4)) : 0,
    verifiedRate: linkedOutcomes > 0 ? Number((verified / linkedOutcomes).toFixed(4)) : 0,
    resolvedRate: linkedOutcomes > 0 ? Number((resolved / linkedOutcomes).toFixed(4)) : 0,
    retriedRate: linkedOutcomes > 0 ? Number((retried / linkedOutcomes).toFixed(4)) : 0,
  };

  return { perTotal, perLinkedOutcome };
}

export function createEmptyOutcomeTypeBreakdown() {
  return {
    verified: 0,
    corrected: 0,
    resolved: 0,
    retried: 0,
  };
}

export function createDefaultOutcomeCohorts() {
  const createCohort = (cohort) => ({
    cohort,
    total: 0,
    linkedOutcomes: 0,
    verified: 0,
    corrected: 0,
    resolved: 0,
    retried: 0,
    multiStepOutcomes: 0,
    firstOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
    latestOutcomeBreakdown: createEmptyOutcomeTypeBreakdown(),
    perTotal: {
      linkedOutcomeRate: 0,
      correctedRate: 0,
      verifiedRate: 0,
      resolvedRate: 0,
      retriedRate: 0,
    },
    perLinkedOutcome: {
      correctedRate: 0,
      verifiedRate: 0,
      resolvedRate: 0,
      retriedRate: 0,
    },
    linkedOutcomeRate: 0,
    correctedRate: 0,
    verifiedRate: 0,
    resolvedRate: 0,
    retriedRate: 0,
  });

  return {
    baseline: createCohort('baseline'),
    pass2_not_adopted: createCohort('pass2_not_adopted'),
    pass2_adopted: createCohort('pass2_adopted'),
  };
}
