import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';

const ALERT_THRESHOLDS = {
  HIGH_CORRECTION_RATE_PERCENT: 20,
  PENDING_SUGGESTIONS_MIN: 5,
};

export function registerMonitoringRoutes(router, { db }) {
  router.get('/live-feed', asyncHandler(async (req, res) => {
    const defaultLimit = 20;
    const maxLimit = 100;
    const rawLimit = req.query.limit;

    let limit = defaultLimit;
    if (rawLimit !== undefined) {
      const parsed = parseInt(rawLimit, 10);
      if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
        limit = Math.min(parsed, maxLimit);
      }
    }

    const feed = await db.query(`
      WITH recent_decisions AS (
        SELECT 
          'decision' as type,
          pfl.id,
          pfl.title,
          pfl.prompted_at as created_at,
          pfl.was_correction,
          lp.name as policy_name,
          l.name as library_name
        FROM policy_feedback_log pfl
        JOIN library_policies lp ON pfl.selected_policy_id = lp.id
        JOIN libraries l ON pfl.selected_library_id = l.id
        ORDER BY pfl.prompted_at DESC
        LIMIT $1
      ),
      recent_patterns AS (
        SELECT 
          'pattern' as type,
          dp.id,
          dp.pattern_value as title,
          dp.created_at,
          false as was_correction,
          NULL as policy_name,
          l.name as library_name
        FROM discovered_patterns dp
        JOIN libraries l ON dp.library_id = l.id
        WHERE dp.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY dp.created_at DESC
        LIMIT $1
      ),
      recent_suggestions AS (
        SELECT 
          'suggestion' as type,
          pts.id,
          pts.suggestion_type as title,
          pts.created_at,
          false as was_correction,
          lp.name as policy_name,
          NULL as library_name
        FROM policy_tuning_suggestions pts
        JOIN library_policies lp ON pts.policy_id = lp.id
        WHERE pts.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY pts.created_at DESC
        LIMIT $1
      )
      SELECT * FROM recent_decisions
      UNION ALL
      SELECT * FROM recent_patterns
      UNION ALL
      SELECT * FROM recent_suggestions
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    return sendData(res, feed.rows);
  }));

  router.get('/alerts', asyncHandler(async (_req, res) => {
    const alerts = [];

    try {
      const declining = await db.query(`
        SELECT lp.id, lp.name, pls.accuracy_rate, pls.last_7_days_accuracy
        FROM policy_learning_stats pls
        JOIN library_policies lp ON pls.policy_id = lp.id
        WHERE pls.trend = 'declining'
        AND pls.accuracy_rate < 0.8
      `);

      for (const policy of declining.rows) {
        alerts.push({
          type: 'declining_accuracy',
          severity: 'warning',
          policy_id: policy.id,
          policy_name: policy.name,
          message: `${policy.name} accuracy dropped to ${(policy.accuracy_rate * 100).toFixed(1)}%`,
        });
      }
    } catch (_e) { /* graceful fallback */ }

    try {
      const highCorrections = await db.query(`
        SELECT lp.id, lp.name, 
          COUNT(*) FILTER (WHERE was_correction) * 100.0 / NULLIF(COUNT(*), 0) as correction_rate
        FROM policy_feedback_log pfl
        JOIN library_policies lp ON pfl.selected_policy_id = lp.id
        WHERE pfl.prompted_at >= NOW() - INTERVAL '7 days'
        GROUP BY lp.id, lp.name
        HAVING COUNT(*) FILTER (WHERE was_correction) * 100.0 / NULLIF(COUNT(*), 0) > $1
      `, [ALERT_THRESHOLDS.HIGH_CORRECTION_RATE_PERCENT]);

      for (const policy of highCorrections.rows) {
        const correctionRate = policy.correction_rate || 0;
        alerts.push({
          type: 'high_corrections',
          severity: 'warning',
          policy_id: policy.id,
          policy_name: policy.name,
          message: `${policy.name} has ${correctionRate.toFixed(1)}% correction rate`,
        });
      }
    } catch (_e) { /* graceful fallback */ }

    try {
      const pendingSuggestions = await db.query(`
        SELECT lp.id, lp.name, COUNT(*) as pending_count
        FROM policy_tuning_suggestions pts
        JOIN library_policies lp ON pts.policy_id = lp.id
        WHERE pts.status = 'pending'
        GROUP BY lp.id, lp.name
        HAVING COUNT(*) >= $1
      `, [ALERT_THRESHOLDS.PENDING_SUGGESTIONS_MIN]);

      for (const policy of pendingSuggestions.rows) {
        alerts.push({
          type: 'pending_suggestions',
          severity: 'info',
          policy_id: policy.id,
          policy_name: policy.name,
          message: `${policy.name} has ${policy.pending_count} pending tuning suggestions`,
        });
      }
    } catch (_e) { /* graceful fallback */ }

    return sendData(res, alerts);
  }));
}
