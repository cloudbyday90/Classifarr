/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { INVENTORY_BACKGROUND_READINESS_EXCLUDING_TASK_SQL } from './inventoryBackgroundReadiness.mjs';
import { normalizeMode } from './imageEmbeddingConfig.mjs';

export async function readImageIndexDemand(query) {
  // Return configuration presence, never provider credentials or endpoints.
  const config = (await query(`SELECT rag_enabled, rag_image_weight, image_embedding_provider_mode,
    NULLIF(btrim(image_embedding_local_host), '') IS NOT NULL AS local_configured,
    NULLIF(btrim(image_embedding_cloud_provider), '') IS NOT NULL
      AND NULLIF(btrim(image_embedding_cloud_api_key), '') IS NOT NULL AS cloud_configured
    FROM public.ai_provider_config WHERE id = 1`)).rows[0];
  const weight = Number(config?.rag_image_weight);
  const mode = normalizeMode(config?.image_embedding_provider_mode);
  if (config?.rag_enabled !== true || !Number.isFinite(weight) || weight <= 0 || mode === 'disabled') return 'disabled';
  if (mode === 'cloud' ? config.cloud_configured !== true : config.local_configured !== true) return 'not_configured';
  const row = (await query(`SELECT to_regtype('public.vector') IS NOT NULL
    AND to_regclass('public.classification_embeddings') IS NOT NULL AS available`)).rows[0];
  return row?.available === true ? 'needed' : 'schema_unavailable';
}

export async function readImageIndexReadiness(query, taskId = null) {
  const demand = await readImageIndexDemand(query);
  if (demand !== 'needed') return demand;
  return (await query(INVENTORY_BACKGROUND_READINESS_EXCLUDING_TASK_SQL, [taskId])).rows[0]?.readiness ?? 'unavailable';
}
