import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError } from '../utils/appError.mjs';
import {
  buildPolicyImpactPreviewMigrationVerifier,
} from '../services/policyImpactPreviewMigrationVerifier.mjs';
import {
  buildPolicyIntentWritePreflight,
  summarizePolicyIntentRequestValidationError,
} from '../services/policyIntentRequestValidator.mjs';
import {
  annotatePresetAttachment,
  normalizePresetAttachmentInputs,
} from './policiesRouteHelpers.mjs';

export function registerPolicyMigrationVerifierRoutes(router, {
  db,
  normalizeSignalConfig,
  describePresetRuntimeSemantics,
}) {
  function annotate(preset) {
    return annotatePresetAttachment(preset, normalizeSignalConfig, describePresetRuntimeSemantics);
  }

  function validatePreviewInput(payload) {
    try {
      return buildPolicyIntentWritePreflight(payload);
    } catch (error) {
      const issueSummary = summarizePolicyIntentRequestValidationError(error);
      if (issueSummary) {
        throw new ValidationError(`Invalid policy intent draft: ${issueSummary}`, {
          code: 'POLICY_INTENT_REQUEST_INVALID',
        });
      }
      throw error;
    }
  }

  async function buildPreviewPolicyFromPayload(payload = {}) {
    const normalizedPresets = normalizePresetAttachmentInputs(payload.presets);
    const invalidPreset = normalizedPresets.find(preset => {
      const presetId = Number(preset.preset_id);
      return !Number.isInteger(presetId) || presetId <= 0;
    });
    if (invalidPreset) {
      throw new ValidationError('All preview presets must include a valid preset_id');
    }

    const presetIds = Array.from(new Set(
      normalizedPresets.map(preset => Number(preset.preset_id))
    ));
    const presetRows = presetIds.length > 0
      ? await db.query(`
        SELECT *
        FROM content_presets
        WHERE id = ANY($1::int[])
      `, [presetIds])
      : { rows: [] };
    const presetsById = new Map((presetRows.rows || []).map(preset => [Number(preset.id), preset]));
    const missingPreset = normalizedPresets.find(preset => !presetsById.has(Number(preset.preset_id)));
    if (missingPreset) {
      throw new ValidationError(`Preset ${missingPreset.preset_id} was not found for migration verification`);
    }

    return {
      id: payload.id ?? null,
      library_id: payload.library_id ?? null,
      library_name: payload.library_name ?? null,
      library_media_type: payload.library_media_type ?? null,
      presets: normalizedPresets.map(preset => annotate({
        ...presetsById.get(Number(preset.preset_id)),
        weight: preset.weight,
        custom_signals: preset.customSignals,
      })),
    };
  }

  router.post('/migration-verifier/impact-preview', asyncHandler(async (req, res) => {
    validatePreviewInput(req.body);
    const previewPolicy = await buildPreviewPolicyFromPayload(req.body);
    const preview = buildPolicyImpactPreviewMigrationVerifier({
      policy: previewPolicy,
      payload: req.body,
    });

    return sendData(res, preview);
  }));

}
