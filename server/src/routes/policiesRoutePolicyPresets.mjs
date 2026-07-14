import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';
import {
  sanitizeCustomSignals,
  normalizePresetAttachmentWeight,
  validatePresetAttachmentWeight,
  annotatePresetAttachment,
} from './policiesRouteHelpers.mjs';
import {
  POLICY_LEGACY_WRITE_OPERATION_IDS,
} from '../services/policyLegacyWriteBoundary.mjs';
import {
  assertLegacyPolicyWriteAllowed,
  lockPolicyAuthorityForWrite,
} from '../services/policyLegacyWriteGuard.mjs';

export function registerPolicyPresetRoutes(router, { db, normalizeSignalConfig, describePresetRuntimeSemantics }) {
  function annotate(preset) {
    return annotatePresetAttachment(preset, normalizeSignalConfig, describePresetRuntimeSemantics);
  }

  router.get('/:id/presets', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        cp.*,
        pp.weight,
        pp.custom_signals
      FROM policy_presets pp
      JOIN content_presets cp ON pp.preset_id = cp.id
      WHERE pp.policy_id = $1
      ORDER BY pp.sort_order, cp.display_order, cp.name
    `, [id]);

    return sendData(res, result.rows.map(annotate));
  }));

  router.post('/:id/presets', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { preset_id } = req.body;
    const weight = normalizePresetAttachmentWeight(req.body.weight);

    if (!preset_id) {
      throw new ValidationError('preset_id is required');
    }
    const presetWeightError = validatePresetAttachmentWeight(weight, 'weight');
    if (presetWeightError) {
      throw new ValidationError(presetWeightError);
    }

    const customSignals = sanitizeCustomSignals(req.body.customSignals ?? req.body.custom_signals);
    const preset = await db.withTransaction(async (client) => {
      const policy = await lockPolicyAuthorityForWrite({
        client,
        policyId: id,
      });
      assertLegacyPolicyWriteAllowed({
        policy,
        payload: req.body,
        operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.ATTACH_PRESET,
      });

      const existing = await client.query(
        'SELECT * FROM policy_presets WHERE policy_id = $1 AND preset_id = $2',
        [id, preset_id],
      );
      if (existing.rows.length > 0) {
        throw new ValidationError('Preset already attached to this policy');
      }

      const result = await client.query(`
        INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [id, preset_id, weight, customSignals]);
      await client.query('UPDATE library_policies SET updated_at = NOW() WHERE id = $1', [id]);
      return result.rows[0];
    });

    return sendData(res, annotate(preset), 201);
  }));

  router.delete('/:id/presets/:presetId', asyncHandler(async (req, res) => {
    const { id, presetId } = req.params;

    await db.withTransaction(async (client) => {
      const policy = await lockPolicyAuthorityForWrite({
        client,
        policyId: id,
      });
      assertLegacyPolicyWriteAllowed({
        policy,
        operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.DETACH_PRESET,
      });

      const result = await client.query(
        'DELETE FROM policy_presets WHERE policy_id = $1 AND preset_id = $2 RETURNING *',
        [id, presetId],
      );
      if (result.rows.length === 0) {
        throw new NotFoundError('Preset not attached to this policy');
      }

      await client.query('UPDATE library_policies SET updated_at = NOW() WHERE id = $1', [id]);
    });

    return sendData(res, { message: 'Preset removed successfully' });
  }));
}
