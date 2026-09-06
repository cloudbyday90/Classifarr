# Classifarr

Route every request to the right library with policy-driven decisions you can trust.

![License](https://img.shields.io/github/license/cloudbyday90/Classifarr)
![Version](https://img.shields.io/badge/version-v0.48.4--beta-blue.svg)
![Docker Pulls](https://img.shields.io/docker/pulls/cloudbyday90/classifarr)

Classifarr is an AI- and RAG-powered media classification and routing service. It runs as the decision layer between request inputs (Overseerr/Jellyseerr webhooks, manual/API submissions, and media sync) and your automation stack, then uses metadata, policy rules, and AI/RAG signals to auto-route high-confidence matches to the correct Radarr/Sonarr destination while sending low-confidence cases to review.

**Source version:** `v0.48.4-beta`. It becomes a public release only after its tag pipeline succeeds; until then, use the latest published release shown in GitHub Releases. Package files use the semver-safe form `0.48.4-beta`, while the UI, release notes, and Git tags use `v0.48.4-beta`. Docker Hub reports **20,000+ pulls** for `cloudbyday90/classifarr` as of 2026-08-29. This beta line is positioned as stable and production-capable for self-hosted media library operators, with the Policy Builder Intent Model as its central routing experience.

## Why Classifarr

- Helps route requests across multiple libraries using policy-based decisions.
- Reduces manual sorting by automatically handling high-confidence items.
- Keeps low-confidence and ambiguous cases in a review flow, including Discord policy-driven clarification questions.
- Includes queue, retry, and logging tools to support day-to-day operations.
- Supports local, cloud, and hybrid AI/RAG deployments.
- Provides feedback and tuning workflows to improve routing over time.
- Built on a hardened PostgreSQL foundation: 64-bit IDs, query profiling, HNSW index pre-warming, crash-safe visibility timeouts, and automatic database maintenance — ready for long-running production deployments.

## Features

Classifarr is a full operations platform for classification, routing, review, and continuous tuning.

### 1. Classification and Decisioning

- Policy-driven routing for movie and TV requests with confidence scoring.
- Human-in-the-loop handling for low-confidence cases (pending decisions and clarifications).
- Classification history with profile snapshots and correction workflows.
- Manual request submission plus direct classify/reclassify endpoints.

### 2. Policy and Preset Management

- Policy Builder workflow for creating and maintaining routing rules.
- Built-in Presets catalog plus My Presets, both available for policy-level assignment.
- Pattern discovery and pattern approval/rejection workflows.
- Policy feedback and tuning suggestions with impact views.

### 3. Command Center and Observability

- Command Center home for queue health, alerts, retries, and actions.
- Live queue stats, failed/pending views, and bulk recovery controls.
- Detailed logs module with filtering, export, resolve, cleanup, and clear actions.
- System health views for dependencies (database, media servers, AI, metadata providers).

### 4. Library and Media Orchestration

- Media server ingestion and sync support for Plex, Jellyfin, and Emby.
- Library mappings to Radarr/Sonarr instances, root folders, and quality profiles.
- Path mapping and path translation verification for host/container/NAS layouts.
- Reclassification batch engine with validate, execute, pause/resume, retry, and skip.

### 5. AI and Provider Routing

- Local and cloud classification providers: Ollama, OpenAI, Gemini, OpenRouter, LiteLLM, custom endpoints.
- Provider status checks, model discovery, test actions, and warmup controls.
- AI usage tracking and budget visibility for operational control.
- Provider lock and fallback-aware behavior for resilience.

### 6. RAG and Embeddings

- Separate RAG settings for text and image embeddings.
- Text embedding modes for local, cloud, and split-provider deployments.
- Image embedding support via local image embedding service and cloud providers.
- Backfill orchestration: manual, scheduled, idle-time, and real-time options.
- RAG health, circuit breaker status, migration tooling, and metrics/export endpoints.

### 7. Integrations and Automation

- Webhook listener endpoints for Overseerr/Jellyseerr style integrations.
- Webhook configuration management with generated Authorization Header secrets.
- API keys for automation with route-level permission enforcement.
- Notification center plus Discord integration, including policy-driven questions and response handling.

### 8. Security and Access Control

- JWT auth with session controls (list/revoke sessions, logout-all).
- CSRF protection for cookie-authenticated write routes.
- Route guards for admin vs read-write vs read-only capabilities.
- Runtime security knobs for cookies, CORS, and transport expectations.

### 9. Operations and Lifecycle

- Setup wizard and first-run admin account creation.
- Backup export/import, preview, download, and cleanup flows.
- Migration dashboard and migration APIs for legacy rule movement.
- Scheduler for recurring sync, queue, enrichment, and maintenance tasks.

## Engineering Guardrail: Metadata Lists

Provider and persisted metadata for list-like fields such as `genres`, `keywords`, `tags`, and `collections` is not shape-stable. It may arrive as:

- `['Documentary']`
- `[{ name: 'Documentary' }]`
- `[{ tag: 'Documentary' }]`
- JSON-stringified arrays

When working in `server/src`, do not parse or lowercase these fields ad hoc. Route them through [`server/src/utils/metadataNormalization.mjs`](server/src/utils/metadataNormalization.mjs):

- `normalizeMetadataList(...)`
- `normalizeMetadataListLower(...)`
- `coerceMetadataArray(...)`

This avoids silent false negatives in classification, prompt building, learning, migration, and pattern discovery paths. The server code-health suite now fails new raw `JSON.parse(...genres|keywords|tags|collections...)` and direct `metadata.<field>.map(...toLowerCase())` patterns so regressions are caught in CI.

## Classification Flow

<p align="center">
  <img src="./docs/assets/issue-262-classification-flow-v042.svg" alt="Classifarr classification flow diagram" width="1100" />
</p>

Direct diagram link: [`docs/assets/issue-262-classification-flow-v042.svg`](docs/assets/issue-262-classification-flow-v042.svg)

## Quick Start (Docker Compose)

Use this baseline compose:

```yaml
services:
  classifarr:
    image: ghcr.io/cloudbyday90/classifarr:latest
    container_name: classifarr
    user: "1000:1000"
    ports:
      - "21324:21324"
    environment:
      PUID: 1000
      PGID: 1000
      TZ: America/New_York
      FORCE_SECURE_COOKIES: "false"
      CORS_ORIGIN: ""
      PGVECTOR_RUNTIME_STAGING: "auto"
    volumes:
      - ./data:/app/data
      - /path/to/media:/data/media:rw
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/run/postgresql:rw,noexec,nosuid,nodev,uid=1000,gid=1000,mode=770
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETUID
      - SETGID
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Start:

```bash
docker compose up -d
```

For local source builds from this repo, prefer the smart wrapper so the pgvector build matches the host CPU before the read-only container starts:

```bash
npm run docker:smart:up
```

When a clean local checkout must produce a provenance-verified image for
maintenance evidence, use the noninteractive no-cache rebuild instead. It
derives the image revision from Git, recreates Classifarr, and waits for health:

```bash
npm run docker:smart:provenance-rebuild
```

Open:

- `http://localhost:21324`

## Compose Notes (Important)

- `./data:/app/data` is required for database persistence and generated runtime settings.
- `/path/to/media:/data/media:rw` is required for re-classification move operations.
- `PUID` and `PGID` are used by the container entrypoint to align ownership with NAS and host permissions.
- `read_only: true` makes the container root filesystem immutable; writable paths are provided via volumes and `tmpfs`.
- `PGVECTOR_RUNTIME_STAGING=auto` lets Classifarr stage a `vector.so` symlink to the immutable image-layer AVX/AVX2 pgvector binary when supported. The PostgreSQL runtime tmpfs stays `noexec`, so startup avoids the earlier copy-and-execute failure mode on Unraid and other hardened Docker hosts.
- Set `PGVECTOR_RUNTIME_STAGING=disabled` only if you want to force the image-layer generic pgvector binary.
- Compose healthcheck is intentionally omitted for a lean file. The Docker image still has an internal `HEALTHCHECK` instruction.

## Required and Recommended Inputs

Required:

- TMDB API key.
- Media server and Radarr/Sonarr mappings.
- A valid `/data/media` bind mount for move operations.

Recommended:

- OMDb API key for richer enrichment.
- AI provider configuration for model-assisted classification.

## AI Provider Strategy (Classification)

Classifarr supports both local and cloud classification providers:

- `ollama` (local, no per-token cloud cost).
- `openai`, `gemini`, `openrouter`, `litellm`, `custom` (cloud/API providers).
- `anthropic` models are supported via `openrouter`, `litellm`, or `custom` endpoint routing.
- Optional Ollama fallback can be enabled when primary provider is cloud.

Practical recommendation:

- Local-first/self-hosted default: use `ollama` as the primary classification provider.
- Cloud-first: use your cloud provider as primary and enable Ollama fallback for resilience/cost control.

### Cloud Provider Recommendations

Use this as a practical selection guide:

| Provider Path | Best For | Notes |
|---|---|---|
| `openai` | Highest consistency for strict JSON/structured classification output | Good default when you want reliability first |
| `gemini` | Best value/latency balance for always-on classification | Strong cost/performance profile for medium/large libraries |
| `openrouter` | Fast model switching across vendors | Best when you want one key and rapid experimentation |
| `litellm` / `custom` | Teams running a gateway/proxy across multiple providers | Best for centralized policy, routing, and enterprise-style controls |
| `anthropic` (via OpenRouter/LiteLLM/Custom) | Conservative, safety-oriented reasoning style | No direct Anthropic selector in Settings today; route Claude through proxy-compatible paths |

Model selection strategy:

- Start with each provider's fast/mini tier model for day-to-day classification.
- Move to higher-tier models only if your misclassification rate remains high.
- Prefer stable model IDs for production and test newer models in staging first.

Pricing note:

- Provider pricing and model catalogs change frequently. Use provider dashboards for live cost checks before locking budgets.

## Local Verification

- Root lint: `npm run lint`
- Server lint: `npm --prefix server run lint:tests` and `npm --prefix server run lint:security`
- Client lint: `npm --prefix client run lint`
- Root tests: `npm test`
- Root coverage: `npm run test:coverage`

### Ollama Local Recommendations (AI + RAG Text)

Source catalog:

- <https://ollama.com/search>

Local cost model:

- No per-token API billing.
- Tradeoff is local hardware utilization (VRAM/RAM), latency, and throughput.

#### Local AI (Classification) Picks

| Profile | Recommended model(s) | Why |
|---|---|---|
| Low-resource local host | `qwen3:4b`, `gemma3:4b` | Good speed on smaller hardware with acceptable quality |
| Best overall default | `qwen3:8b`, `llama3.1:8b` | Strong quality/speed balance for routine classification |
| Hard edge-case reasoning | `deepseek-r1:14b`, `qwen3:14b` | Better reasoning on ambiguous metadata, but slower |
| Premium local quality | `qwen3:32b` (or larger) | Highest local quality when hardware allows |

#### Local RAG Text Embedding Picks

| Profile | Recommended model(s) | Why |
|---|---|---|
| Best default | `nomic-embed-text` | Strong retrieval quality with efficient footprint |
| Higher-quality semantic retrieval | `mxbai-embed-large` | Better retrieval precision at higher compute cost |
| Multilingual-heavy libraries | `bge-m3`, `qwen3-embedding` | Better multilingual embedding behavior |
| Very lightweight | `all-minilm`, `embeddinggemma` | Fastest local embedding for constrained systems |

Quick start pulls:

```bash
ollama pull qwen3:8b
ollama pull nomic-embed-text
```

Classifarr settings pattern:

1. Set AI provider to `ollama` and choose your generation model.
2. In RAG Text Embeddings, set mode to `same` (or `separate_ollama` for a dedicated embedding instance).
3. Choose an embedding model such as `nomic-embed-text` or `mxbai-embed-large`.

#### Ollama Recommendations by GPU VRAM

Use these as practical starting points for local deployments.

Important:

- Model file size is not the full runtime memory footprint.
- You need headroom for KV cache/context, concurrent requests, and background system load.
- For stability, target model size at roughly 60-75% of available VRAM.
- Use Q4/Q5 quantizations for best fit on consumer GPUs; higher quantizations need more VRAM.

| GPU VRAM | Example GPUs | Recommended local AI model | Fallback model (if OOM/slow) | Why this is the default pick |
|---|---|---|---|---|
| 4 GB | GTX 1650, RTX 3050 (4GB), RX 6400 | `qwen3:4b` (2.5GB) | `gemma3:4b` (3.3GB) | Best fit with enough headroom for stable inference on low-VRAM cards |
| 8 GB | RTX 3060 Ti, RTX 4060 Laptop, RX 7600 | `qwen3:8b` (5.2GB) | `llama3.1:8b` (4.9GB) | Best quality-to-speed default for routine Classifarr classification |
| 12 GB | RTX 3060 12GB, RTX 4070 Super, RX 7700 XT | `gemma3:12b` (8.1GB) | `qwen3:8b` (5.2GB) | Uses available VRAM efficiently while preserving practical context headroom |
| 16 GB | RTX 4060 Ti 16GB, Arc A770 16GB, RX 7800 XT | `qwen3:14b` (9.3GB) | `gemma3:12b` (8.1GB) | Better reasoning than 8B class with good operational headroom |
| 24 GB | RTX 3090, RTX 4090 | `qwen3:30b` (19GB) | `qwen3:14b` (9.3GB) | Premium local quality while leaving safer room than 20GB+ alternatives |
| 48 GB+ | RTX A6000, L40S, H100/H200 class | `qwen3:32b` (20GB) | `qwen3:30b` (19GB) | Strong highest-quality general default; extra VRAM can be used for concurrency/context |

| GPU VRAM | RAG text embedding recommendation | Fit guidance |
|---|---|---|
| 4 GB | `nomic-embed-text` (274MB) | Safest default; leaves headroom for system and app workloads |
| 8 GB | `nomic-embed-text` or `mxbai-embed-large` (670MB) | Both run comfortably; choose by retrieval quality preference |
| 12 GB | `mxbai-embed-large`, `bge-m3`, `qwen3-embedding` | Room for better multilingual retrieval without pressure |
| 16 GB+ | `bge-m3` or `qwen3-embedding` with higher concurrency | Better when indexing large libraries or running parallel jobs |

Model size references above are from Ollama library pages (Q4 variants shown in Ollama details).

### Current Model Picks (As of 2026-02-25)

These picks are optimized for Classifarr's workload: structured JSON classification, high request volume, and occasional hard edge-case reasoning.

| Task | Best value | Best quality | Why |
|---|---|---|---|
| Daily automated classification | `gemini-2.5-flash-lite` or `gpt-5-mini` | `gpt-5.1` or `claude-sonnet-4-6` | Most items are routine; use low-cost fast models by default, escalate only when needed |
| Ambiguous/edge-case routing | `gemini-2.5-flash` | `gpt-5.1` / `claude-sonnet-4-6` / `claude-opus-4-6` | Better reasoning and instruction-following on conflicting metadata |
| Very high-throughput, lowest cost | `gpt-5-nano` or `gemini-2.5-flash-lite` | N/A | Best when you prioritize throughput and low spend over absolute quality |
| Premium "one-shot" difficult items | N/A | `claude-opus-4-6` | Best for hardest multi-step cases, highest cost tier |

### Price-to-Performance Reference (Text Models)

Prices are per 1M tokens (input/output), using provider-published pricing.

| Provider | Model | Price | Best for in Classifarr |
|---|---|---|---|
| OpenAI | `gpt-5-mini` | $0.25 / $2.00 | Best OpenAI default for cost/quality balance |
| OpenAI | `gpt-5.1` | $1.25 / $10.00 | Higher-accuracy difficult classifications |
| OpenAI | `gpt-5-nano` | $0.05 / $0.40 | Ultra-cheap high-volume simple tasks |
| Google Gemini | `gemini-2.5-flash-lite` | $0.10 / $0.40 | Lowest-cost Gemini option for routine requests |
| Google Gemini | `gemini-2.5-flash` | $0.30 / $2.50 | Strong default blend of quality, latency, and cost |
| Google Gemini | `gemini-2.5-pro` | $1.25 / $10.00 (<=200k prompt) | Hard reasoning/coding-style edge cases |
| Anthropic | `claude-haiku-4-5` | starts at $1 / $5 | Fast, cheaper Claude path |
| Anthropic | `claude-sonnet-4-6` | starts at $3 / $15 | Best Anthropic balance (recommended Claude tier) |
| Anthropic | `claude-opus-4-6` | starts at $5 / $25 | Highest-capability Claude tier |

### Text Embedding Recommendations (As of 2026-02-25)

Use these defaults for Classifarr RAG unless you have a specific retrieval failure pattern:

| Scenario | Best value | Best quality | Notes |
|---|---|---|---|
| General movie/TV semantic retrieval | `text-embedding-3-small` | `text-embedding-3-large` | Strong default quality/cost for most libraries |
| Multilingual libraries | `gemini-embedding-001` | `voyage-4` / `voyage-4-large` | Better cross-language retrieval behavior |
| Code/technical-heavy corpora | `voyage-code-3` | `voyage-code-3` | Specialized for code retrieval |
| Local-only / no cloud spend | `nomic-embed-text` | `mxbai-embed-large` | Run in `separate_ollama` mode |

### Text Embedding Price-to-Performance

Prices below are provider-published rates and units:

| Provider | Model | Price | Unit | Typical Classifarr use |
|---|---|---|---|---|
| OpenAI | `text-embedding-3-small` | $0.02 | per 1M input tokens | Best default cost/performance |
| OpenAI | `text-embedding-3-large` | $0.13 | per 1M input tokens | Highest OpenAI retrieval quality |
| OpenAI | `text-embedding-ada-002` | $0.10 | per 1M input tokens | Legacy compatibility only |
| Gemini | `gemini-embedding-001` | $0.15 ($0.075 batch) | per 1M input tokens | High-quality multilingual with tunable output dimensionality |
| Voyage AI | `voyage-4-lite` | $0.02 | per 1M tokens | Lowest-cost Voyage text embedding |
| Voyage AI | `voyage-4` | $0.06 | per 1M tokens | Balanced quality/cost for retrieval |
| Voyage AI | `voyage-4-large` | $0.12 | per 1M tokens | Highest Voyage general retrieval quality |
| Cohere | `embed-v4.0` | See Cohere pricing page | provider pricing units | Modern Cohere text/multimodal embedding path |
| Ollama (local) | `nomic-embed-text`, `mxbai-embed-large`, `bge-m3`, `all-minilm` | API cost = $0 | local compute | Best when privacy and predictable cost matter most |

### Text Embedding Task Mapping

| Task | Recommended model |
|---|---|
| Default first deployment | `text-embedding-3-small` or local `nomic-embed-text` |
| Highest retrieval quality | `text-embedding-3-large` or `voyage-4-large` |
| Budget-constrained large backfills | `text-embedding-3-small`, `voyage-4-lite`, or local `all-minilm` |
| Multilingual catalog focus | `gemini-embedding-001` or `voyage-4` |

Operational notes:

- Changing embedding model or dimensionality can require re-embedding existing vectors.
- Keep one embedding family stable per library where possible to reduce retrieval drift.
- If you run cloud classification, using local Ollama embeddings is still a strong cost-control pattern.

### Classifarr-Specific Recommendations

1. Start with one of:
   `gpt-5-mini`, `gemini-2.5-flash`, or `claude-sonnet-4-6` (via OpenRouter/LiteLLM/custom).
2. If monthly cost is the primary constraint:
   prefer `gemini-2.5-flash-lite` or `gpt-5-nano`.
3. If quality on tricky metadata is the primary constraint:
   move to `gpt-5.1` or `claude-sonnet-4-6`.
4. Keep embeddings cost-efficient first:
   use `text-embedding-3-small` (or local Ollama embeddings) before moving to higher-cost embedding tiers.

### Anthropic in Current UI

- Classifarr currently does not expose a direct `anthropic` provider selector in Settings -> AI.
- Use Claude models through:
  `openrouter`, `litellm`, or `custom` OpenAI-compatible gateway paths.
- Example model IDs for those routes:
  `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-6`.

## RAG Provider Strategy (Embeddings)

RAG and embeddings are configured separately from classification in Settings -> RAG & Embeddings.

Text embeddings modes:

- `same`: use the same provider path as classification.
- `separate_ollama`: use a dedicated Ollama embedding endpoint/model.
- `cloud`: use cloud embedding providers (`openai`, `gemini`, `voyage`, `openrouter`, `cohere`).

Image embeddings modes:

- `disabled` (default and valid).
- `separate_local`: use a dedicated local image embedding service.
- `cloud`: use cloud image embedding providers (`vertex`, `voyage`, `cohere`).

### Local Image Embedding Service (Recommended)

For local/self-hosted image embeddings, use:

- [`cloudbyday90/classifarr-image-embedding-service`](https://github.com/cloudbyday90/classifarr-image-embedding-service)

Classifarr-compatible API contract:

- `GET /health`
- `GET /ready`
- `GET /models`
- `POST /embed-image`

Current health behavior:

- `GET /health` confirms the service is reachable.
- `GET /ready` is used when available to distinguish warmup from full readiness.
- A reachable sidecar that is still loading its default model is surfaced as `degraded` rather than fully `connected`.

Minimal compose example:

```yaml
services:
  image-embedder:
    image: ghcr.io/cloudbyday90/classifarr-image-embedder:latest
    container_name: image-embedder
    ports:
      - "8000:8000"
    restart: unless-stopped
```

Then in Classifarr:

- Settings -> RAG & Embeddings -> Image Embeddings
- Mode: `separate_local`
- Host: `image-embedder` (same compose network) or `host.docker.internal` (cross-container host access)
- Port: `8000`

#### Securing the sidecar with an API key

The sidecar supports optional API key authentication. When `REQUIRE_API_KEY=true` (the default in the sidecar's reference configuration), all `/embed-image` and `/models` requests must carry a valid `X-Api-Key` header. Classifarr handles this automatically once you paste the key into Settings.

**One-time setup:**

1. On the machine running the sidecar, generate a key:
   ```bash
   python scripts/generate_env.py
   ```
   This writes a random `SERVICE_API_KEY` to the sidecar's `.env` file and prints it to stdout. The key is never committed to source control.

2. Copy the printed `SERVICE_API_KEY` value.

3. In Classifarr: **Settings → RAG & Embeddings → Image Embeddings → Sidecar API Key** — paste the key and save.

Classifarr encrypts the key at rest. If you rotate the sidecar key, re-run `generate_env.py`, restart the sidecar, and update the field in Classifarr Settings.

If the key is wrong or missing and `REQUIRE_API_KEY=true`, the sidecar returns `401`. Classifarr logs `[EMBED_AUTH_FAIL]` and will not retry the request automatically. Correct the key in Settings and the circuit resets immediately — no restart required.

To use the sidecar **without** authentication, set `REQUIRE_API_KEY=false` in the sidecar's `.env` and leave the Sidecar API Key field in Classifarr empty.

### Cloud Image Embeddings: Availability

Yes, cloud image embedding providers do exist, and Classifarr currently supports:

- Vertex AI image embeddings (model path defaults to `multimodalembedding@001`)
- Voyage multimodal embeddings (default `voyage-multimodal-3.5`)
- Cohere image embeddings via `embed` API (`embed-english-v3.0` or `embed-multilingual-v3.0`)

Practical guidance:

- Start with `separate_local` for predictable cost/privacy.
- Move to cloud only if you need managed scale or provider-specific quality characteristics.

Practical recommendation:

- Best default: text embeddings enabled, image embeddings disabled initially.
- If classification is cloud and you want lower cost, set text embeddings to `separate_ollama`.
- Enable image embeddings only after text embeddings are stable and backfill is healthy.

Important:

- Changing embedding mode/model can require re-embedding to keep vectors consistent.

## Local HTTP vs HTTPS

For local/LAN HTTP deployments:

- Keep `FORCE_SECURE_COOKIES=false`.
- Keep `CSRF_PROTECTION=true` (recommended; it works on local HTTP).
- Keep `CORS_ORIGIN` empty unless you need a stricter browser allowlist.
- Keep `ENFORCE_HTTPS_HEADERS=false` (default). In this mode Classifarr keeps standard security headers but does not emit COOP/OAC browser isolation headers that generate warnings on plain HTTP LAN IPs.
- `FORCE_SECURE_COOKIES` is optional. If enabled but requests arrive over HTTP, Classifarr falls back to non-secure cookies to avoid lockouts.

For public or HTTPS deployments:

- Set `FORCE_SECURE_COOKIES=true`.
- Keep `CSRF_PROTECTION=true`.
- Keep `SECURITY_HEADERS_STRICT=true`.
- Set explicit `CORS_ORIGIN` allowlist values.
- Optional: set `ENFORCE_HTTPS_HEADERS=true` if you want Classifarr itself to emit HSTS, CSP HTTPS-upgrade headers, and COOP/OAC browser isolation headers.

## Runtime Settings (Auto-generated)

In Docker deployments, Classifarr auto-creates this file if it does not exist:

- `/app/data/config/runtime.json`

Runtime precedence:

1. DB/UI setting
2. Runtime JSON
3. Environment variable
4. Built-in default

Reference:

- [`docs/runtime-settings.example.json`](docs/runtime-settings.example.json)

Current runtime keys:

- `force_secure_cookies`
- `csrf_protection`
- `cors_origin`
- `omdb_request_timeout_ms`
- `omdb_retry_timeout_multiplier`
- `omdb_max_request_timeout_ms`
- `omdb_max_retries`
- `omdb_ssl_warn_throttle_ms`

Default values in generated `runtime.json`:

```json
{
  "force_secure_cookies": false,
  "csrf_protection": true,
  "cors_origin": "",
  "omdb_request_timeout_ms": 30000,
  "omdb_retry_timeout_multiplier": 2,
  "omdb_max_request_timeout_ms": 60000,
  "omdb_max_retries": 3,
  "omdb_ssl_warn_throttle_ms": 900000
}
```

Security note:

- Empty `cors_origin` means "allow all origins." This is local-friendly but not recommended for internet-exposed deployments.

## CORS_ORIGIN Guidance

Examples:

- Single origin: `CORS_ORIGIN=https://classifarr.example.com`
- Multiple origins: `CORS_ORIGIN=https://classifarr.example.com,https://ops.example.com`
- Local relaxed mode: `CORS_ORIGIN=` (empty)

Production behavior:

- CORS restriction is opt-in. Leave `CORS_ORIGIN` empty to allow all origins, or set it explicitly to enforce an allowlist.

## First-Time Setup Order

1. Create the admin account.
2. Configure media server and Radarr/Sonarr mappings.
3. Configure TMDB and OMDb keys.
4. Configure AI provider and any budget controls.
5. Optionally configure Discord integration.
6. Validate queue and routing from Command Center.

## Daily Operations

1. Open Command Center.
2. Clear `Alerts`.
3. Resolve `Needs Attention` items.
4. Retry actionable `Errors`.
5. Verify enrichment progress and retry queue state.
6. Use `/history` for audit and reclassification checks.

Synchronized inventory and observed library profiles provide evidence for library
understanding and future automation. See the [inventory-driven direction](docs/architecture/library-observation-automation-direction.md).
Stored profiles and live AI statistics now share item-based percentages and
explicit metadata coverage. Profile pages show known and missing counts; an
absent trait does not establish a library restriction. Existing profiles receive
an automatic refresh after upgrading. See the
[profile observation design](docs/architecture/library-profile-observation-design.md)
and [measured outcome](docs/architecture/library-profile-observation-outcome.md).
The existing background worker also refreshes active libraries when inventory
membership or observed metadata changes, including libraries without policies.
Unchanged syncs need no regeneration, and empty libraries lose obsolete profiles.
Inactive libraries retain pending changes until reactivated. See the
[automatic refresh design](docs/architecture/inventory-profile-refresh-design.md)
and [refresh validation](docs/architecture/inventory-profile-refresh-outcome.md).
Configured TMDb enrichment now automatically fills provider keywords and original
language for identified inventory items. Source tags remain separate, and missing
language stays unknown. Successful observations are reused for 30 days; failed
requests retry after six hours. Identity changes invalidate prior traits. See the
[metadata provenance design](docs/architecture/inventory-metadata-provenance-design.md)
and [32-item local assessment](docs/architecture/inventory-metadata-provenance-outcome.md).
Resolved IDs now survive source omissions when recorded provenance and source
continuity agree. Changed identities discard stale enrichment and recover through
the existing queue. See the [retention design](docs/architecture/resolved-identity-sync-retention-design.md)
and [validation outcome](docs/architecture/resolved-identity-sync-retention-outcome.md).
Rating, metadata and history writes also verify the captured source before
accepting a provider result, including changes during network waits. See the
[write-guard design](docs/architecture/enrichment-source-write-guards-design.md)
and [local validation](docs/architecture/enrichment-source-write-guards-outcome.md).
The Libraries page automatically compares shared movie and TV identities and
common traits across active libraries. Both overlap directions show their
denominators; duplicate placements count once, and missing or conflicting traits
remain unknown. Bounded reads disclose excluded libraries and withhold comparisons
when the inventory limit is exceeded. See the
[overlap design](docs/architecture/library-overlap-design.md) and
[measured outcome](docs/architecture/library-overlap-outcome.md).
An automatic observation-health summary also shows known keywords and original
language, fresh captures, missing identities and retry backoff. Valid empty
captures and unavailable metadata remain explicit. Queue activity does not imply
capture success. See the
[health design](docs/architecture/library-observation-health-design.md) and
[local validation](docs/architecture/library-observation-health-outcome.md).
Malformed observations repair automatically after cooldown using the full
attributable observation validator. Bounded background passes advance past fresh
records, while valid empty captures remain cached. See the
[repair design](docs/architecture/inventory-observation-repair-design.md) and
[validation outcome](docs/architecture/inventory-observation-repair-outcome.md).
Acquisition outcomes and library coverage history are also recorded automatically.
Libraries shows captured and unavailable attempts alongside bounded coverage
samples, with explicit populations and a seven-day window. See the
[history design](docs/architecture/observation-acquisition-history-design.md) and
[measured outcome](docs/architecture/observation-acquisition-history-outcome.md).
Automatic coverage visits one active library every five minutes, progressing
through the catalog without manual schedules. Each visit measures up to 20,000
rows; larger libraries resume on subsequent turns while smaller libraries remain
measurable. Inventory and observation-clock revisions guard every page. Changed
inputs restart the scan automatically, and partial counts remain distinct from
complete coverage. Freshness uses the scan's stated start time. Trends compare
complete scans, with deltas withheld after population changes or sampling gaps. Current
library names label bounded counts; private fingerprints never reach the browser.
Local pagination and expandable tables show retained visits, with earlier hourly
coverage separately identified. Revisit time grows with the active library count.
Immediate health and overlap summaries retain their existing scope. See the
[incremental design](docs/architecture/incremental-library-coverage-design.md) and
[validation outcome](docs/architecture/incremental-library-coverage-outcome.md).
Manual identity review handles unresolved exceptions.

For unresolved inventory identities, open **Libraries → Review media IDs** with
an administrator session. Enter a TMDb ID, compare the typed provider preview
with the source, and explicitly confirm the match. The preview expires after ten
minutes; changed source items require a fresh review. Confirmation records an
audit receipt and fills the missing ID without starting classification.
If the save response is lost, the page checks for the original administrator's
receipt without resending confirmation. It retains a minimal recovery reference
in the current tab for reloads. An unknown outcome offers **Check receipt again**;
it does not establish that the save failed. Use the same administrator account.
See the [design and tradeoffs](docs/architecture/media-identity-review-design.md)
and [validation outcome](docs/architecture/media-identity-review-outcome.md), plus
the [receipt recovery design](docs/architecture/media-identity-receipt-recovery-design.md)
and [recovery outcome](docs/architecture/media-identity-receipt-recovery-outcome.md).

## API, Auth, and Integrations

Swagger UI:

- `http://localhost:21324/api/docs`

Authentication model:

- Web UI: cookie-based session auth.
- Cookie-authenticated write requests: CSRF header required.
- Automation/API clients: `X-API-Key` (no CSRF required for API-key auth).

Common endpoints:

- `GET /api/libraries`
- `POST /api/media-server/sync`
- `GET /api/classification/pending`
- `POST /api/classification/pending/:id/resolve`
- `GET /api/classification/history`
- `GET /api/queue/live-stats`

API docs:

- `docs/api/README.md`
- `docs/api/authentication.md`
- `docs/api/classification.md`
- `docs/api/libraries.md`
- `docs/api/media-sync.md`
- `docs/api/policies.md`
- `docs/api/system.md`
- `docs/api/webhooks.md`

## Webhook Integration Notes

For Overseerr/Jellyseerr webhook setup:

- Use the webhook endpoint shown in Settings -> Webhooks.
- Use the generated Authorization Header value from the same page.
- Authorization Header is masked by default.
- `Unmask` reveal uses an inactivity auto-remask timer (default 60 seconds).
- `Regenerate` rotates the header and invalidates the previous one.

## OMDb Behavior and Tuning

OMDb calls use runtime-configurable timeout and retry behavior.

Current default behavior:

- Base request timeout: `30000ms`
- Retry timeout multiplier: `2`
- Max timeout cap: `60000ms`
- Max retries: `3`

Operational notes:

- Transient OMDb timeouts are logged as warnings and retried.
- Retry queue stale processing rows are auto-recovered.
- Retry queue rows already enriched are auto-resolved to prevent inflated pending counts.

## Database Tuning

| Variable | Default | Effect |
|---|---|---|
| `POSTGRES_SLOW_QUERY_THRESHOLD_MS` | `500` | Queries exceeding this threshold (ms) emit a `[SLOW QUERY]` warning with elapsed time and query text. Lower on fast NVMe storage; raise on spinning disk or NAS. Set to `-1` to disable. |
| `POSTGRES_CONN_TIMEOUT_MS` | `5000` | Pool connection acquisition timeout (ms). |
| `POSTGRES_STATEMENT_TIMEOUT_MS` | `30000` | Per-query statement timeout (ms). Kills runaway queries server-side. |

## Upgrade Notes for Existing Deployments

- Existing compose files continue to work.
- You do not need to add every new environment variable to get the new behavior.
- New runtime keys are auto-added to `/app/data/config/runtime.json` when missing.
- You should still update compose over time for security hardening and documentation parity.

## Development

Install dependencies:

```bash
npm install
npm --prefix server install
npm --prefix client install
```

Note: the server and client are already ESM-native (`"type": "module"`), so the remaining work is cleanup and compatibility hardening rather than a package-format flip. The server install still runs temporary `postinstall` compatibility patches in [server/scripts/patch-jest-changed-files.mjs](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/scripts/patch-jest-changed-files.mjs). One patch lets `jest-changed-files` work with the newer ESM `execa@9` line, and the other lets `archiver@7.0.1` work with `zip-stream@7` by unwrapping the ESM default export in its CommonJS ZIP plugin. Remove the related overrides in [server/package.json](c:/Users/Moreland/Repositories/Classifarr/Classifarr/server/package.json) and the install-time patches once upstream Jest and Archiver publish compatible releases.

Note: the client install still runs a temporary `postinstall` patch in [client/scripts/patch-eslint-config-loader.mjs](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/scripts/patch-eslint-config-loader.mjs). It replaces ESLint's internal `find-up` based flat-config lookup with a local filesystem ascent helper and swaps ESLint's `escape-string-regexp` usage to native `RegExp.escape`, so the client can use the newer ESM `find-up@8` and `escape-string-regexp@5` lines without relying on CommonJS interop in ESLint internals. Remove the related overrides in [client/package.json](c:/Users/Moreland/Repositories/Classifarr/Classifarr/client/package.json) and the install-time patch once upstream ESLint natively migrates those paths.

ESM/native-support backlog for the next tranche:

1. Continue normalizing ESM Jest suites so mocks only expose symbols actually imported at runtime (remove synthetic `default` wrappers where production imports named exports).
2. Extract repeated ESM mock-construction patterns in server tests into shared helper factories (for example, small typed/named service-module builders) to reduce drift and dead wrapper reintroduction.
3. Audit remaining install-time compatibility patches (`server/scripts/patch-jest-changed-files.mjs`, `client/scripts/patch-eslint-config-loader.mjs`) against upstream releases and remove overrides as soon as native upstream paths are available.
4. Enforce strict native-import hygiene in CI by expanding the static-import check and adding a targeted guard for test-side synthetic default-wrapper mocks that are not required by runtime imports.

Current status: cookie-security wrapper cleanup and the latest ESM mock-shape cleanup tranche are done, CI includes a multiline-aware guard for synthetic named-service default-wrapper test mocks (`npm run esm:check-test-mock-shapes`, baseline currently 0), strict-mode scanning for any named+default synthetic wrappers is available (`npm run esm:check-test-mock-shapes:strict`) with optional category summaries (`npm run esm:report-test-mock-shapes:strict:summary`), strict backlog is currently 0 candidates after burning down logger/auth/service/config/builtin/external categories, shared `createNamedServiceStub(...)` helper extraction is now in use across route/integration suites to reduce mock drift, CI emits JSON artifact reports via `npm run esm:report-test-mock-shapes:artifact` and `npm run esm:report-test-mock-shapes:strict:artifact` and uploads both in GitHub Actions, and the current server/client dependency check returned no outdated packages from the locked graph.

Run locally:

```bash
npm --prefix server run dev
npm --prefix client run dev
```

Build frontend:

```bash
npm --prefix client run build
```

## Testing and Quality Gates

Full tests:

```bash
npm test
```

Coverage:

```bash
npm run test:coverage
```

Server integration tests:

```bash
npm --prefix server run test:integration
```

Security and docs checks:

```bash
npm --prefix server run lint:security
npm run lint:docs
npm run lint:docs:rag-api
```

CI-aligned run:

```bash
npm run test:ci
```

## Troubleshooting

OMDb timeout warnings:

- External OMDb latency can cause intermittent timeout warnings.
- Confirm OMDb key validity and outbound connectivity.
- Tune runtime values in `runtime.json` before hardcoding deployment-wide env overrides.

`CSRF validation failed` on write actions:

- Refresh the browser session and retry.
- Ensure mutating requests are sent through the shared `@/api` client.
- Confirm cookie settings align with HTTP vs HTTPS deployment mode.

Webhook auth failures:

- Regenerate Authorization Header in Settings -> Webhooks.
- Re-save webhook settings after encryption-key changes.

## Documentation Index

Core:

- `docs/architecture/policy-engine.md`
- `docs/implementation_plan_webhook_authorization_header_unmask.md`
- `docs/implementation_plan_smart_rule_form_deprecation.md`

Security:

- `SECURITY.md`
- `docs/SECURITY_REVIEW.md`
- `docs/SECURITY_BENCHMARKS.md`
- `docs/security-fixes/ROUTE-auth-audit.md`

Operations:

- `docs/testing/coverage.md`
- `docs/maintenance.md`
- `docs/MIGRATION_SYSTEM.md`
- `docs/migrations.md`
- `docs/POSTGRESQL.md`
- `docs/nodejs-24-migration.md`

Setup:

- `PLEX_SETUP.md`
- `DISCORD_SETUP.md`
- `AUTHENTICATION.md`
- `unraid/README.md`

## Contributing

Contributors list: `CONTRIBUTORS.md`

For contribution proposals, include:

1. Problem statement
2. Reproduction details
3. Implementation scope

## License

GPL-3.0-or-later. See `LICENSE` for the canonical GPL text and `COPYRIGHT.md`
for the project copyright notice.
