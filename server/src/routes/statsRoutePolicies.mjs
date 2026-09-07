import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { NotFoundError } from '../utils/appError.mjs';
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import { requireValidId } from './routeHelpers.mjs';
import { policyOverlapMetricsCollector } from '../services/policyOverlapMetricsCollector.mjs';
import { policyOverlapMetricsSnapshotService } from '../services/policyOverlapMetricsSnapshotService.mjs';
import { readEvidenceCoverage } from '../services/evidenceCoverageService.mjs';

export function registerPolicyStatsRoutes(router, { db }) {
  router.get('/overview', asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_policies,
        SUM(total_decisions) as total_decisions,
        SUM(evaluated_decisions) as evaluated_decisions,
        SUM(unevaluated_decisions) as unevaluated_decisions,
        SUM(evaluated_decisions)::real / NULLIF(SUM(total_decisions), 0) as evaluation_coverage,
        AVG(accuracy_rate) as avg_accuracy,
        SUM(CASE WHEN trend = 'improving' THEN 1 ELSE 0 END) as improving_count,
        SUM(CASE WHEN trend = 'declining' THEN 1 ELSE 0 END) as declining_count,
        SUM(auto_classified) as total_auto_classified
      FROM policy_feedback_learning_stats
    `);

    const overview = result.rows[0] || {};
    const totalDecisions = Number(overview.total_decisions) || 0;
    const totalAutoClassified = Number(overview.total_auto_classified) || 0;
    overview.total_decisions = totalDecisions;
    overview.evaluated_decisions = Number(overview.evaluated_decisions) || 0;
    overview.unevaluated_decisions = Number(overview.unevaluated_decisions) || 0;
    overview.total_auto_classified = totalAutoClassified;
    overview.auto_rate = totalDecisions > 0 && totalAutoClassified > 0
      ? totalAutoClassified / totalDecisions
      : 0;
    overview.policy_overlap_metrics = policyOverlapMetricsCollector.getSnapshot();
    overview.policy_overlap_metrics_latest_snapshot = await policyOverlapMetricsSnapshotService.getLatestSnapshot();
    overview.evidence_coverage = await readEvidenceCoverage(db);

    return sendData(res, overview);
  }));

  router.get('/policies/overlap-history', asyncHandler(async (req, res) => {
    const parsedLimit = parseIntParam(req.query.limit, null, 1);
    const limit = parsedLimit !== null ? parsedLimit : 20;

    return sendData(res, await policyOverlapMetricsSnapshotService.listRecentSnapshots(limit));
  }));

  router.get('/policies/:id', asyncHandler(async (req, res) => {
    const policyId = requireValidId(req.params.id, 'policy ID');

    const stats = await db.query(`
      SELECT * FROM policy_feedback_learning_stats WHERE policy_id = $1
    `, [policyId]);

    if (stats.rows.length === 0) {
      throw new NotFoundError('Policy stats not found');
    }

    const timeSeries = await db.query(`
      SELECT 
        DATE(prompted_at) as date,
        COUNT(*) as decisions,
        COUNT(evaluation_correct) as evaluated_decisions,
        COUNT(*) FILTER (WHERE evaluation_correct IS NULL) as unevaluated_decisions,
        COUNT(evaluation_correct)::real / NULLIF(COUNT(*), 0) as evaluation_coverage,
        COUNT(*) FILTER (WHERE evaluation_correct IS TRUE) as correct,
        COUNT(*) FILTER (WHERE evaluation_correct IS FALSE) as corrections,
        COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') as auto_classified,
        COUNT(*) FILTER (WHERE prompt_type IN ('prompt_confirm', 'prompt_select')) as prompted
      FROM policy_feedback_evaluation
      WHERE selected_policy_id = $1
      AND prompted_at >= NOW() - INTERVAL '30 days'
      AND prompted_at <= NOW()
      GROUP BY DATE(prompted_at)
      ORDER BY date
    `, [policyId]);

    const promptBreakdown = await db.query(`
      SELECT 
        prompt_type,
        COUNT(*) as count,
        COUNT(evaluation_correct) as evaluated_decisions,
        COUNT(*) FILTER (WHERE evaluation_correct IS NULL) as unevaluated_decisions,
        COUNT(evaluation_correct)::real / NULLIF(COUNT(*), 0) as evaluation_coverage,
        AVG(evaluation_correct::integer) as accuracy
      FROM policy_feedback_evaluation
      WHERE selected_policy_id = $1
      AND prompted_at >= NOW() - INTERVAL '30 days'
      AND prompted_at <= NOW()
      GROUP BY prompt_type
    `, [policyId]);

    return sendData(res, {
      ...stats.rows[0],
      time_series: timeSeries.rows,
      prompt_breakdown: promptBreakdown.rows,
    });
  }));

  router.get('/policies/:id/compare', asyncHandler(async (req, res) => {
    const policyId = requireValidId(req.params.id, 'policy ID');

    const comparison = await db.query(`
      SELECT 
        'last_7_days' as period,
        COUNT(*) as decisions,
        COUNT(evaluation_correct) as evaluated_decisions,
        COUNT(*) FILTER (WHERE evaluation_correct IS NULL) as unevaluated_decisions,
        COUNT(evaluation_correct)::real / NULLIF(COUNT(*), 0) as evaluation_coverage,
        AVG(evaluation_correct::integer) as accuracy,
        COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') * 100.0 / NULLIF(COUNT(*), 0) as auto_rate
      FROM policy_feedback_evaluation
      WHERE selected_policy_id = $1
      AND prompted_at >= NOW() - INTERVAL '7 days'
      AND prompted_at <= NOW()

      UNION ALL

      SELECT 
        'previous_7_days' as period,
        COUNT(*) as decisions,
        COUNT(evaluation_correct) as evaluated_decisions,
        COUNT(*) FILTER (WHERE evaluation_correct IS NULL) as unevaluated_decisions,
        COUNT(evaluation_correct)::real / NULLIF(COUNT(*), 0) as evaluation_coverage,
        AVG(evaluation_correct::integer) as accuracy,
        COUNT(*) FILTER (WHERE prompt_type = 'auto_classify') * 100.0 / NULLIF(COUNT(*), 0) as auto_rate
      FROM policy_feedback_evaluation
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
        pls.evaluated_decisions,
        pls.unevaluated_decisions,
        pls.evaluation_coverage,
        pls.evaluated_auto_classified,
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
      LEFT JOIN policy_feedback_learning_stats pls ON lp.id = pls.policy_id
      WHERE lp.enabled = true
      ORDER BY lp.priority DESC, lp.name
    `);

    return sendData(res, result.rows);
  }));
}
