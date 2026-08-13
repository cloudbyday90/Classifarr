/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function validateFormulaWeights({
  existing,
  formula_pattern_weight,
  formula_rule_weight,
  formula_rag_weight,
  formula_history_weight,
}) {
  const providedWeights = [formula_pattern_weight, formula_rule_weight, formula_rag_weight, formula_history_weight];
  const hasWeights = providedWeights.some((weight) => weight !== undefined);

  if (!hasWeights) {
    return;
  }

  const currentWeights = existing || {};
  const finalPatternWeight = formula_pattern_weight ?? currentWeights.formula_pattern_weight ?? 0.40;
  const finalRuleWeight = formula_rule_weight ?? currentWeights.formula_rule_weight ?? 0.30;
  const finalRagWeight = formula_rag_weight ?? currentWeights.formula_rag_weight ?? 0.20;
  const finalHistoryWeight = formula_history_weight ?? currentWeights.formula_history_weight ?? 0.10;
  const sum = finalPatternWeight + finalRuleWeight + finalRagWeight + finalHistoryWeight;

  if (sum < 0.99 || sum > 1.01) {
    const error = /** @type {Error & { httpStatus?: number, currentSum?: number }} */ (
      new Error(`Formula weights must sum to 1.0 (currently ${sum.toFixed(2)}). Adjust the weights so they total 100%.`)
    );
    error.httpStatus = 400;
    error.currentSum = sum;
    throw error;
  }
}

export function buildNextTextEmbeddingConfig({ body, existing }) {
  return {
    ...existing,
    primary_provider: body.primary_provider ?? existing.primary_provider ?? 'none',
    embedding_provider_mode: body.embedding_provider_mode ?? existing.embedding_provider_mode ?? 'same',
    embedding_provider: body.embedding_provider ?? existing.embedding_provider ?? 'auto',
    embedding_model: body.embedding_model ?? existing.embedding_model ?? '',
    embedding_ollama_model: body.embedding_ollama_model ?? existing.embedding_ollama_model ?? '',
    embedding_cloud_provider: body.embedding_cloud_provider ?? existing.embedding_cloud_provider ?? '',
    embedding_cloud_model: body.embedding_cloud_model ?? existing.embedding_cloud_model ?? '',
  };
}

export function buildAiProviderConfigUpsertValues({
  body,
  existing,
  finalApiKey,
  finalEmbeddingCloudApiKey,
  finalImageEmbeddingCloudApiKey,
  finalImageEmbeddingLocalApiKey,
  finalImageEmbeddingMode,
  finalImageEmbeddingLocalHost,
  finalImageEmbeddingLocalPort,
}) {
  const currentConfigurationRevision = Number(existing.configuration_revision);
  const nextConfigurationRevision = Number.isSafeInteger(currentConfigurationRevision)
    && currentConfigurationRevision >= 0
    ? currentConfigurationRevision + 1
    : 1;

  return [
    body.primary_provider ?? existing.primary_provider ?? 'none',
    body.api_endpoint ?? existing.api_endpoint ?? '',
    finalApiKey || '',
    body.model ?? existing.model ?? '',
    body.temperature ?? existing.temperature ?? 0.7,
    body.max_tokens ?? existing.max_tokens ?? 2000,
    body.monthly_budget_usd ?? existing.monthly_budget_usd ?? null,
    body.budget_alert_threshold ?? existing.budget_alert_threshold ?? 80,
    body.pause_on_budget_exhausted ?? existing.pause_on_budget_exhausted ?? true,
    body.ollama_fallback_enabled ?? existing.ollama_fallback_enabled ?? false,
    body.ollama_for_basic_tasks ?? existing.ollama_for_basic_tasks ?? false,
    body.ollama_for_budget_exhausted ?? existing.ollama_for_budget_exhausted ?? true,
    body.ollama_host ?? existing.ollama_host ?? 'localhost',
    body.ollama_port ?? existing.ollama_port ?? 11434,
    body.ollama_model ?? existing.ollama_model ?? 'llama3.2',
    body.rag_enabled ?? existing.rag_enabled ?? false,
    body.embedding_provider ?? existing.embedding_provider ?? 'auto',
    body.embedding_model ?? existing.embedding_model ?? '',
    body.rag_similarity_threshold ?? existing.rag_similarity_threshold ?? 0.70,
    body.rag_text_weight ?? existing.rag_text_weight ?? 0.70,
    body.rag_image_weight ?? existing.rag_image_weight ?? 0.30,
    body.rag_min_history_count ?? existing.rag_min_history_count ?? 50,
    body.rag_backfill_budget_type ?? existing.rag_backfill_budget_type ?? 'percentage',
    body.rag_backfill_budget_value ?? existing.rag_backfill_budget_value ?? 25,
    body.formula_pattern_weight ?? existing.formula_pattern_weight ?? 0.40,
    body.formula_rule_weight ?? existing.formula_rule_weight ?? 0.30,
    body.formula_rag_weight ?? existing.formula_rag_weight ?? 0.20,
    body.formula_history_weight ?? existing.formula_history_weight ?? 0.10,
    body.embedding_provider_mode ?? existing.embedding_provider_mode ?? 'same',
    body.embedding_ollama_host ?? existing.embedding_ollama_host ?? '',
    body.embedding_ollama_port ?? existing.embedding_ollama_port ?? 11434,
    body.embedding_ollama_model ?? existing.embedding_ollama_model ?? '',
    body.embedding_cloud_provider ?? existing.embedding_cloud_provider ?? '',
    finalEmbeddingCloudApiKey || '',
    body.embedding_cloud_model ?? existing.embedding_cloud_model ?? '',
    finalImageEmbeddingMode,
    finalImageEmbeddingLocalHost,
    finalImageEmbeddingLocalPort,
    body.image_embedding_local_model ?? existing.image_embedding_local_model ?? '',
    body.image_embedding_cloud_provider ?? existing.image_embedding_cloud_provider ?? '',
    finalImageEmbeddingCloudApiKey || '',
    body.image_embedding_cloud_model ?? existing.image_embedding_cloud_model ?? '',
    body.image_embedding_cloud_api_endpoint ?? existing.image_embedding_cloud_api_endpoint ?? '',
    body.image_embedding_image_size ?? existing.image_embedding_image_size ?? 512,
    body.image_embedding_rps ?? existing.image_embedding_rps ?? 2,
    body.image_embedding_concurrency ?? existing.image_embedding_concurrency ?? 2,
    body.image_embedding_batch_size ?? existing.image_embedding_batch_size ?? 1,
    body.image_embedding_cache_ttl_hours ?? existing.image_embedding_cache_ttl_hours ?? 24,
    body.image_embedding_cache_max_mb ?? existing.image_embedding_cache_max_mb ?? 1024,
    body.rag_graph_enabled ?? existing.rag_graph_enabled ?? false,
    body.rag_graph_weight ?? existing.rag_graph_weight ?? 0.20,
    body.rag_graph_collection_enabled ?? existing.rag_graph_collection_enabled ?? true,
    body.rag_graph_director_enabled ?? existing.rag_graph_director_enabled ?? true,
    body.rag_graph_studio_enabled ?? existing.rag_graph_studio_enabled ?? false,
    body.rag_graph_cast_enabled ?? existing.rag_graph_cast_enabled ?? false,
    body.rag_graph_genre_enabled ?? existing.rag_graph_genre_enabled ?? false,
    body.rag_graph_min_matches_to_apply ?? existing.rag_graph_min_matches_to_apply ?? 1,
    body.rag_graph_candidates_limit ?? existing.rag_graph_candidates_limit ?? 20,
    finalImageEmbeddingLocalApiKey ?? null,
    body.image_embedding_local_timeout_ms ?? existing.image_embedding_local_timeout_ms ?? 15000,
    nextConfigurationRevision,
  ];
}
