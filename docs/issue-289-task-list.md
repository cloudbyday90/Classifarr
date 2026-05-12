# Issue 289 Task List

## Phase 0: Prep and Alignment
- [x] Review `docs/issue-289-implementation-plan.md`
- [x] Confirm provider defaults and image size policy
- [x] Confirm local service approach (FastAPI OpenCLIP/SigLIP)
- [x] Research online sources for latest (prefer LTS) versions of required services and libraries

## Phase 1: Schema and Config
- [x] Add timestamped migration for `classification_embeddings` image columns + indexes
- [x] Add timestamped migration for `ai_provider_config` image settings (size, rate limits, cache TTL/size)
- [x] Update `server/src/routes/settings.mjs` defaults + masking for new fields
- [x] Update `server/src/services/embeddingRouter.mjs` config fetch to include new fields

## Phase 2: Provider Layer
- [x] Create `server/src/services/imageEmbeddingProvider.mjs`
- [x] Implement cloud provider calls (Vertex, Voyage, Cohere)
- [x] Implement local provider calls (HTTP service)
- [x] Add provider-specific rate limits and batching

## Phase 3: Embedding Generation + Caching
- [x] Add poster URL resolution helper
- [x] Add image embedding generation path in `embeddingService.generateAndStore`
- [x] Store image embedding fields + hash + size + source URL
- [x] Implement cache skip logic (hash/model/size)

## Phase 4: Retrieval Scoring
- [x] Add query path to compute combined text + image similarity
- [x] Add configurable weights (text/image) via `ai_provider_config`
- [x] Add two-phase re-rank (text-first, then combined)

## Phase 5: UI + API
- [x] Add image embedding configuration fields to UI (size, rate limits, cache)
- [x] Add image embedding status counters and provider status
- [x] Add manual “Re-embed images” action
- [x] Wire new API responses to UI

## Phase 6: Tests and Validation
- [x] Unit tests for poster URL resolution and caching logic
- [x] Unit tests for image embedding provider selection
- [x] Integration tests for image embedding storage and combined scoring
- [x] Validate text-only fallback when poster is missing
- [x] Update existing relevant tests to reflect new image embedding fields and scoring
- [x] Run all tests (including integration) and fix any failures

Suggested commands:
```bash
npm test
npm --prefix server run test:integration
```

## Phase 7: Rollout
- [x] Run migrations locally
- [x] Update `database/schema/current.sql`
- [x] Update docs/README with new configuration
- [x] Update `CHANGELOG.md` with technical changes (target version: v0.41.2-alpha)
- [x] Update `RELEASE_NOTES.md` with high-level changes (target version: v0.41.2-alpha)
- [x] Verify CI passes

## Dependencies
1. Phase 1 depends on Phase 0 (confirmed decisions).
2. Phase 2 depends on Phase 1 (config fields and migrations).
3. Phase 3 depends on Phase 2 (imageEmbeddingProvider implemented).
4. Phase 4 depends on Phase 3 (image embeddings stored).
5. Phase 5 depends on Phases 1 and 4 (config + retrieval changes).
6. Phase 6 depends on Phases 3 and 4 (functional paths exist to test).
7. Phase 7 depends on Phases 1 through 6 (implementation complete).
