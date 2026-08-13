/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import {
  buildCandidateBoundVerificationRemediationReadiness,
} from './classificationCandidateBoundVerificationRemediationReadiness.mjs';
import {
  createCandidateBoundVerificationMetricsService,
} from './classificationCandidateBoundVerificationMetricsService.mjs';
import {
  loadCandidateBoundVerificationPolicyReadiness,
  loadCandidateBoundVerificationProviderConfiguration,
} from './classificationCandidateBoundVerificationRemediationReadinessRepository.mjs';

export function createCandidateBoundVerificationRemediationReadinessService({
  database = db,
  createMetricsService = createCandidateBoundVerificationMetricsService,
  loadProviderConfiguration = loadCandidateBoundVerificationProviderConfiguration,
  loadPolicyReadiness = loadCandidateBoundVerificationPolicyReadiness,
  buildReport = buildCandidateBoundVerificationRemediationReadiness,
} = {}) {
  const metricsService = createMetricsService({ database });

  return Object.freeze({
    async getReport({ windowDays } = {}) {
      const [metrics, providerConfiguration, policyReadinessRows] = await Promise.all([
        metricsService.getSummary({ windowDays }),
        loadProviderConfiguration(database),
        loadPolicyReadiness(database),
      ]);

      return buildReport({
        metrics,
        providerConfiguration,
        policyReadinessRows,
      });
    },
  });
}
