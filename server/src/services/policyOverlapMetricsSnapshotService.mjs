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
import { createLogger } from '../utils/logger.mjs';
import { policyOverlapMetricsCollector } from './policyOverlapMetricsCollector.mjs';

const logger = createLogger('policyOverlapMetricsSnapshotService');

const DEFAULT_PERSIST_DECISION_DELTA = 25;
const DEFAULT_PERSIST_INTERVAL_MS = 5 * 60 * 1000;

function isMissingTableError(error) {
  return error?.code === '42P01';
}

function normalizeSnapshotRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id ?? null,
    session_id: row.session_id ?? null,
    session_started_at: row.session_started_at ?? null,
    snapshot_reason: row.snapshot_reason ?? null,
    decision_delta: Number(row.decision_delta) || 0,
    total_decisions: Number(row.total_decisions) || 0,
    weak_evidence_primary_count: Number(row.weak_evidence_primary_count) || 0,
    weak_evidence_overlap_count: Number(row.weak_evidence_overlap_count) || 0,
    manual_review_recommended_count: Number(row.manual_review_recommended_count) || 0,
    actions: row.actions || {},
    primary_viability_counts: row.primary_viability_counts || {},
    top_overlap_pairs: row.top_overlap_pairs || [],
    created_at: row.created_at ?? null,
  };
}

class PolicyOverlapMetricsSnapshotService {
  constructor() {
    this.state = {
      lastPersistedDecisionCount: 0,
      lastPersistedAtMs: 0,
      pendingPersist: null,
    };
  }

  resetRuntimeState() {
    this.state = {
      lastPersistedDecisionCount: 0,
      lastPersistedAtMs: 0,
      pendingPersist: null,
    };
  }

  shouldPersist(snapshot, nowMs, force = false) {
    if (!snapshot || snapshot.total_decisions <= 0) {
      return false;
    }

    if (force) {
      return true;
    }

    const decisionDelta = snapshot.total_decisions - this.state.lastPersistedDecisionCount;
    if (decisionDelta >= DEFAULT_PERSIST_DECISION_DELTA) {
      return true;
    }

    return (nowMs - this.state.lastPersistedAtMs) >= DEFAULT_PERSIST_INTERVAL_MS;
  }

  async persistSnapshot({ force = false, reason = 'periodic' } = {}) {
    if (this.state.pendingPersist) {
      return this.state.pendingPersist;
    }

    const snapshot = policyOverlapMetricsCollector.getSnapshot();
    const nowMs = Date.now();
    if (!this.shouldPersist(snapshot, nowMs, force)) {
      return { persisted: false, reason: 'threshold_not_met', snapshot };
    }

    const decisionDelta = Math.max(0, snapshot.total_decisions - this.state.lastPersistedDecisionCount);

    this.state.pendingPersist = (async () => {
      try {
        const result = await db.query(`
          INSERT INTO policy_overlap_metrics_snapshots (
            session_id,
            session_started_at,
            snapshot_reason,
            decision_delta,
            total_decisions,
            weak_evidence_primary_count,
            weak_evidence_overlap_count,
            manual_review_recommended_count,
            actions,
            primary_viability_counts,
            top_overlap_pairs
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb
          )
          RETURNING id, session_id, session_started_at, snapshot_reason, decision_delta,
                    total_decisions, weak_evidence_primary_count, weak_evidence_overlap_count,
                    manual_review_recommended_count, actions, primary_viability_counts,
                    top_overlap_pairs, created_at
        `, [
          snapshot.session_id,
          snapshot.session_started_at,
          reason,
          decisionDelta,
          snapshot.total_decisions,
          snapshot.weak_evidence_primary_count,
          snapshot.weak_evidence_overlap_count,
          snapshot.manual_review_recommended_count,
          JSON.stringify(snapshot.actions || {}),
          JSON.stringify(snapshot.primary_viability_counts || {}),
          JSON.stringify(snapshot.top_overlap_pairs || []),
        ]);

        this.state.lastPersistedDecisionCount = snapshot.total_decisions;
        this.state.lastPersistedAtMs = nowMs;

        return {
          persisted: true,
          reason,
          snapshot: normalizeSnapshotRow(result.rows[0]),
        };
      } catch (error) {
        if (isMissingTableError(error)) {
          logger.warn('Policy overlap metrics snapshot table is unavailable; skipping persistence', {
            reason,
          });
          return { persisted: false, reason: 'table_missing', snapshot };
        }
        logger.error('Failed to persist policy overlap metrics snapshot', {
          error: error.message,
          reason,
        });
        return { persisted: false, reason: 'persist_failed', error: error.message, snapshot };
      } finally {
        this.state.pendingPersist = null;
      }
    })();

    return this.state.pendingPersist;
  }

  maybePersistSnapshot(options = {}) {
    void this.persistSnapshot(options);
  }

  async getLatestSnapshot() {
    try {
      const result = await db.query(`
        SELECT id, session_id, session_started_at, snapshot_reason, decision_delta,
               total_decisions, weak_evidence_primary_count, weak_evidence_overlap_count,
               manual_review_recommended_count, actions, primary_viability_counts,
               top_overlap_pairs, created_at
        FROM policy_overlap_metrics_snapshots
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `);

      return normalizeSnapshotRow(result.rows[0] || null);
    } catch (error) {
      if (isMissingTableError(error)) {
        logger.warn('Policy overlap metrics snapshot table is unavailable; latest snapshot read skipped');
        return null;
      }
      throw error;
    }
  }

  async listRecentSnapshots(limit = 20) {
    const normalizedLimit = Number.isInteger(Number(limit))
      ? Math.min(100, Math.max(1, Number(limit)))
      : 20;

    try {
      const result = await db.query(`
        SELECT id, session_id, session_started_at, snapshot_reason, decision_delta,
               total_decisions, weak_evidence_primary_count, weak_evidence_overlap_count,
               manual_review_recommended_count, actions, primary_viability_counts,
               top_overlap_pairs, created_at
        FROM policy_overlap_metrics_snapshots
        ORDER BY created_at DESC, id DESC
        LIMIT $1
      `, [normalizedLimit]);

      return result.rows.map((row) => normalizeSnapshotRow(row));
    } catch (error) {
      if (isMissingTableError(error)) {
        logger.warn('Policy overlap metrics snapshot table is unavailable; history read skipped');
        return [];
      }
      throw error;
    }
  }
}

export const policyOverlapMetricsSnapshotService = new PolicyOverlapMetricsSnapshotService();
