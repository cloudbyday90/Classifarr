/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCandidateBoundVerificationDriftReport,
} from '../services/classificationCandidateBoundVerificationDriftGuard.mjs';

const range = {
  previousStart: new Date('2026-08-01T00:00:00.000Z'),
  currentStart: new Date('2026-08-08T00:00:00.000Z'),
  currentEnd: new Date('2026-08-15T00:00:00.000Z'),
  windowDays: 7,
};

describe('classificationCandidateBoundVerificationDriftGuard', () => {
  test('identifies a material abstention increase only with comparable samples', () => {
    const report = buildCandidateBoundVerificationDriftReport({
      ...range,
      rows: [
        { observedOn: '2026-08-02', statusId: 'confirmed', outcomeCount: 20 },
        { observedOn: '2026-08-09', statusId: 'confirmed', outcomeCount: 17 },
        { observedOn: '2026-08-09', statusId: 'abstained', outcomeCount: 3 },
      ],
    });

    expect(report.current.totalOutcomes).toBe(20);
    expect(report.previous.totalOutcomes).toBe(20);
    expect(report.driftGuard.statusId).toBe('elevated');
    expect(report.driftGuard.signals.find(signal => signal.statusId === 'abstained'))
      .toMatchObject({
        status: 'elevated',
        currentCount: 3,
        previousCount: 0,
        currentRatePercent: 15,
        rateChangePercentagePoints: 15,
      });
  });

  test('reports insufficient data without promoting a small-sample change to drift', () => {
    const report = buildCandidateBoundVerificationDriftReport({
      ...range,
      rows: [
        { observedOn: '2026-08-02', statusId: 'confirmed', outcomeCount: 1 },
        { observedOn: '2026-08-09', statusId: 'abstained', outcomeCount: 4 },
      ],
    });

    expect(report.driftGuard).toMatchObject({
      statusId: 'insufficient_data',
      comparable: false,
    });
    expect(report.driftGuard.signals.every(signal => signal.status === 'insufficient_data'))
      .toBe(true);
  });

  test('drops non-metric fields and refuses non-adjacent windows', () => {
    const report = buildCandidateBoundVerificationDriftReport({
      ...range,
      rows: [{
        observedOn: '2026-08-09',
        statusId: 'confirmed',
        outcomeCount: 1,
        title: 'Private item title',
        providerId: 'provider',
        rawResponse: 'Private provider content',
      }],
    });

    expect(JSON.stringify(report)).not.toContain('Private');
    expect(() => buildCandidateBoundVerificationDriftReport({
      ...range,
      currentStart: range.previousStart,
    })).toThrow('Adjacent aggregate comparison windows');
  });
});
