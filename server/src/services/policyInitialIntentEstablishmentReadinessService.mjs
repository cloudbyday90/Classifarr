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
  buildPolicyInitialIntentEstablishmentReadiness,
  buildReadUnavailableResult,
  normalizePositiveInteger,
} from './policyInitialIntentEstablishmentReadinessContract.mjs';
import {
  fetchPolicyInitialIntentEstablishmentReadiness,
} from './policyInitialIntentEstablishmentReadinessPersistence.mjs';

async function getPolicyInitialIntentEstablishmentReadiness({
  dbClient,
  policyId,
  now = new Date(),
} = {}) {
  const normalizedPolicyId = normalizePositiveInteger(policyId);
  if (!normalizedPolicyId) {
    return buildPolicyInitialIntentEstablishmentReadiness({ record: null, now });
  }

  if (typeof dbClient?.query !== 'function') {
    return buildReadUnavailableResult(normalizedPolicyId);
  }

  try {
    const { readiness, rules } = await fetchPolicyInitialIntentEstablishmentReadiness(
      dbClient,
      normalizedPolicyId
    );

    return buildPolicyInitialIntentEstablishmentReadiness({
      record: readiness,
      rules,
      now,
    });
  } catch {
    return buildReadUnavailableResult(normalizedPolicyId);
  }
}

export {
  getPolicyInitialIntentEstablishmentReadiness,
};
