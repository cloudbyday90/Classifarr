/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  buildHistoricRouteSafetyRefreshInventoryReport,
  loadHistoricRouteSafetyRefreshInventoryRows,
  PolicyRuntimeHistoricRouteSafetyRefreshInventoryService,
} from '../../services/policyRuntimeHistoricRouteSafetyRefreshInventory.mjs';
import {
  normalizePolicyRuntimeQuestion,
} from '../../services/policyRuntimeQuestionNormalizer.mjs';

function normalizedQuestion() {
  return normalizePolicyRuntimeQuestion({
    metadata: { media_type: 'movie' },
    libraries: [{ id: 8, name: 'Movies', media_type: 'movie', is_active: true }],
    policyResult: {
      action: 'auto_classify',
      ranked: [{
        library_id: 8,
        score: 90,
        prompt_threshold: 60,
        auto_classify_threshold: 85,
      }],
    },
  });
}

function pendingRow({
  id = 42,
  method = 'signal_calculation',
  routeSafety = null,
  confidence = 90,
  secret = null,
} = {}) {
  const policyResult = {
    action: 'auto_classify',
    thresholds: { prompt: 60, auto_classify: 85 },
    ranked: [{
      library_id: 8,
      score: 90,
      prompt_threshold: 60,
      auto_classify_threshold: 85,
    }],
  };

  return {
    id,
    status: 'awaiting_decision',
    title: 'Historical Example',
    year: 2026,
    media_type: 'movie',
    confidence,
    method,
    policy_question: JSON.stringify(normalizedQuestion()),
    metadata: JSON.stringify({
      policyResult,
      ...(routeSafety ? { classification_details: { route_safety: routeSafety } } : {}),
      ...(secret ? { internal_note: secret } : {}),
    }),
  };
}

function createDatabase(rows = []) {
  const query = jest.fn(async (sql) => {
    if (sql.startsWith('SET TRANSACTION')) return { rows: [] };
    if (sql.includes('FROM classification_history AS ch')) return { rows };

    throw new Error(`Unexpected query: ${sql}`);
  });

  return {
    query,
    db: {
      withTransaction: jest.fn(async work => work({ query })),
    },
  };
}

describe('PolicyRuntimeHistoricRouteSafetyRefreshInventoryService', () => {
  test('returns a frozen, bounded, read-only retry plan for only affected historic decisions', async () => {
    const secret = 'must not cross the operator inventory boundary';
    const { db, query } = createDatabase([
      pendingRow({ id: 42, secret }),
      pendingRow({
        id: 43,
        method: 'ai_verified',
        routeSafety: {
          version: 'classification.route_safety.v1',
          primary_gate: {
            id: 'ai_advisory_cannot_route',
            label: 'AI advisory review required',
            message: 'AI-derived output is advisory and cannot route.',
          },
          blocking_gates: [{
            id: 'ai_advisory_cannot_route',
            label: 'AI advisory review required',
            message: 'AI-derived output is advisory and cannot route.',
          }],
        },
      }),
    ]);
    const service = new PolicyRuntimeHistoricRouteSafetyRefreshInventoryService({
      db,
      now: '2026-08-10T12:00:00.000Z',
    });

    const report = await service.run({ limit: 25 });

    expect(report).toMatchObject({
      mode: 'read_only',
      generatedAt: '2026-08-10T12:00:00.000Z',
      records: [{
        classificationId: 42,
        candidateItem: {
          classification_id: 42,
          title: 'Historical Example',
          year: 2026,
          media_type: 'movie',
        },
        reasonId: 'historical_route_safety_details_unavailable',
        retry: {
          actionId: 'retry_classification',
          execution: 'separate_authorized_command_required',
        },
      }],
      operatorRetryPlan: {
        actionId: 'retry_classification',
        execution: 'not_executed',
        classificationIds: [42],
        requiresSeparateAuthorization: true,
      },
      sideEffects: {
        classificationRowsMutated: false,
        retryCommandsExecuted: false,
        routesExecuted: false,
        learningWritten: false,
      },
      validation: { ok: true },
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.records[0])).toBe(true);
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(query.mock.calls.map(([sql]) => sql.trim().split(/\s+/, 1)[0]))
      .toEqual(['SET', 'SELECT']);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2'), [
      null,
      26,
    ]);
  });

  test('uses a keyset cursor and exposes a next cursor without loading an unbounded page', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [pendingRow({ id: 41 }), pendingRow({ id: 42 })],
    });

    const inventory = await loadHistoricRouteSafetyRefreshInventoryRows(
      { query },
      { cursor: 40, limit: 1 },
    );

    expect(inventory).toMatchObject({
      cursor: 40,
      limit: 1,
      hasNextPage: true,
      nextCursor: 41,
    });
    expect(inventory.rows).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ch.id > $1::bigint'), [
      40,
      2,
    ]);
  });

  test('caps direct report construction and never treats a plan as execution', () => {
    const report = buildHistoricRouteSafetyRefreshInventoryReport({
      rows: Array.from({ length: 51 }, (_, index) => pendingRow({ id: index + 1 })),
      limit: 99,
      hasNextPage: true,
      nextCursor: 50,
      now: '2026-08-10T12:00:00.000Z',
    });

    expect(report.records).toHaveLength(50);
    expect(report.pagination).toEqual({
      cursor: null,
      limit: 50,
      hasNextPage: true,
      nextCursor: 50,
    });
    expect(report.operatorRetryPlan.classificationIds).toHaveLength(50);
    expect(report.operatorRetryPlan.execution).toBe('not_executed');
    expect(report.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
  });

  test('does not mistake a safe item title for leaked persisted fields', () => {
    const row = pendingRow({ id: 7 });
    row.title = 'Metadata Policy Question';

    const report = buildHistoricRouteSafetyRefreshInventoryReport({ rows: [row] });

    expect(report.records[0].candidateItem.title).toBe('Metadata Policy Question');
    expect(report.validation).toEqual({ ok: true, issueCount: 0, issues: [] });
  });
});
