import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';

export function registerPolicyStatsRoutes(router, { db }) {
  router.get('/overview', asyncHandler(async (_req, res) => {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_policies,
        SUM(total_decisions) as total_decisions,
        AVG(accuracy_rate) as avg_accuracy,
        SUM(CASE WHEN trend = 'improving' THEN 1 ELSE 0 END) as improving_count,
        SUM(CASE WHEN trend = 'declining' THEN 1 ELSE 0 END) as declining_count,
        SUM(auto_classified) as total_auto_classified
      FROM policy_learning_stats
    `);

    const overview = result.rows[0] || {};
    const totalDecisions = Number(overview.total_decisions) || 0;
    const totalAutoClassified = Number(overview.total_auto_classified) || 0;
    overview.total_decisions = totalDecisions;
    overview.total_auto_classified = totalAutoClassified;
    overview.auto_rate = totalDecisions > 0 && totalAutoClassified > 0
      ? totalAutoClassified / totalDecisions
      : 0;

    return sendData(res, overview);
  }));

  router.get('/policies/:id', asyncHandler(async (req, res) => {
    const policyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(policyId) || !Number.isInteger(policyId) || policyId <= 0) {
      throw new ValidationError('Invalid policy ID');
    }

    const stats = await db.query(`
      SELECT * FROM policy_learning_stats WHERE policy_id = $1
    `, [policyId]);

    if (stats.rows.length === 0) {
      throw new NotFoundError('Policy stats not found');
    }

    const timeSeries = await db.query(`
      SELECT 
        DATE(prompted_at) as date,
        COUNT(*) as decisions,
        COUNT(*) FILTER (WHERE was_correction = false) as correct,
        COUNT(*) FILTER (WHERE was_correction = true) as corrections,
        COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') as auto_classified,
        COUNT(*) FILTER (WHERE prompt_type IN ('prompt_confirm', 'prompt_select')) as prompted
      FROM policy_feedback_log
      WHERE selected_policy_id = $1
      AND prompted_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(prompted_at)
      ORDER BY date
    `, [policyId]);

    const promptBreakdown = await db.query(`
      SELECT 
        prompt_type,
        COUNT(*) as count,
        AVG(CASE WHEN was_correction THEN 0 ELSE 1 END) as accuracy
      FROM policy_feedback_log
      WHERE selected_policy_id = $1
      AND prompted_at >= NOW() - INTERVAL '30 days'
      GROUP BY prompt_type
    `, [policyId]);

    return sendData(res, {
      ...stats.rows[0],
      time_series: timeSeries.rows,
      prompt_breakdown: promptBreakdown.rows,
    });
  }));

  router.get('/policies/:id/compare', asyncHandler(async (req, res) => {
    const policyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(policyId) || !Number.isInteger(policyId) || policyId <= 0) {
      throw new ValidationError('Invalid policy ID');
    }

    const comparison = await db.query(`
      SELECT 
        'last_7_days' as period,
        COUNT(*) as decisions,
        AVG(CASE WHEN was_correction THEN 0 ELSE 1 END) as accuracy,
        COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') * 100.0 / NULLIF(COUNT(*), 0) as auto_rate
      FROM policy_feedback_log
      WHERE selected_policy_id = $1
      AND prompted_at >= NOW() - INTERVAL '7 days'

      UNION ALL

      SELECT 
        'previous_7_days' as period,
        COUNT(*) as decisions,
        AVG(CASE WHEN was_correction THEN 0 ELSE 1 END) as accuracy,
        COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') * 100.0 / NULLIF(COUNT(*), 0) as auto_rate
      FROM policy_feedback_log
      WHERE selected_policy_id = $1
      AND prompted_at >= NOW() - INTERVAL '14 days'
      AND prompted_at < NOW() - INTERVAL '7 days'
    `, [policyId]);

    return sendData(res, comparison.rows);
  }));

  router.get('/policies', asyncHandler(async (_req, res) => {
    const result = await db.query(`
      SELECT 
        lp.id,
        lp.name,
        lp.library_id,
        l.name as library_name,
        pls.total_decisions,
        pls.accuracy_rate,
        pls.auto_accuracy_rate,
        pls.auto_classified,
        pls.user_corrections,
        pls.last_7_days_accuracy,
        pls.last_30_days_accuracy,
        pls.trend,
        pls.last_decision_at,
        pls.last_correction_at
      FROM library_policies lp
      LEFT JOIN libraries l ON lp.library_id = l.id
      LEFT JOIN policy_learning_stats pls ON lp.id = pls.policy_id
      WHERE lp.enabled = true
      ORDER BY lp.priority DESC, lp.name
    `);

    return sendData(res, result.rows);
  }));
}
