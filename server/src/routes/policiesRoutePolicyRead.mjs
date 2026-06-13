import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { NotFoundError } from '../utils/appError.mjs';
import { buildPolicyConfigurationView } from '../services/policyConfigurationView.mjs';
import { buildPolicyIntentContract } from '../services/policyIntentContract.mjs';
import { annotatePresetAttachment } from './policiesRouteHelpers.mjs';

export function registerPolicyReadRoutes(router, { db, normalizeSignalConfig, describePresetRuntimeSemantics }) {
  function annotate(preset) {
    return annotatePresetAttachment(preset, normalizeSignalConfig, describePresetRuntimeSemantics);
  }

  router.get('/', asyncHandler(async (_req, res) => {
    const result = await db.query(`
      SELECT 
        lp.*,
        l.name as library_name,
        l.media_type as library_media_type,
        (SELECT COUNT(*)::int FROM policy_presets WHERE policy_id = lp.id) as preset_count
      FROM library_policies lp
      JOIN libraries l ON lp.library_id = l.id
      ORDER BY l.name, lp.priority DESC, lp.sort_order ASC
    `);

    return sendData(res, result.rows);
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const policyResult = await db.query(`
      SELECT 
        lp.*,
        l.name as library_name,
        l.media_type as library_media_type
      FROM library_policies lp
      JOIN libraries l ON lp.library_id = l.id
      WHERE lp.id = $1
    `, [id]);

    if (policyResult.rows.length === 0) {
      throw new NotFoundError('Policy not found');
    }

    const policy = policyResult.rows[0];

    const presetsResult = await db.query(`
      SELECT 
        cp.*,
        pp.weight,
        pp.custom_signals
      FROM policy_presets pp
      JOIN content_presets cp ON pp.preset_id = cp.id
      WHERE pp.policy_id = $1
      ORDER BY pp.sort_order, cp.display_order, cp.name
    `, [id]);

    policy.presets = presetsResult.rows.map(annotate);
    policy.configuration_view = buildPolicyConfigurationView(policy);
    policy.policy_intent_contract = buildPolicyIntentContract(policy, {
      configurationView: policy.configuration_view,
    });

    return sendData(res, policy);
  }));
}
