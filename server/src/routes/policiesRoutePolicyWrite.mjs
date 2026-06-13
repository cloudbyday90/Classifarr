import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';
import { buildPolicyConfigurationView } from '../services/policyConfigurationView.mjs';
import { buildPolicyIntentContract } from '../services/policyIntentContract.mjs';
import {
  sanitizeCustomSignals,
  normalizePresetAttachmentInputs,
  validateWeightRange,
  validatePresetAttachmentWeights,
  validateCombinationMode,
  validatePolicyThresholdPayload,
  buildMergedWeightSet,
  validateWeightSum,
  annotatePresetAttachment,
} from './policiesRouteHelpers.mjs';

export function registerPolicyWriteRoutes(router, { db, normalizeSignalConfig, describePresetRuntimeSemantics, DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD, DEFAULT_POLICY_PROMPT_THRESHOLD, validatePolicyDecisionThresholds, validatePolicyThresholdField, logger }) {
  function annotate(preset) {
    return annotatePresetAttachment(preset, normalizeSignalConfig, describePresetRuntimeSemantics);
  }

  router.post('/', asyncHandler(async (req, res) => {
    const {
      library_id,
      name,
      description,
      enabled = true,
      priority = 5,
      sort_order = 0,
      auto_classify_threshold = DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
      prompt_threshold = DEFAULT_POLICY_PROMPT_THRESHOLD,
      require_ai_validation = true,
      trust_patterns = true,
      trust_rag = true,
      trust_history = true,
      preset_weight = 0.35,
      profile_weight = 0.25,
      pattern_weight = 0.15,
      rag_weight = 0.15,
      history_weight = 0.10,
      combination_mode = 'best_match',
      presets = [],
    } = req.body;

    if (!library_id || !name) {
      throw new ValidationError('library_id and name are required');
    }

    const thresholdValidationError = validatePolicyThresholdPayload({
      auto_classify_threshold,
      prompt_threshold,
    }, validatePolicyDecisionThresholds);
    if (thresholdValidationError) {
      throw new ValidationError(thresholdValidationError);
    }

    const normalizedAutoClassifyThreshold = Number(auto_classify_threshold);
    const normalizedPromptThreshold = Number(prompt_threshold);
    const combinationModeError = validateCombinationMode(combination_mode);
    if (combinationModeError) {
      throw new ValidationError(combinationModeError);
    }

    if (preset_weight < 0 || preset_weight > 1) {
      throw new ValidationError('preset_weight must be between 0 and 1');
    }
    if (profile_weight < 0 || profile_weight > 1) {
      throw new ValidationError('profile_weight must be between 0 and 1');
    }
    if (pattern_weight < 0 || pattern_weight > 1) {
      throw new ValidationError('pattern_weight must be between 0 and 1');
    }
    if (rag_weight < 0 || rag_weight > 1) {
      throw new ValidationError('rag_weight must be between 0 and 1');
    }
    if (history_weight < 0 || history_weight > 1) {
      throw new ValidationError('history_weight must be between 0 and 1');
    }

    const totalWeight = preset_weight + profile_weight + pattern_weight + rag_weight + history_weight;
    if (Math.abs(totalWeight - 1.0) > 0.001) {
      throw new ValidationError(`Weights must sum to 1.0 (currently ${totalWeight.toFixed(3)})`);
    }

    const normalizedPresets = normalizePresetAttachmentInputs(presets);
    const presetAttachmentWeightError = validatePresetAttachmentWeights(normalizedPresets, 'presets');
    if (presetAttachmentWeightError) {
      throw new ValidationError(presetAttachmentWeightError);
    }

    const policy = await db.withTransaction(async (client) => {
      const policyResult = await client.query(`
        INSERT INTO library_policies (
          library_id, name, description, enabled, priority, sort_order,
          auto_classify_threshold, prompt_threshold, require_ai_validation,
          trust_patterns, trust_rag, trust_history,
          preset_weight, profile_weight, pattern_weight, rag_weight, history_weight,
          combination_mode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `, [
        library_id, name, description, enabled, priority, sort_order,
        normalizedAutoClassifyThreshold, normalizedPromptThreshold, require_ai_validation,
        trust_patterns, trust_rag, trust_history,
        preset_weight, profile_weight, pattern_weight, rag_weight, history_weight,
        combination_mode,
      ]);

      const policyRow = policyResult.rows[0];

      if (normalizedPresets.length > 0) {
        for (const preset of normalizedPresets) {
          await client.query(`
            INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
            VALUES ($1, $2, $3, $4)
          `, [policyRow.id, preset.preset_id, preset.weight, sanitizeCustomSignals(preset.customSignals)]);
        }
      }

      return policyRow;
    });

    const completePolicy = await db.query(`
      SELECT 
        lp.*,
        l.name as library_name,
        l.media_type as library_media_type
      FROM library_policies lp
      JOIN libraries l ON lp.library_id = l.id
      WHERE lp.id = $1
    `, [policy.id]);

    const presetsResult = await db.query(`
      SELECT 
        cp.*,
        pp.weight,
        pp.custom_signals
      FROM policy_presets pp
      JOIN content_presets cp ON pp.preset_id = cp.id
      WHERE pp.policy_id = $1
    `, [policy.id]);

    const result = completePolicy.rows[0];
    result.presets = presetsResult.rows.map(annotate);
    result.configuration_view = buildPolicyConfigurationView(result);
    result.policy_intent_contract = buildPolicyIntentContract(result, {
      configurationView: result.configuration_view,
    });

    return sendData(res, result, 201);
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      name,
      description,
      enabled,
      priority,
      sort_order,
      auto_classify_threshold,
      prompt_threshold,
      require_ai_validation,
      trust_patterns,
      trust_rag,
      trust_history,
      preset_weight,
      profile_weight,
      pattern_weight,
      rag_weight,
      history_weight,
      combination_mode,
      presets,
    } = req.body;

    const autoThresholdField = validatePolicyThresholdField(auto_classify_threshold, 'auto_classify_threshold');
    if (!autoThresholdField.isValid) {
      throw new ValidationError(autoThresholdField.error);
    }

    const promptThresholdField = validatePolicyThresholdField(prompt_threshold, 'prompt_threshold');
    if (!promptThresholdField.isValid) {
      throw new ValidationError(promptThresholdField.error);
    }

    const weightRangeError = [
      validateWeightRange(preset_weight, 'preset_weight'),
      validateWeightRange(profile_weight, 'profile_weight'),
      validateWeightRange(pattern_weight, 'pattern_weight'),
      validateWeightRange(rag_weight, 'rag_weight'),
      validateWeightRange(history_weight, 'history_weight'),
    ].find(Boolean);
    if (weightRangeError) {
      throw new ValidationError(weightRangeError);
    }

    const combinationModeError = validateCombinationMode(combination_mode);
    if (combinationModeError) {
      throw new ValidationError(combinationModeError);
    }

    const normalizedPresets = presets !== undefined ? normalizePresetAttachmentInputs(presets) : null;
    if (normalizedPresets) {
      const presetAttachmentWeightError = validatePresetAttachmentWeights(normalizedPresets, 'presets');
      if (presetAttachmentWeightError) {
        throw new ValidationError(presetAttachmentWeightError);
      }
    }

    const existingPolicyResult = await db.query(`
      SELECT id, auto_classify_threshold, prompt_threshold, preset_weight, profile_weight, pattern_weight, rag_weight, history_weight
      FROM library_policies
      WHERE id = $1
    `, [id]);

    if (existingPolicyResult.rows.length === 0) {
      throw new NotFoundError('Policy not found');
    }

    const mergedWeights = buildMergedWeightSet(existingPolicyResult.rows[0], {
      preset_weight,
      profile_weight,
      pattern_weight,
      rag_weight,
      history_weight,
    });

    const mergedThresholdError = validatePolicyThresholdPayload({
      auto_classify_threshold: autoThresholdField.hasValue
        ? autoThresholdField.value
        : existingPolicyResult.rows[0].auto_classify_threshold,
      prompt_threshold: promptThresholdField.hasValue
        ? promptThresholdField.value
        : existingPolicyResult.rows[0].prompt_threshold,
    }, validatePolicyDecisionThresholds);
    if (mergedThresholdError) {
      throw new ValidationError(mergedThresholdError);
    }

    const weightSumError = validateWeightSum(mergedWeights);
    if (weightSumError) {
      throw new ValidationError(weightSumError);
    }

    await db.withTransaction(async (client) => {
      await client.query(`
        UPDATE library_policies SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          enabled = COALESCE($3, enabled),
          priority = COALESCE($4, priority),
          sort_order = COALESCE($5, sort_order),
          auto_classify_threshold = COALESCE($6, auto_classify_threshold),
          prompt_threshold = COALESCE($7, prompt_threshold),
          require_ai_validation = COALESCE($8, require_ai_validation),
          trust_patterns = COALESCE($9, trust_patterns),
          trust_rag = COALESCE($10, trust_rag),
          trust_history = COALESCE($11, trust_history),
          preset_weight = COALESCE($12, preset_weight),
          profile_weight = COALESCE($13, profile_weight),
          pattern_weight = COALESCE($14, pattern_weight),
          rag_weight = COALESCE($15, rag_weight),
          history_weight = COALESCE($16, history_weight),
          combination_mode = COALESCE($17, combination_mode),
          updated_at = NOW()
        WHERE id = $18
      `, [
        name, description, enabled, priority, sort_order,
        autoThresholdField.value, promptThresholdField.value, require_ai_validation,
        trust_patterns, trust_rag, trust_history,
        preset_weight, profile_weight, pattern_weight, rag_weight, history_weight,
        combination_mode, id,
      ]);

      if (presets !== undefined) {
        await client.query('DELETE FROM policy_presets WHERE policy_id = $1', [id]);

        if (normalizedPresets.length > 0) {
          for (const preset of normalizedPresets) {
            await client.query(`
              INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
              VALUES ($1, $2, $3, $4)
            `, [id, preset.preset_id, preset.weight, sanitizeCustomSignals(preset.customSignals)]);
          }
        }
      }
    });

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

    const presetsResult = await db.query(`
      SELECT 
        cp.*,
        pp.weight,
        pp.custom_signals
      FROM policy_presets pp
      JOIN content_presets cp ON pp.preset_id = cp.id
      WHERE pp.policy_id = $1
    `, [id]);

    const policy = policyResult.rows[0];
    policy.presets = presetsResult.rows.map(annotate);
    policy.configuration_view = buildPolicyConfigurationView(policy);
    policy.policy_intent_contract = buildPolicyIntentContract(policy, {
      configurationView: policy.configuration_view,
    });

    return sendData(res, policy);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const policyResult = await db.query(
      `SELECT lp.*, l.name as library_name 
       FROM library_policies lp 
       JOIN libraries l ON lp.library_id = l.id 
       WHERE lp.id = $1`,
      [id],
    );

    if (policyResult.rows.length === 0) {
      throw new NotFoundError('Policy not found');
    }

    const oldPolicy = policyResult.rows[0];
    const libraryId = oldPolicy.library_id;
    const libraryName = oldPolicy.library_name;

    await db.query('DELETE FROM library_policies WHERE id = $1', [id]);

    const newPolicyResult = await db.query(
      `INSERT INTO library_policies (library_id, name, description, enabled, priority, auto_classify_threshold, prompt_threshold)
       VALUES ($1, $2, $3, true, 5, 85, 60)
       RETURNING *`,
      [libraryId, `${libraryName} Policy`, `Reset policy for ${libraryName}`],
    );

    logger.info('Policy reset (delete + recreate)', {
      oldPolicyId: id,
      newPolicyId: newPolicyResult.rows[0].id,
      libraryId,
      libraryName,
    });

    return sendData(res, {
      message: 'Policy reset successfully',
      oldPolicy,
      newPolicy: newPolicyResult.rows[0],
    });
  }));
}
