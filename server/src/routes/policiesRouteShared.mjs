/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createPoliciesRouter({
  express,
  db,
  logger,
  listPresets,
  describePresetRuntimeSemantics,
  normalizeSignalConfig,
  DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD,
  DEFAULT_POLICY_PROMPT_THRESHOLD,
  validatePolicyDecisionThresholds,
  validatePolicyThresholdField,
}) {
  const router = express.Router();

  const validCombinationModes = new Set(['best_match', 'average', 'weighted_average', 'require_all']);
  const suggestionStopwords = new Set([
    'a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to', 'with',
    'library', 'libraries', 'media', 'content',
  ]);

  function tokenizeSuggestionText(value) {
    return Array.from(new Set(
      String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 2)
        .filter((token) => !suggestionStopwords.has(token)),
    ));
  }

  function compactSuggestionText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function countTokenOverlap(leftTokens, rightTokens) {
    const right = new Set(rightTokens);
    return leftTokens.filter((token) => right.has(token)).length;
  }

  function sanitizeCustomSignals(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const cloned = JSON.parse(JSON.stringify(value));

    for (const [signalType, config] of Object.entries(cloned)) {
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(config, 'strict')) {
        config.strict = config.strict === true;
      }

      cloned[signalType] = config;
    }

    return cloned;
  }

  function normalizePresetAttachmentWeight(value) {
    if (value === undefined || value === null) {
      return 1.0;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Number.NaN;
  }

  function normalizePresetAttachmentInput(preset = {}) {
    return {
      preset_id: preset?.preset_id ?? preset?.id ?? null,
      weight: normalizePresetAttachmentWeight(preset?.weight),
      customSignals: sanitizeCustomSignals(preset?.customSignals ?? preset?.custom_signals),
    };
  }

  function normalizePresetAttachmentInputs(presets) {
    return Array.isArray(presets) ? presets.map(normalizePresetAttachmentInput) : [];
  }

  function validateWeightRange(value, label) {
    if (value !== undefined && (value < 0 || value > 1)) {
      return `${label} must be between 0 and 1`;
    }
    return null;
  }

  function validatePresetAttachmentWeight(value, label = 'preset weight') {
    if (!Number.isFinite(value) || value <= 0) {
      return `${label} must be a positive number`;
    }
    return null;
  }

  function validatePresetAttachmentWeights(presets, labelPrefix = 'preset') {
    for (let index = 0; index < presets.length; index += 1) {
      const preset = presets[index];
      const error = validatePresetAttachmentWeight(preset.weight, `${labelPrefix}[${index}].weight`);
      if (error) {
        return error;
      }
    }
    return null;
  }

  function validateCombinationMode(mode) {
    if (mode !== undefined && !validCombinationModes.has(mode)) {
      return `combination_mode must be one of: ${Array.from(validCombinationModes).join(', ')}`;
    }
    return null;
  }

  function validatePolicyThresholdPayload(thresholds) {
    const validation = validatePolicyDecisionThresholds(thresholds);
    return validation.isValid ? null : validation.errors[0];
  }

  function buildMergedWeightSet(existingPolicy = {}, overrides = {}) {
    return {
      preset_weight: overrides.preset_weight ?? existingPolicy.preset_weight,
      profile_weight: overrides.profile_weight ?? existingPolicy.profile_weight,
      pattern_weight: overrides.pattern_weight ?? existingPolicy.pattern_weight,
      rag_weight: overrides.rag_weight ?? existingPolicy.rag_weight,
      history_weight: overrides.history_weight ?? existingPolicy.history_weight,
    };
  }

  function validateWeightSum(weights) {
    const totalWeight = Number(weights.preset_weight || 0)
      + Number(weights.profile_weight || 0)
      + Number(weights.pattern_weight || 0)
      + Number(weights.rag_weight || 0)
      + Number(weights.history_weight || 0);

    if (Math.abs(totalWeight - 1.0) > 0.001) {
      return `Weights must sum to 1.0 (currently ${totalWeight.toFixed(3)})`;
    }

    return null;
  }

  function annotatePresetAttachment(preset) {
    const baseSignals = normalizeSignalConfig(preset?.signals) || {};
    const customSignals = sanitizeCustomSignals(preset?.custom_signals ?? preset?.customSignals) || null;

    return {
      ...preset,
      source: preset?.source || (preset?.is_system === false ? 'custom' : 'builtin'),
      custom_signals: customSignals,
      customSignals,
      runtime_semantics: describePresetRuntimeSemantics(baseSignals, customSignals),
    };
  }

  function isLegacyIncompatibleAttachment(preset) {
    return preset?.runtime_semantics?.migration_state === 'advisory_defaulted'
      && preset?.runtime_semantics?.review_recommended === true;
  }

  async function fetchPolicyPresetAttachments(policyId = null) {
    const params = [];
    let whereClause = '';

    if (policyId) {
      params.push(policyId);
      whereClause = 'WHERE pp.policy_id = $1';
    }

    const result = await db.query(`
      SELECT 
        lp.id as policy_id,
        lp.name as policy_name,
        l.id as library_id,
        l.name as library_name,
        cp.*,
        pp.weight,
        pp.custom_signals
      FROM policy_presets pp
      JOIN library_policies lp ON pp.policy_id = lp.id
      JOIN libraries l ON lp.library_id = l.id
      JOIN content_presets cp ON pp.preset_id = cp.id
      ${whereClause}
      ORDER BY l.name, lp.name, cp.name
    `, params);

    return result.rows.map(annotatePresetAttachment);
  }

  router.get('/presets/all', async (req, res) => {
    try {
      const { category, search, include_custom } = req.query;
      const presets = await listPresets({
        category,
        search,
        includeCustom: include_custom !== 'false',
        orderBy: 'policy',
      });

      return res.json(presets);
    } catch (error) {
      logger.error('Failed to list presets', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/presets/categories', async (_req, res) => {
    try {
      const result = await db.query(`
        SELECT 
          category,
          COUNT(*) as count
        FROM content_presets
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY category
      `);

      return res.json(result.rows);
    } catch (error) {
      logger.error('Failed to list preset categories', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/presets/:presetId/usage', async (req, res) => {
    try {
      const presetIdNum = Number.parseInt(req.params.presetId, 10);

      if (!Number.isInteger(presetIdNum) || presetIdNum < 1) {
        return res.status(400).json({ error: 'Invalid presetId: must be a positive integer' });
      }

      const result = await db.query(`
        SELECT COUNT(*) as count
        FROM policy_presets
        WHERE preset_id = $1
      `, [presetIdNum]);

      return res.json({ count: parseInt(result.rows[0].count, 10) });
    } catch (error) {
      logger.error('Failed to get preset usage count', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/presets/suggest/:libraryId', async (req, res) => {
    try {
      const { libraryId } = req.params;

      const libraryResult = await db.query(
        'SELECT id, name, media_type FROM libraries WHERE id = $1',
        [libraryId],
      );

      if (libraryResult.rows.length === 0) {
        return res.status(404).json({ error: 'Library not found' });
      }

      const library = libraryResult.rows[0];
      const libraryName = library.name.toLowerCase();
      const tokens = tokenizeSuggestionText(libraryName);
      const compactLibraryName = compactSuggestionText(libraryName);

      logger.debug('Library name tokens for matching', { libraryId, libraryName, tokens });

      const presetRows = await listPresets({
        includeCustom: true,
        orderBy: 'policy',
      });

      const suggestions = presetRows.map((preset) => {
        let score = 0;
        const suggestionReasons = [];

        const presetKey = preset.key.toLowerCase();
        const presetName = preset.name.toLowerCase();
        const presetDesc = (preset.description || '').toLowerCase();
        const presetCategory = (preset.category || '').toLowerCase();
        const presetKeyTokens = tokenizeSuggestionText(presetKey);
        const presetNameTokens = tokenizeSuggestionText(presetName);
        const presetDescTokens = tokenizeSuggestionText(presetDesc);
        const presetCategoryTokens = tokenizeSuggestionText(presetCategory);
        const compactPresetKey = compactSuggestionText(presetKey);
        const compactPresetName = compactSuggestionText(presetName);

        const keyMatchCount = countTokenOverlap(tokens, presetKeyTokens);
        if (keyMatchCount > 0) {
          score += Math.min(40, keyMatchCount * 40);
          suggestionReasons.push('key_token_match');
        }

        const nameMatchCount = countTokenOverlap(tokens, presetNameTokens);
        if (nameMatchCount > 0) {
          score += Math.min(30, nameMatchCount * 15);
          suggestionReasons.push('name_token_match');
        }

        if (
          (compactPresetKey.length >= 4 && compactLibraryName.includes(compactPresetKey))
          || (compactPresetName.length >= 4 && compactLibraryName.includes(compactPresetName))
        ) {
          score += 25;
          suggestionReasons.push('phrase_match');
        }

        const signals = preset.signals || {};
        const genreSignals = signals.genres || {};
        const requireGenres = genreSignals.require_any || [];
        const preferGenres = genreSignals.prefer || [];

        const allGenres = [...requireGenres, ...preferGenres]
          .flatMap((genre) => tokenizeSuggestionText(genre));
        const genreMatchCount = countTokenOverlap(tokens, allGenres);
        if (genreMatchCount > 0) {
          score += Math.min(20, genreMatchCount * 10);
          suggestionReasons.push('genre_token_match');
        }

        const descMatchCount = countTokenOverlap(tokens, presetDescTokens);
        if (descMatchCount > 0) {
          score += Math.min(10, descMatchCount * 5);
          suggestionReasons.push('description_token_match');
        }

        const categoryMatchCount = countTokenOverlap(tokens, presetCategoryTokens);
        if (categoryMatchCount > 0) {
          score += 10;
          suggestionReasons.push('category_token_match');
        }

        const suggestionWarnings = [];
        if (signals.language?.require_any?.length > 0 || signals.media_type?.include?.length > 0) {
          suggestionWarnings.push('runtime_semantics_review_recommended');
        }

        return {
          ...preset,
          suggestion_score: score,
          suggestion_reasons: suggestionReasons,
          suggestion_warnings: suggestionWarnings,
          match_score: score,
          match_reasons: suggestionReasons,
        };
      });

      const topSuggestions = suggestions
        .filter((suggestion) => suggestion.suggestion_score > 0)
        .sort((left, right) => right.suggestion_score - left.suggestion_score)
        .slice(0, 8);

      logger.info('Preset suggestions generated', {
        libraryId,
        libraryName: library.name,
        suggestionCount: topSuggestions.length,
        topMatch: topSuggestions[0]?.name,
      });

      return res.json({
        library_id: library.id,
        library_name: library.name,
        suggestions: topSuggestions,
      });
    } catch (error) {
      logger.error('Failed to get preset suggestions', { error: error.message, libraryId: req.params.libraryId });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/presets/migration/incompatible', async (req, res) => {
    try {
      const policyId = req.query.policy_id ? Number.parseInt(req.query.policy_id, 10) : null;
      if (req.query.policy_id && (!Number.isInteger(policyId) || policyId < 1)) {
        return res.status(400).json({ error: 'policy_id must be a positive integer' });
      }

      const attachments = await fetchPolicyPresetAttachments(policyId);
      const incompatible = attachments.filter(isLegacyIncompatibleAttachment);

      return res.json({
        count: incompatible.length,
        attachments: incompatible,
      });
    } catch (error) {
      logger.error('Failed to list incompatible preset attachments', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/presets/migration/drop-incompatible', async (req, res) => {
    try {
      const policyId = req.body?.policy_id ? Number.parseInt(req.body.policy_id, 10) : null;
      if (req.body?.policy_id && (!Number.isInteger(policyId) || policyId < 1)) {
        return res.status(400).json({ error: 'policy_id must be a positive integer' });
      }

      const dropped = await db.withTransaction(async (client) => {
        const params = [];
        let whereClause = '';

        if (policyId) {
          params.push(policyId);
          whereClause = 'WHERE pp.policy_id = $1';
        }

        const attachmentsResult = await client.query(`
          SELECT 
            lp.id as policy_id,
            lp.name as policy_name,
            l.id as library_id,
            l.name as library_name,
            cp.*,
            pp.weight,
            pp.custom_signals
          FROM policy_presets pp
          JOIN library_policies lp ON pp.policy_id = lp.id
          JOIN libraries l ON lp.library_id = l.id
          JOIN content_presets cp ON pp.preset_id = cp.id
          ${whereClause}
          ORDER BY l.name, lp.name, cp.name
        `, params);

        const incompatible = attachmentsResult.rows
          .map(annotatePresetAttachment)
          .filter(isLegacyIncompatibleAttachment);

        for (const attachment of incompatible) {
          await client.query(
            'DELETE FROM policy_presets WHERE policy_id = $1 AND preset_id = $2',
            [attachment.policy_id, attachment.id],
          );
        }

        return incompatible;
      });

      return res.json({
        dropped_count: dropped.length,
        dropped,
      });
    } catch (error) {
      logger.error('Failed to drop incompatible preset attachments', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/', async (_req, res) => {
    try {
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

      return res.json(result.rows);
    } catch (error) {
      logger.error('Failed to list policies', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
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
        return res.status(404).json({ error: 'Policy not found' });
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

      policy.presets = presetsResult.rows.map(annotatePresetAttachment);

      return res.json(policy);
    } catch (error) {
      logger.error('Failed to get policy', { error: error.message, id: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
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
        return res.status(400).json({ error: 'library_id and name are required' });
      }

      const thresholdValidationError = validatePolicyThresholdPayload({
        auto_classify_threshold,
        prompt_threshold,
      });
      if (thresholdValidationError) {
        return res.status(400).json({ error: thresholdValidationError });
      }

      const normalizedAutoClassifyThreshold = Number(auto_classify_threshold);
      const normalizedPromptThreshold = Number(prompt_threshold);
      const combinationModeError = validateCombinationMode(combination_mode);
      if (combinationModeError) {
        return res.status(400).json({ error: combinationModeError });
      }

      if (preset_weight < 0 || preset_weight > 1) {
        return res.status(400).json({ error: 'preset_weight must be between 0 and 1' });
      }
      if (profile_weight < 0 || profile_weight > 1) {
        return res.status(400).json({ error: 'profile_weight must be between 0 and 1' });
      }
      if (pattern_weight < 0 || pattern_weight > 1) {
        return res.status(400).json({ error: 'pattern_weight must be between 0 and 1' });
      }
      if (rag_weight < 0 || rag_weight > 1) {
        return res.status(400).json({ error: 'rag_weight must be between 0 and 1' });
      }
      if (history_weight < 0 || history_weight > 1) {
        return res.status(400).json({ error: 'history_weight must be between 0 and 1' });
      }

      const totalWeight = preset_weight + profile_weight + pattern_weight + rag_weight + history_weight;
      if (Math.abs(totalWeight - 1.0) > 0.001) {
        return res.status(400).json({
          error: `Weights must sum to 1.0 (currently ${totalWeight.toFixed(3)})`,
        });
      }

      const normalizedPresets = normalizePresetAttachmentInputs(presets);
      const presetAttachmentWeightError = validatePresetAttachmentWeights(normalizedPresets, 'presets');
      if (presetAttachmentWeightError) {
        return res.status(400).json({ error: presetAttachmentWeightError });
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
      result.presets = presetsResult.rows.map(annotatePresetAttachment);

      return res.status(201).json(result);
    } catch (error) {
      logger.error('Failed to create policy', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
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
        return res.status(400).json({ error: autoThresholdField.error });
      }

      const promptThresholdField = validatePolicyThresholdField(prompt_threshold, 'prompt_threshold');
      if (!promptThresholdField.isValid) {
        return res.status(400).json({ error: promptThresholdField.error });
      }

      const weightRangeError = [
        validateWeightRange(preset_weight, 'preset_weight'),
        validateWeightRange(profile_weight, 'profile_weight'),
        validateWeightRange(pattern_weight, 'pattern_weight'),
        validateWeightRange(rag_weight, 'rag_weight'),
        validateWeightRange(history_weight, 'history_weight'),
      ].find(Boolean);
      if (weightRangeError) {
        return res.status(400).json({ error: weightRangeError });
      }

      const combinationModeError = validateCombinationMode(combination_mode);
      if (combinationModeError) {
        return res.status(400).json({ error: combinationModeError });
      }

      const normalizedPresets = presets !== undefined ? normalizePresetAttachmentInputs(presets) : null;
      if (normalizedPresets) {
        const presetAttachmentWeightError = validatePresetAttachmentWeights(normalizedPresets, 'presets');
        if (presetAttachmentWeightError) {
          return res.status(400).json({ error: presetAttachmentWeightError });
        }
      }

      const existingPolicyResult = await db.query(`
        SELECT id, auto_classify_threshold, prompt_threshold, preset_weight, profile_weight, pattern_weight, rag_weight, history_weight
        FROM library_policies
        WHERE id = $1
      `, [id]);

      if (existingPolicyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Policy not found' });
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
      });
      if (mergedThresholdError) {
        return res.status(400).json({ error: mergedThresholdError });
      }

      const weightSumError = validateWeightSum(mergedWeights);
      if (weightSumError) {
        return res.status(400).json({ error: weightSumError });
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
        return res.status(404).json({ error: 'Policy not found' });
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
      policy.presets = presetsResult.rows.map(annotatePresetAttachment);

      return res.json(policy);
    } catch (error) {
      logger.error('Failed to update policy', { error: error.message, id: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;

      const policyResult = await db.query(
        `SELECT lp.*, l.name as library_name 
         FROM library_policies lp 
         JOIN libraries l ON lp.library_id = l.id 
         WHERE lp.id = $1`,
        [id],
      );

      if (policyResult.rows.length === 0) {
        return res.status(404).json({ error: 'Policy not found' });
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

      return res.json({
        message: 'Policy reset successfully',
        oldPolicy,
        newPolicy: newPolicyResult.rows[0],
      });
    } catch (error) {
      logger.error('Failed to reset policy', { error: error.message, id: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/presets', async (req, res) => {
    try {
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

      return res.json(result.rows.map(annotatePresetAttachment));
    } catch (error) {
      logger.error('Failed to get policy presets', { error: error.message, id: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/presets', async (req, res) => {
    try {
      const { id } = req.params;
      const { preset_id } = req.body;
      const weight = normalizePresetAttachmentWeight(req.body.weight);

      if (!preset_id) {
        return res.status(400).json({ error: 'preset_id is required' });
      }
      const presetWeightError = validatePresetAttachmentWeight(weight, 'weight');
      if (presetWeightError) {
        return res.status(400).json({ error: presetWeightError });
      }

      const existing = await db.query(
        'SELECT * FROM policy_presets WHERE policy_id = $1 AND preset_id = $2',
        [id, preset_id],
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Preset already attached to this policy' });
      }

      const customSignals = sanitizeCustomSignals(req.body.customSignals ?? req.body.custom_signals);
      const result = await db.query(`
        INSERT INTO policy_presets (policy_id, preset_id, weight, custom_signals)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [id, preset_id, weight, customSignals]);
      await db.query('UPDATE library_policies SET updated_at = NOW() WHERE id = $1', [id]);

      return res.status(201).json(annotatePresetAttachment(result.rows[0]));
    } catch (error) {
      logger.error('Failed to attach preset', { error: error.message, id: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id/presets/:presetId', async (req, res) => {
    try {
      const { id, presetId } = req.params;

      const result = await db.query(
        'DELETE FROM policy_presets WHERE policy_id = $1 AND preset_id = $2 RETURNING *',
        [id, presetId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Preset not attached to this policy' });
      }

      await db.query('UPDATE library_policies SET updated_at = NOW() WHERE id = $1', [id]);

      return res.json({ message: 'Preset removed successfully' });
    } catch (error) {
      logger.error('Failed to remove preset', { error: error.message, id: req.params.id });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
