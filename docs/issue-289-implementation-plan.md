# Issue 289 Implementation Plan

Title: RAG Enhancement: Multimodal Retrieval (Image Embeddings for Poster Similarity)

Owner: Classifarr team
Status: Closed
Date: 2026-02-04

## Summary
Add multimodal retrieval by generating image embeddings for posters and combining them with text embeddings during RAG similarity scoring. This enables visually similar titles (franchises, anime vs non-anime, foreign posters) to improve retrieval when text is ambiguous. The implementation keeps text and image embeddings separate for modularity and safe re-embedding when models change.

## Requirements From Issue 289
1. Add poster path to metadata collection on import/classification (from TMDb, etc.).
2. Generate image embeddings using a model like CLIP, BLIP, SigLIP, or a cloud multimodal embedding API.
3. Store text and image embeddings for each classification.
4. Combine text and image similarity with weighted scoring during retrieval.
5. Validate accuracy and recall for ambiguous titles.

## OPENAI.md Alignment (Project Guidelines)
- Follow the 3-layer architecture: check `directives/` for SOPs, prefer deterministic scripts in `execution/`, and only add new scripts when none exist.
- Keep changes scoped; avoid cross-cutting refactors unless required by the issue.
- If API contracts change, update both server routes/services and the client API layer (`client/src/api`) plus any affected views/stores.
- If database schema changes, add a new migration in `database/migrations/` and update server queries accordingly.
- Use `.env.example` for any new config (do not add secrets).
- Put any temporary caches/files in `.tmp/` and keep them regenerable.
- If learnings emerge (limits, edge cases), update docs or directives where appropriate.

## Directive/Execution Checklist
- [ ] Review `directives/` for any SOPs related to embeddings, RAG, or migrations.
- [ ] Check `execution/` for scripts that can automate migration, backfill, or embedding validation.
- [ ] If no suitable script exists, decide whether to extend `execution/` or proceed with manual changes.
- [ ] When adding new scripts, document usage and keep inputs deterministic.

## Current State (Code Map)
1. Metadata enrichment includes poster path in TMDb enrichment.
   - File: server/src/services/classification.js
   - Field: enrichedMetadata.poster_path
2. Embeddings are generated via EmbeddingService.
   - File: server/src/services/embeddingService.js
   - Entry point: generateAndStore(classificationId, metadata)
3. Embedding retrieval uses only text vector in classification_embeddings.embedding.
   - File: server/src/services/ragRetriever.js
   - Query: 1 - (ce.embedding <=> $1::vector) as similarity
4. Embedding config uses text-only provider settings. Image-specific config has been added to settings/UI but is not wired into generation or retrieval yet.
   - Files: server/src/routes/settings.js, client/src/views/rag/OverviewTab.vue

## Provider Options (Cost and Recency)
Cloud options:
- Google Vertex AI multimodal embedding: published per-image pricing is $0.0001 per image.
- Voyage multimodal: pricing per pixel with large free tier; costs scale with resolution.
- Cohere Embed v3: supports images, pricing not clearly listed per image.

Local options:
- SigLIP 2 (2025) is a current open encoder family.
- OpenCLIP provides many CLIP variants and SigLIP derivatives.
- Local image-embedding service should expose `/embed-image` and support CPU, Intel iGPU (OpenVINO), and NVIDIA CUDA. NVENC is a video encoder and not used for embeddings; CUDA is the correct NVIDIA acceleration path.

Recommendation:
- Default cloud provider: Vertex AI multimodal embedding for predictable per-image cost.
- Alternate cloud provider: Voyage if image resolution is constrained.
- Default local provider: SigLIP 2 (or OpenCLIP as fallback).
- Default model IDs: Vertex `multimodalembedding@001`; Voyage `voyage-multimodal-3.5`; Cohere `embed-english-v3.0` (or `embed-multilingual-v3.0` if locale is not English); Local OpenCLIP `ViT-B-16` (overrideable).
- Cohere note: valid multimodal support, but base64 payloads and 1 image per request make large backfills slower.

Sources:
- https://cloud.google.com/vertex-ai/generative-ai/pricing
- https://docs.voyageai.com/docs/pricing
- https://docs.voyageai.com/docs/multimodal-embeddings
- https://docs.cohere.com/docs/embed
- https://docs.cohere.com/changelog/embed-v3-is-multimodal
- https://arxiv.org/abs/2502.14786
- https://github.com/mlfoundations/open_clip

## Version Matrix (LTS/Stable Targets)
- Node.js: v24 (Active LTS, "Krypton").
- PostgreSQL: 17.x (current supported major).
- pgvector: 0.8.0 (latest release).
- Python: 3.13 (stable, broad compatibility).
- FastAPI: 0.128.1 (latest PyPI release).
- PyTorch: 2.7.0 (latest stable, requires Python >=3.10).
- open_clip_torch: 3.2.0 (latest PyPI release).

Sources:
- https://nodejs.org/en/about/previous-releases
- https://www.postgresql.org/support/versioning/
- https://www.postgresql.org/about/news/pgvector-080-released-2952/
- https://peps.python.org/pep-0719/
- https://pypi.org/project/fastapi/
- https://pytorch.org/
- https://pypi.org/project/open-clip-torch/

## Poster Handling
Poster URL resolution:
- If poster_path exists and is not a full URL, construct URL:
  https://image.tmdb.org/t/p/w500{poster_path}
- If poster_path is already a URL, use it directly.

No poster behavior:
- Do not generate image embedding.
- Store image_embedding = NULL and image_embedding_dims = NULL.
- Retrieval should fall back to text-only similarity for that item.

Image size normalization:
- Standardize to a fixed size (e.g., 336 or 512) before embedding.
- This reduces cost for pixel-priced providers and stabilizes similarity.
- Decision: use a single global default size of 512 across providers.
- If model or size changes, mark image embeddings stale and re-embed.

Poster storage policy:
- Default: fetch on demand, no persistent storage.
- Optional: short-lived disk cache in `.tmp/` with TTL and size cap (defaults: 24h, 1GB).

Suggested utility function (server/src/services/embeddingService.js or new helper):
```js
function resolvePosterUrl(metadata) {
  const raw = metadata.poster_path || metadata.posterPath;
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://image.tmdb.org/t/p/w500${raw}`;
}
```

## Data Model Changes
Add image embeddings to classification_embeddings:
- image_embedding vector(2000) (max size, track actual dims in image_embedding_dims).
- image_embedding_dims INTEGER.
- image_provider VARCHAR(50).
- image_model VARCHAR(100).
- image_embedding_hash VARCHAR(64) (cache key: poster URL hash).
- image_embedding_size INTEGER (actual pixel size used for embedding).
- image_embedding_source_url TEXT (poster URL used for embedding).

Indexing:
- HNSW index on image_embedding using vector_cosine_ops.
- Optional filtered index for image_embedding IS NOT NULL.

Migration:
- Add a timestamped migration with IF NOT EXISTS for all columns and indexes.

Suggested migration SQL:
```sql
ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding vector(2000);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_dims INTEGER;

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_provider VARCHAR(50);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_model VARCHAR(100);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_hash VARCHAR(64);

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_size INTEGER;

ALTER TABLE classification_embeddings
ADD COLUMN IF NOT EXISTS image_embedding_source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_embeddings_image_hnsw
ON classification_embeddings USING hnsw (image_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_embeddings_image_present
ON classification_embeddings (image_provider, image_model)
WHERE image_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_embeddings_image_hash
ON classification_embeddings (image_embedding_hash, image_model, image_embedding_size)
WHERE image_embedding_hash IS NOT NULL;
```

Notes:
- If the image embedding dimensionality changes, update only image_embedding, not the text column.
- Avoid truncating classification_embeddings when changing image models; only re-embed images.
- Cache behavior: cache key = poster_url_hash + image_model + image_size. If hash + model + size match, skip recompute; otherwise regenerate image embedding only.

## Embedding Generation Flow
Current flow:
classification -> enrichedMetadata -> embeddingService.generateAndStore -> storeEmbedding

New flow:
classification -> enrichedMetadata
1. Generate text embedding (existing path).
2. If poster URL exists, generate image embedding.
3. Store both in classification_embeddings.

Pseudo-code:
const text = formatForEmbedding(metadata);
const textResult = await embeddingRouter.embed(text);

const posterUrl = resolvePosterUrl(metadata);
let imageResult = null;
if (posterUrl) {
  imageResult = await imageEmbeddingProvider.embedImageFromUrl(posterUrl);
}

await storeEmbedding(classificationId, textResult, imageResult);

Concrete example (server/src/services/embeddingService.js):
```js
const imageEmbeddingProvider = require('./imageEmbeddingProvider');

async generateAndStore(classificationId, metadata) {
  const text = this.formatForEmbedding(metadata);
  const textResult = await embeddingRouter.embed(text);

  const posterUrl = resolvePosterUrl(metadata);
  let imageResult = null;
  if (posterUrl) {
    imageResult = await imageEmbeddingProvider.embedImageFromUrl(posterUrl);
  }

  return await this.storeEmbedding(classificationId, textResult, imageResult);
}

async storeEmbedding(classificationId, textResult, imageResult = null) {
  const textVector = `[${textResult.embedding.join(',')}]`;
  const imageVector = imageResult ? `[${imageResult.embedding.join(',')}]` : null;

  const imageHash = posterUrl ? hash(posterUrl) : null;
  const imageSize = imageResult?.size || null;

  await db.query(`
    INSERT INTO classification_embeddings
    (classification_id, embedding, embedding_dims, provider, model,
     image_embedding, image_embedding_dims, image_provider, image_model,
     image_embedding_hash, image_embedding_size, image_embedding_source_url)
    VALUES ($1, $2::vector, $3, $4, $5, $6::vector, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (classification_id) DO UPDATE SET
      embedding = $2::vector,
      embedding_dims = $3,
      provider = $4,
      model = $5,
      image_embedding = $6::vector,
      image_embedding_dims = $7,
      image_provider = $8,
      image_model = $9,
      image_embedding_hash = $10,
      image_embedding_size = $11,
      image_embedding_source_url = $12,
      is_stale = false,
      updated_at = NOW()
  `, [
    classificationId,
    textVector,
    textResult.dims,
    textResult.provider,
    textResult.model,
    imageVector,
    imageResult?.dims || null,
    imageResult?.provider || null,
    imageResult?.model || null,
    imageHash,
    imageSize,
    posterUrl
  ]);
}
```

Caching example (server-side):
```js
const imageHash = posterUrl ? hash(posterUrl) : null;
if (existing.image_embedding_hash === imageHash &&
    existing.image_model === imageModel &&
    existing.image_embedding_size === imageSize) {
  return; // skip re-embed
}
```

## Backfill Modes (Idle + Scheduled)
Idle and scheduled backfill are required for both text and image embeddings.

Current behavior:
- Idle backfill (`idleBackfillService`) runs opportunistically when the system is idle.
- Scheduled backfill (`scheduledBackfillService`) runs on a configured schedule.
- Both modes automatically include image embeddings when image embeddings are enabled (rag_image_weight > 0) and the image provider is configured.

Configuration fields:
- `idle_backfill_enabled`, `idle_threshold`, `idle_batch_size`
- `scheduled_backfill_enabled`, `scheduled_backfill_time`, `scheduled_backfill_days`, `scheduled_backfill_batch_size`, `scheduled_backfill_max_duration`

Defaults:
- Idle backfill ON by default.
- Scheduled backfill ON by default (unless the image embedding provider is disabled, in which case image backfill is effectively off).

UI:
- Backfill configuration lives in the **Backfill** tab.
- Status indicators for idle/scheduled are displayed in both Text and Image tabs for quick visibility.

Notes:
- Image embeddings backfill is best-effort and will be skipped if the image provider is disabled or not configured.
- Re-embed images uses the same backfill pipeline; it clears image vectors and relies on idle/scheduled/manual runs to regenerate.

## Image Embedding Provider Layer
Create a new service: server/src/services/imageEmbeddingProvider.js
- getConfig(): read image_embedding_* fields from ai_provider_config.
- embedImageFromUrl(url, overrides): returns embedding + dims + provider + model.
- implement for: cloud providers (Vertex, Voyage, Cohere) in phase 1; local providers (OpenCLIP/SigLIP) in phase 2.

Suggested interface:
```js
class ImageEmbeddingProvider {
  async getConfig() {
    // read image_embedding_* fields from ai_provider_config
  }

  async embedImageFromUrl(url, overrides = {}) {
    const config = { ...(await this.getConfig()), ...overrides };
    // switch on config.image_embedding_provider_mode and provider
    // return { embedding: number[], dims: number, provider: string, model: string, cost?: number }
  }
}
```

### Local Provider Deep Dive
Recommended approach: a small local HTTP service (FastAPI) that runs OpenCLIP/SigLIP.

Why:
- Avoids Node native bindings for PyTorch.
- Enables GPU acceleration without complicating the main server runtime.
- Keeps latency and cost low for on-prem deployments.

Minimal API contract (local service):
```
POST /embed-image
{
  "image_url": "https://image.tmdb.org/t/p/w500/...",
  "model": "siglip2-so400m-14",
  "normalize": true
}

Response:
{
  "embedding": [ ... ],
  "dims": 1024,
  "provider": "local",
  "model": "siglip2-so400m-14"
}
```

Embedding service config:
- image_embedding_provider_mode: "separate_local"
- image_embedding_local_host: host running FastAPI
- image_embedding_local_port: port running FastAPI
- image_embedding_local_model: model identifier

Operational notes:
- GPU recommended for performance.
- CPU mode is acceptable for small libraries but will be slow at scale.
- Cache embeddings by poster URL hash to prevent redundant work during retries.

## Retrieval Scoring (Multimodal)
Goal: Combine text + image similarity into a single score.

Suggested formula:
combined = (text_weight * text_similarity) + (image_weight * image_similarity)

Defaults:
- text_weight = 0.7
- image_weight = 0.3

Fallback rules:
- If query has no image embedding or row image_embedding is NULL:
  combined = text_similarity

Two-phase optimization:
1. Top-K by text vector.
2. Re-rank by combined score.

Example SQL for combined scoring:
```sql
SELECT
  ce.id,
  ce.classification_id,
  ch.title,
  1 - (ce.embedding <=> $1::vector) AS text_similarity,
  CASE
    WHEN $2::vector IS NULL OR ce.image_embedding IS NULL THEN NULL
    ELSE 1 - (ce.image_embedding <=> $2::vector)
  END AS image_similarity,
  (
    $3 * (1 - (ce.embedding <=> $1::vector)) +
    $4 * COALESCE(1 - (ce.image_embedding <=> $2::vector), 0)
  ) AS combined_similarity
FROM classification_embeddings ce
JOIN classification_history ch ON ce.classification_id = ch.id
WHERE ce.is_stale = false
ORDER BY combined_similarity DESC
LIMIT $5;
```

Two-phase re-rank (recommended):
1. Use text similarity to fetch top-K results.
2. Re-rank by combined score (text + image).
This avoids scanning the full image embedding index for every query.

## Configuration Additions
Add to ai_provider_config:
- rag_text_weight NUMERIC(4,2) default 0.70
- rag_image_weight NUMERIC(4,2) default 0.30
- image_embedding_image_size INTEGER default 512
- image_embedding_rps INTEGER default 2
- image_embedding_concurrency INTEGER default 2
- image_embedding_batch_size INTEGER default 1
- image_embedding_cache_ttl_hours INTEGER default 24
- image_embedding_cache_max_mb INTEGER default 1024
- image_embedding_cloud_api_endpoint TEXT default NULL (optional for providers like Vertex)

Add to UI:
- Optional numeric inputs for weights in RAG settings.
- Image embedding size input and rate-limit controls (mirrors text settings).
- Image embedding status counters: total, pending, failed.
- Image provider status indicator.
- Manual "Re-embed images" action to mark image embeddings stale and trigger backfill.

Notes:
- If any new environment variables are introduced (e.g., local service defaults), update `.env.example`.

Suggested API defaults in server/src/routes/settings.js:
```js
rag_text_weight: 0.70,
rag_image_weight: 0.30,
image_embedding_image_size: 512,
image_embedding_cache_ttl_hours: 24,
image_embedding_cache_max_mb: 1024,
image_embedding_cloud_api_endpoint: ''
```

## Tests and Validation
Unit tests:
- image poster URL resolution.
- image embedding provider selection by config.
 - storing image embedding fields on upsert.

Integration tests:
- storing text + image embeddings in classification_embeddings.
- multimodal similarity scoring outputs.
- migration applies cleanly and is idempotent.

Validation checklist:
- Compare retrieval results for ambiguous titles (anime, franchise, foreign posters).
- Confirm text-only fallback still works for missing posters.
- Confirm performance and cost within expected thresholds.
- Confirm idle backfill generates image embeddings during idle periods.
- Confirm scheduled backfill generates image embeddings at the configured time window.

## Rollout Steps
1. Check `directives/` and `execution/` for existing workflows/scripts; update or reuse before adding new ones.
2. Add migration for classification_embeddings image columns + indexes (including hash/size).
3. Add ai_provider_config fields for image size + rate limits.
4. Implement imageEmbeddingProvider service.
5. Wire into EmbeddingService generateAndStore + caching by hash/model/size.
6. Update RAG retrieval query to use combined score.
7. Add tests (schema, storage, scoring, caching, rate-limits).
8. Update schema snapshot (database/schema/current.sql).
9. Document release notes and configuration.

## Performance and Cost Guidance
1. Vertex multimodalembedding@001:
   - Cost: $0.0001 per image.
   - Images are resized to 512 x 512 by the service; reduce client size to avoid extra transfer.
2. Voyage multimodal:
   - Cost scales with pixels; downscale to reduce cost.
   - Supports large contexts and interleaved text + image inputs.
3. Cohere embed v3 multimodal:
   - Image input via base64, 1 image per request; expect slower ingestion for large libraries.

## Provider API Examples (Concrete Payloads)
Vertex AI multimodal embedding (REST):
```json
POST https://LOCATION-aiplatform.googleapis.com/v1/projects/PROJECT_ID/locations/LOCATION/publishers/google/models/multimodalembedding@001:predict
Authorization: Bearer $ACCESS_TOKEN

{
  "instances": [
    {
      "image": {
        "gcsUri": "gs://bucket/poster.jpg"
      }
    }
  ]
}
```

Voyage multimodal embedding (REST):
```json
POST https://api.voyageai.com/v1/embeddings
Authorization: Bearer $VOYAGE_API_KEY

{
  "model": "voyage-multimodal-3.5",
  "input": [
    {
      "type": "image",
      "image_url": "https://image.tmdb.org/t/p/w500/abc123.jpg"
    }
  ]
}
```

Cohere embed v3 multimodal (REST):
```json
POST https://api.cohere.com/v1/embed
Authorization: Bearer $COHERE_API_KEY

{
  "model": "embed-english-v3.0",
  "input_type": "image",
  "images": [
    "BASE64_ENCODED_IMAGE"
  ]
}
```

## Local FastAPI Service (Reference Implementation)
Minimal local image embedding server using OpenCLIP/SigLIP.

File: local_image_embedding_service/main.py
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import torch
from PIL import Image
from io import BytesIO
import open_clip

app = FastAPI()

class EmbedRequest(BaseModel):
    image_url: str
    model: str = "ViT-B-16"
    normalize: bool = True

def load_image(url: str) -> Image.Image:
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return Image.open(BytesIO(resp.content)).convert("RGB")

@app.post("/embed-image")
def embed_image(req: EmbedRequest):
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model, _, preprocess = open_clip.create_model_and_transforms(req.model, pretrained="laion2b_s34b_b88k")
        model = model.to(device)
        image = preprocess(load_image(req.image_url)).unsqueeze(0).to(device)
        with torch.no_grad():
            emb = model.encode_image(image).float()
            if req.normalize:
                emb = emb / emb.norm(dim=-1, keepdim=True)
        return {
            "embedding": emb.squeeze(0).cpu().tolist(),
            "dims": emb.shape[-1],
            "provider": "local",
            "model": req.model
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
```

## Node Integration (Local Provider Call)
Example in imageEmbeddingProvider:
```js
async embedImageFromUrl(url, overrides = {}) {
  const config = { ...(await this.getConfig()), ...overrides };
  const host = config.image_embedding_local_host || 'localhost';
  const port = config.image_embedding_local_port || 8000;
  const model = config.image_embedding_local_model || 'ViT-B-16';

  const response = await axios.post(
    `http://${host}:${port}/embed-image`,
    { image_url: url, model, normalize: true },
    { timeout: 15000 }
  );

  const embedding = response.data?.embedding || [];
  return {
    embedding,
    dims: response.data?.dims || embedding.length,
    provider: 'local',
    model
  };
}
```

## Risks and Mitigations
1. Dimension mismatch:
   - Store image embeddings in a separate column.
   - Only recreate image_embedding column if needed.
2. Cost overruns:
   - Normalize image size.
   - Use two-phase retrieval to avoid excess image embedding calls.
3. Missing posters:
   - Fallback to text-only scoring.
4. Provider outages:
   - Treat image embedding as best-effort; do not block text embedding.

## Acceptance Criteria
1. Image embeddings are stored for items with posters.
2. Items without posters still index and retrieve successfully.
3. RAG retrieval combines text + image similarity with configurable weights.
4. Migrations apply cleanly on fresh and existing databases.
5. Tests cover schema changes, storage, and retrieval logic.
