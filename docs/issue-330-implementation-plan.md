# Issue #330 — Embedding Service Integration: Secure API Key Flow, Health Monitoring & Robust Error Handling

## Status: Complete — DB migrations, core service layer, embeddingRouter CB naming, aiSettingsHandlers encrypt/mask, discordBot.sendSystemAlert, healthCheckService transition detection, frontend (ImageEmbeddingsTab API key/timeout, Discord notify_on_system_errors, serviceStatus toasts), all tests, and README sidecar setup docs complete

### Implementation Progress

**Step 1 — Completed:** DB migrations, `circuitBreaker.js` foundation fixes (Gaps 3.20–3.22), tests.
**Step 2 — Completed:** `imageEmbeddingProvider.js` auth, circuit breaker, configurable timeout, error classification, RPS fix, tests.
**Step 3 — Completed:** Gap 3.22 for `embeddingCircuitBreaker.js` — `name: 'TextEmbedding'` added so the text-embedding circuit breaker logs under `[CircuitBreaker:TextEmbedding]` instead of the shared ambiguous tag. Note: the inline hand-rolled CB object from Gap 3.15 was already replaced with the shared class (`embeddingCircuitBreaker.js`) prior to this PR; `embeddingProvider.js` owns the full 3-step CB lifecycle internally, making `.run(fn)` wrapping at the router level redundant. The remaining meaningful work for section 5.11 is the `name` option, which is now done.
**Step 4 — Completed:** `aiSettingsHandlers.js` sidecar API key encrypt-on-save, decrypt+mask-on-read, audit log emission, `image_embedding_local_api_key` / `image_embedding_local_timeout_ms` added to INSERT/ON CONFLICT (now 60 params), + 5 new integration tests in `settings-ai-routes.test.js`. Suite: 216 suites / 7,213 tests.
**Step 5 — Completed:** Bug-fix `20260410_110000_add_discord_system_errors_flag.sql` (targeted `notification_config`, not non-existent `discord_config`); fixed `healthCheckService.js` Discord config query (same wrong table — now `SELECT bot_token FROM notification_config WHERE type = 'discord' LIMIT 1`); `discordSettingsHandlers.js` wires `notify_on_system_errors` through payload/INSERT/params (15 total); `discordBot.js` gains `sendSystemAlert(serviceKey, newStatus, previousStatus)` with 15-min per-service cooldown Map, recovery bypass, embed builder, and `notify_on_system_errors` gate; 10 new tests in `discordBot.alternatives.test.js` + `settings-discord-routes.test.js`. Suite: 216 suites / 7,223 tests.
**Step 6 — Completed:** `healthCheckService.js` — added `UNHEALTHY_STATUSES` set and `maybeSendHealthAlert(serviceKey, prev, next)` helper (first-poll silent for healthy, alertable for unhealthy; only fires on transitions involving an unhealthy status; normalises `'unknown'` → `null` for embed); wired via `try/catch/finally` in `checkImageEmbeddings()` so all code paths (including early returns and the outer catch) dispatch the alert; fixed silent outer catch (Gap 3.23) — now logs `logger.error('[HEALTH] Unexpected error in checkImageEmbeddings', ...)`. Updated `discordBot` mock in both test files to include `sendSystemAlert`. 5 new transition-alert tests. Suite: 216 suites / 7,228 tests.
**Step 7 — Completed:** Frontend: `ImageEmbeddingsTab.vue` — added `image_local_api_key` password field (sidecar auth) and `image_local_timeout_ms` number field (Performance section); wired both into `config` ref, `loadConfig()`, and `saveConfig()`. `Discord.vue` — added `notify_on_system_errors` checkbox with hint text; wired into config ref, load, and save. `serviceStatus.js` — added `_previousStatuses` ref, generic transition detection loop (`UNHEALTHY_STATUSES` set), and `useToast()` dispatch for unhealthy and recovery transitions across all service keys; imports `SERVICE_NAMES` for human-readable labels.
**Remaining:** none — all implementation and test items complete.

### Current State Snapshot (Already Landed Outside Issue 330 Proper)

The secure sidecar API key flow described in this plan has **not** been implemented yet. However, a few adjacent enhancements to the existing image-embedding path have already landed separately:

- Local image-embedding health now consults `/ready` when available and surfaces warmup as `degraded` instead of flattening every successful process check to `connected`.
- `checkImageEmbeddings()` now has a mode/config guard so non-local image-embedding modes do not generate false sidecar failures.
- `/api/system/health` image-embedding status is now mapped into `client/src/stores/serviceStatus.js`.
- Shared service consumers now recognize `imageEmbeddings` as a first-class service key and route users to the correct RAG & Embeddings settings surface.

Those changes improve observability for the feature as it exists today. The new work in this plan is still the secure sidecar credential flow, authenticated `/models` and `/embed-image` calls, timeout/config plumbing, and optional Discord/system-alert behavior.

---

## 1. Problem Statement

The local image embedding sidecar (`separate_local` mode) is currently called by `imageEmbeddingProvider.js` **with no authentication**. Any process that can reach the sidecar's port can call it. The sidecar has no way to verify that a request originated from Classifarr.

Additionally:
- There is no circuit breaker on outbound sidecar calls (only basic retry via `withRetry`).
- Health check polling (`checkImageEmbeddings`) does not send auth headers and does not propagate status changes to Discord.
- Timeouts are hardcoded.
- There is no UI surface to generate or copy the sidecar credential.

---

## 2. Sidecar Repository Analysis (`classifarr-image-embedding-service`)

The sidecar is a Python/FastAPI service. **Auth is already fully implemented on the sidecar side** — the entire remaining work is in Classifarr. Key findings:

### 2.1 Auth is Complete on the Sidecar (`security.py`)

```python
# security.py — constant-time API key comparison
async def verify_api_key(request, x_api_key, authorization):
    candidate = _extract_api_key(x_api_key, authorization)
    if not candidate or not hmac.compare_digest(candidate, settings.service_api_key):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
```

- Accepts `X-Api-Key` header or `Authorization: Bearer <key>` — Classifarr should use `X-Api-Key`.
- Configured via `SERVICE_API_KEY` env var (intentionally omitted from `config.toml` to prevent committing secrets).
- `REQUIRE_API_KEY` toggle (default `true` in `config.toml`); settable via env var for local dev.
- **Fail-closed**: if `REQUIRE_API_KEY=true` but `SERVICE_API_KEY` is not set, the sidecar returns `503` rather than silently allowing all requests.

### 2.2 Which Endpoints Require Auth

From `main.py`:

| Endpoint | Auth required | Notes |
|---|---|---|
| `GET /health` | **None** | Always public — for Docker/Kubernetes probes |
| `GET /ready` | **None** | Always public — for orchestrator readiness probes |
| `GET /models` | **Yes** | `Depends(auth)` |
| `POST /embed-image` | **Yes** | `Depends(auth)` + rate-limited |
| `POST /admin/cleanup` | **Always** | Protected even when `REQUIRE_API_KEY=false` |

This directly contradicts the gap identified as 3.6 below — **the health check poller does NOT need to send an auth header for `/health` or `/ready`**. Only `/models` and `/embed-image` calls need the key.

### 2.3 Rate Limiting

The sidecar enforces per-API-key rate limiting via `slowapi` (default: `30/minute`, configurable via `RATE_LIMIT_EMBED` in `config.toml` or env var). The current Classifarr default for `image_embedding_rps` is `2` req/sec = **120/minute**, which would immediately trigger the sidecar's default 30/minute limit. **This is a mismatch that needs to be resolved** — either lower the Classifarr default RPS or document that users must raise `rate_limit_embed` in the sidecar's `config.toml`.

### 2.4 `Retry-After` Header Already Emitted

When the sidecar's internal queue is full (429) or a request times out waiting in queue (504), it already emits:
- `Retry-After: <seconds>` (clamped to min 1)
- `X-Queue-Concurrency`, `X-Queue-In-Flight`, `X-Queue-Waiting`, `X-Queue-Max-Queue`, `X-Queue-Max-Wait-Seconds`

The Classifarr retry logic should parse `Retry-After` on 429 responses.

### 2.5 Rich `/health` and `/ready` Responses

The sidecar's `/health` returns device info, per-model load status, memory stats, and queue stats. The `/ready` endpoint specifically indicates model readiness (`ready: bool, default_model_loaded: bool`). Classifarr now polls `/ready` when available and uses it to distinguish warmup from readiness: service up but not ready → `degraded`; service up and ready → `connected`. The remaining gap is not readiness detection; it is secure authenticated traffic for `/models` and `/embed-image`, plus the broader operator workflow described below.

### 2.6 Key Setup Flow (from README)

The intended user flow documented in the sidecar README:
1. On the sidecar: run `python scripts/generate_env.py` → generates a `.env` containing a random `SERVICE_API_KEY`.
2. The script prints the key and instructs the user to copy it into Classifarr.
3. Start the sidecar with `docker compose up -d`.

The sidecar README mentions `IMAGE_EMBEDDER_API_KEY` as an env var alternative, but **this will not be implemented**. The canonical path is the Classifarr UI (Settings → RAG & Embeddings → Image Embeddings → Sidecar API Key field), which stores the key encrypted in `ai_provider_config`. No env var fallback. See open question 6.

### 2.7 `generate_env.py` on the Sidecar Side

The sidecar ships `scripts/generate_env.py` which auto-generates a cryptographically random `SERVICE_API_KEY` and writes it to `.env` (gitignored). This is the sidecar operator's setup tool. For Classifarr's part, the key generation happens in Classifarr Settings (not manually).

---

## 3. Existing Infrastructure to Leverage (Classifarr)

| Component | File | Notes |
|---|---|---|
| API key CRUD + encryption | `server/src/services/apiKeyService.mjs` | Full create/validate/reveal/audit; keys stored encrypted, revealable |
| Circuit breaker class | `server/src/services/circuitBreaker.mjs` | CLOSED/OPEN/HALF_OPEN; reusable `CircuitBreaker` class |
| Retry utility | `server/src/utils/retryUtils.mjs` | `withRetry` already used in `imageEmbeddingProvider.mjs` |
| Health check cache + poller | `server/src/services/healthCheckService.mjs` | `checkImageEmbeddings()` already polls `/health` and sets `previousStatus` in ALL code paths; 15-min heartbeat; `discordBotService` already imported — transition comparison and alert dispatch are the only missing pieces |
| Health surfaces in API | `server/src/routes/system.mjs` | `/api/system/health` and `/api/system/health/services` already include `imageEmbeddings` |
| Discord bot services | `server/src/services/discordBot.mjs` | `sendClassificationNotification` exists; no generic system alert yet |
| Encryption primitives | `server/src/utils/encryption.mjs` | `encryptValue`, `decryptValue`, `formatEncryptedValue` |
| Settings DB table | `ai_provider_config` | Already has `image_embedding_local_host/port/model` columns |
| Settings routes | `server/src/routes/helpers/aiSettingsHandlers.mjs` (mounted from `server/src/routes/settings.mjs`) | Manages `ai_provider_config` |
| Settings UI | `client/src/views/rag/ImageEmbeddingsTab.vue` | `separate_local` block (host/port/model); cloud block has the `type="password"` API key field pattern to mirror |

---

## 3. Gaps (What Is Missing)

### 3.1 No Auth on Sidecar Calls
`imageEmbeddingProvider.embedLocal()` posts to the sidecar without any `X-Api-Key` header:
```js
// Current — no auth
const response = await axios.post(`http://${host}:${port}/embed-image`, payload, { timeout: 15000 });
```
The sidecar will reject this with `401` when `REQUIRE_API_KEY=true` (the default). Same applies to `getLocalModels()` which calls `GET /models` — that endpoint also requires auth (see section 2.2).

### 3.2 ~~No `embed_service` Permission Type~~ — NOT A GAP
The sidecar credential is stored as an encrypted column directly in `ai_provider_config` (see Decision 1), so no new permission tier is needed in `apiKeyService.js`. The `api_keys` table is for credentials that external callers present *to* Classifarr — not for outbound service credentials.

### 3.3 No DB Column for Sidecar API Key
`ai_provider_config` has no column for the sidecar credential. A new `image_embedding_local_api_key TEXT` (nullable, stored encrypted via `encryptValue`) column is required — consistent with how `image_embedding_cloud_api_key` is stored for cloud mode.

### 3.4 No Circuit Breaker on Sidecar Calls
`imageEmbeddingProvider.js` uses `withRetry` only. The shared `CircuitBreaker` class is not used. (Note: `embeddingRouter.js` has its own inline circuit breaker state that also bypasses the shared class — this is a separate consistency concern.)

### 3.5 Hardcoded Timeout
`embedLocal()` uses `{ timeout: 15000 }` — not configurable.

### 3.6 ~~Health Check Doesn't Send Auth Header~~ — NOT A GAP
**Correction based on sidecar audit (see section 2.2):** `/health` and `/ready` on the sidecar are explicitly public — no auth is required or expected for those endpoints. The health poller does not need to change its auth behavior. The only endpoints that require auth are `/embed-image`, `/models`, and `/admin/cleanup`.

### 3.7 Health Status Not Propagated to Discord
Status changes (degraded → unhealthy, or recovery) are logged to Winston but never sent to Discord. The `discordBot.js` service has no generic system health alert method.

### 3.8 No UI for Generating / Copying the Sidecar Key
Settings → AI has the local host/port/model fields but no UI to generate or reveal the sidecar API key.

### 3.9 `Retry-After` Header Not Honored
The sidecar emits `Retry-After: <seconds>` on queue-full `429` responses. Classifarr's `withRetry` utility does not parse this header; retries use a fixed delay.

### 3.10 Default RPS Mismatch
Classifarr's `DEFAULTS.rps = 2` (in `imageEmbeddingProvider.js`) equates to 120 requests/minute. The sidecar's default rate limit is `30/minute`. These will clash without user configuration. Either the Classifarr default must be lowered (e.g., 0.5 req/sec = 30/min) or the discrepancy must be clearly documented with a recommendation to raise `rate_limit_embed` in the sidecar's `config.toml`.

### 3.11 Resolved Since Original Draft: Health Check Now Differentiates Model-Loaded vs. Service-Up
This gap is no longer active. `checkImageEmbeddings()` now consults `/ready` when available and surfaces a reachable-but-warming sidecar as `degraded` instead of `connected`.

### 3.12 Partially Resolved Since Original Draft: `serviceStatus.js` Now Tracks Image Embeddings, But Still Lacks Generic Transition Notifications
`client/src/stores/serviceStatus.js` now maps `imageEmbeddings` from `/api/system/health`, so the frontend does have shared visibility into embedding service state.

`response.data.imageEmbeddings` (status string) and `response.data.details.imageEmbeddings` (full object) are now consumed by the shared store, and `client/src/constants/serviceConfig.js` also recognizes `imageEmbeddings` as a first-class service key.

What still remains is the second half of the original gap: the store still has no generic previous-vs-current transition detection, and it still does not fire shared toasts when a service moves from `connected` to `degraded` or `disconnected`.

### 3.13 No In-App Notification on Service Health Changes
Users without Discord configured have no way to know when the image embedding sidecar (or any service) becomes unreachable. The `useToast()` composable and `Toast.vue` component are already fully implemented and globally mounted — but nothing calls them in response to health state transitions.

### 3.14 Resolved Since Original Draft: Health Poller Now Has a Mode Guard
This gap is no longer active. `checkImageEmbeddings()` now exits early for non-`separate_local` image modes instead of treating cloud or disabled image-embedding modes as sidecar failures.

### 3.15 `embeddingRouter.js` Uses an Inline Circuit Breaker Object
`embeddingRouter.js` implements its own hand-rolled circuit breaker as a module-level plain object (`circuitBreaker = { state, failures, lastFailure, threshold, resetTimeMs }`) with inline `isCircuitOpen()` / `recordFailure()` / `resetCircuit()` methods on the class. This duplicates logic that already exists in the shared `CircuitBreaker` class in `circuitBreaker.js` (Gap 3.4 is about `imageEmbeddingProvider.js` not using it; this is the same pattern in `embeddingRouter.js`). The two implementations have divergent default parameters (5-minute reset in the inline version vs. the shared class defaults).

### 3.16 Unclassified Error Propagation from `embedLocal()`

`embedLocal()` propagates raw axios errors to callers without classification. Three distinct failure conditions are currently indistinguishable at the call site:

- **HTTP 401 (Unauthorized):** The sidecar rejects the request because the configured `X-Api-Key` is missing or incorrect. `isRetryableError()` already prevents retrying (this part is correct), but the error propagates as a generic `"Request failed with status code 401"` axios error. No differentiated logging or actionable message is produced — the classification pipeline and operator have no way to detect "misconfigured key" vs. "server error." Note: Gap 3.9 and the checklist item about ~~`Retry-After` and `401` handling~~ only address retry suppression; they do not cover classified logging, which is a separate gap.
- **ECONNREFUSED / timeout after retries exhausted:** After `withRetry` gives up, the propagated error is a raw network error. No contextual log message points operators to the sidecar being unreachable, and the classification pipeline can't distinguish this from other failure types.
- **Circuit breaker OPEN (post-implementation):** When the shared `CircuitBreaker` trips and the breaker is OPEN, its thrown error signals a protective state, not a new root-cause failure. It should be logged at `warn` (not `error`) to avoid alert fatigue. Without classification, the caller logs it at the wrong severity.

Note: HTTP `429` with `Retry-After` is **already handled** by `withRetry` / `getRetryDelay` — that is not a gap.

### 3.17 `getLocalModels()` Has a Separate Hardcoded Timeout

Section 5.4 adds a configurable `image_embedding_local_timeout_ms` column and applies it to `embedLocal()`. However, `getLocalModels()` — which calls `GET /models` on the sidecar — uses an independent hardcoded `{ timeout: 10000 }`. Since both calls target the same host, the same configurable value should govern both. An operator who raises the timeout for slow embed calls likely intends the same for model listing.

### 3.18 Proposed Circuit Breaker Wrapping Order Causes Limiter Queue Buildup

Section 5.4 currently proposes:
```js
return limiter.schedule(() => embedCircuitBreaker.run(wrapped));
```
This places the circuit breaker *inside* the rate limiter. When the breaker is OPEN, requests still enter `limiter.queue` before being rejected — they just get rejected later instead of immediately. In a batch job with hundreds or thousands of images, every item parks a closure (capturing the image URL, config, and callback references) in the limiter's queue before the breaker can return. This causes unnecessary memory pressure and delays surfacing the failure to the batch driver.

Correct order: **circuit breaker check FIRST (outermost) → rate limiter SECOND → retry THIRD**. The circuit breaker check is cheap (one boolean) and should short-circuit before any queuing occurs.

Additionally, `CircuitBreaker` exposes no `.run(fn)` convenience method — the actual API is `isAllowed()` / `recordSuccess()` / `recordFailure()`. The plan must use these directly.

### 3.19 Circuit Breaker State Persists Across Config Reset (No Self-Heal on Settings Change)

The `embedCircuitBreaker` instance will be module-level alongside `ImageEmbeddingProvider`. `resetConfig()` nulls `this.config`, `this.limiter`, and `this.limiterKey`, but does NOT touch the circuit breaker state. If the circuit has tripped to OPEN (e.g., due to repeated `401` auth failures from a wrong key), a user who corrects the key in Settings and saves will find embedding still fails for up to `recoveryTimeout` (60 seconds). The circuit has no knowledge that the underlying cause was resolved by a configuration change.

Fix: `resetConfig()` should call `embedCircuitBreaker.reset()` and log at `info` level when the circuit was not already CLOSED. An explicit settings save is an operator action that signals the environment has changed; resetting the breaker to CLOSED immediately allows the corrected config to be validated without waiting for the recovery window.

### 3.20 `CircuitBreaker.metrics.stateChanges` Array Is Unbounded (Pre-existing)

The shared `CircuitBreaker` class caps `stateHistory` at 100 entries but pushes each state transition to a separate `metrics.stateChanges` array without any bound. Over a long uptime with a flapping sidecar, `stateChanges` grows indefinitely. Since this PR already touches both callers of the class (`imageEmbeddingProvider.js` and `embeddingRouter.js`), fixing the shared class here avoids a separate follow-up. The fix is a one-line cap in `transitionTo()`, mirroring the existing `stateHistory` trim. See section 5.12 and Decision 9.

### 3.21 `CircuitBreaker` Has No `.run(fn)` Convenience Method

The shared `CircuitBreaker` class exposes only the low-level `isAllowed()` / `recordSuccess()` / `recordFailure()` three-step API. Callers must invoke each in the correct place — a call site that forgets `recordSuccess()` after a successful HALF_OPEN probe silently prevents the circuit from recovering to CLOSED. The breaker gets stuck in HALF_OPEN, times out, and re-opens indefinitely, blocking recovery without any error.

Additionally, section 5.11 (the `embeddingRouter.js` migration) references `embedRouterBreaker.run(fn)` which does not exist on the current class, making the plan internally inconsistent with the actual API.

Adding `async run(fn)` to the class solves both: it encapsulates the three-step sequence into a single call, making call sites both simpler and correct-by-construction. It throws a distinctively-coded error (`err.code === 'CIRCUIT_OPEN'`) when the circuit rejects a call, allowing callers like `embeddingRouter.js` to detect and route to their Ollama fallback. It also skips `recordFailure()` for `AbortError` — user-initiated cancellations are not provider failures and must not trip the breaker. See section 5.12 and Decision 9.

### 3.22 All `CircuitBreaker` Instances Log Under the Same Name

`circuitBreaker.js` calls `createLogger('CircuitBreaker')` at module scope as a string constant shared by every instance. Once `embedCircuitBreaker` (image provider, 60s recovery) and `embedRouterBreaker` (text router, 5-min recovery) both exist, state-change log lines like `[CircuitBreaker] state changed: CLOSED → OPEN` are ambiguous — an operator cannot determine which circuit tripped. The constructor needs an optional `name` parameter passed to `createLogger` so each instance logs under a distinct tag. Since section 5.12 already modifies the constructor, adding one parameter is zero extra cost. See section 5.12 and Decision 9.

### 3.23 `checkImageEmbeddings()` Outer Catch Is Silent

The actual outer `catch` block in `checkImageEmbeddings()` sets `status: 'error'` in the health cache and writes `error.message` to the cached object — but never calls `logger.error()`. An unexpected DB query failure or runtime error in the check function produces no log output. The error is only discoverable by polling `/api/system/health` or inspecting the cache directly. Operators tailing the log file see nothing. A `logger.error()` call with structured context is needed in this catch block.

### 3.24 Plan Code Samples Use the Wrong `logger` Argument Form

The `Logger.error(message, data, options)` method expects `data` to be a plain object — it is passed to `sanitizeData()`, serialised with `JSON.stringify()`, and persisted to the `error_log` DB table. Several code samples in section 5.4 pass `err.message` (a string) as `data`:

```js
// WRONG — string as second arg
logger.error('[EMBED_FAIL] Image embedding request failed after retries:', err.message);
// WRONG
logger.warn('[EMBED_RETRY]', { attempt, error: err.message });
```

Passing a string bypasses structured persistence and produces `JSON.stringify("string")` in the log line. All new `logger.*()` calls must use a plain object as `data`:

```js
// CORRECT
logger.error('[EMBED_FAIL] Image embedding request failed after retries', { error: err.message, host, port });
logger.warn('[EMBED_RETRY] Retrying embed request', { attempt, statusCode: err.response?.status, host, port, error: err.message });
```

This applies to every new `logger.*()` call added in sections 5.4, 5.5, and 5.12. Note: `SENSITIVE_FIELDS` in `logger.js` already includes `api_key`, `secret`, `authorization`, and `auth` — any metadata object with those key names is automatically `[REDACTED]` before file write and DB persist. The plan's "never log the key" constraint is therefore met automatically by the existing sanitiser, provided implementors use `logger.*()` rather than `console.log()`.

---

## 4. Design Decisions

### Decision 1: Where to Store the Sidecar Credential

**Option A — Reference a key in `api_keys` table**
- Add `embed_service` to `VALID_PERMISSIONS`.
- Add `image_embedding_local_api_key_id INTEGER` (nullable FK) to `ai_provider_config`.
- User clicks "Generate" → calls `apiKeyService.createApiKey('Embedding Service Key', 'embed_service')` → stores returned ID in config.
- When calling sidecar, call `apiKeyService.getApiKeyFull(id)` to retrieve the decrypted key.
- Key is shown/rotated via the existing `/api/keys/:id/reveal` and `/api/keys` endpoints.
- **Pro:** Reuses existing key lifecycle (audit trail, revoke, rotate). Key appears in Security → API Keys list.
- **Con:** Requires two DB lookups on every embed call (or caching the decrypted key in memory). API keys in that table are conventionally for *incoming* requests, not outbound credentials — semantically awkward.

**Option B — Store encrypted credential directly in `ai_provider_config`**
- Add `image_embedding_local_api_key TEXT` (nullable, encrypted) to `ai_provider_config`.
- Generate via backend using `generateRandomKey` / `encryptValue`; expose via a dedicated Settings endpoint.
- Reveal via a dedicated `GET /api/settings/image-embedding/api-key` endpoint (auth-protected).
- Rotation via `POST /api/settings/image-embedding/api-key/rotate`.
- **Pro:** No cross-table join on every embed call. Clear separation — `api_keys` table is for external callers into Classifarr; this table holds outbound service credentials.
- **Con:** Duplicates some key-management patterns; no automatic audit trail.

**Recommendation: Option B** — storing the credential as an encrypted TEXT column in `ai_provider_config` is simpler and fully consistent with how `image_embedding_cloud_api_key` is already handled for cloud mode. The `api_keys` table is semantically for inbound credentials; outbound service keys belong in the config table. No cross-table join on every embed call, no new permission tier, no separate generate/reveal/rotate endpoints. The UI is a single `type="password"` input field in the `separate_local` block of `ImageEmbeddingsTab.vue` — the user pastes in the key they generated on the sidecar with `python scripts/generate_env.py`, exactly as documented in the sidecar README.

### Decision 2: Circuit Breaker Scope

Use the existing `CircuitBreaker` class from `circuitBreaker.js`. Instantiate one per `ImageEmbeddingProvider` instance (module-level singleton since the class itself is a singleton). This replaces the raw `withRetry` wrapping at the `embedLocal` level with a two-layer approach: circuit breaker (outer) → retry (inner, for transient errors while circuit is CLOSED/HALF_OPEN).

### Decision 3: `Retry-After` Header Handling

When the sidecar returns HTTP 429 or 503 with a `Retry-After` header, extract it and pass it to the retry delay. The `withRetry` utility will need to be checked for `Retry-After` support; if absent, handle it at the `embedLocal` level before passing to `withRetry`.

### Decision 4: Configurable Timeout

Add `image_embedding_local_timeout_ms INTEGER DEFAULT 15000` to `ai_provider_config`. Expose in Settings UI alongside host/port.

### Decision 5: Discord Health Alert Design

**Channel:** Reuse the existing configured Discord channel (same as classification notifications). Color-coded embeds visually distinguish system alerts from classification events. No second channel config field needed.

**Trigger:** Fire only on *state transitions* — not on repeated polls while already in a degraded state. `healthCheckService.js` maintains a `_previousStatuses` map; `sendSystemAlert` is called only when `newStatus !== previousStatus`. This is the primary deduplication mechanism.

**Cooldown:** Even with transition-only firing, a flapping service could generate rapid repeated alerts (up→down→up→down). A per-service cooldown of **15 minutes** is applied: after firing an alert for a service, suppress further alerts for that service for 15 minutes regardless of additional transitions. Recovery alerts (`connected`) are always allowed through — a user always wants to know when service is restored.

**Message philosophy:** Keep Discord alerts minimal and actionable. The message should tell the user *what happened* and *where to look*. No detailed diagnostics in Discord — that belongs in the Classifarr application logs. Example embed:
- **Title:** `⚠️ Image Embedding Service — Degraded`
- **Description:** `The image embedding sidecar is not ready (model may still be loading). Check the Classifarr logs for details.`
- **Footer:** `Classifarr · System Health`

Severity → embed color: `warning` = yellow, `error` = red, `recovery` = green.

**Flag:** New `notify_on_system_errors BOOLEAN DEFAULT TRUE` column on `discord_config`. Defaults `TRUE` so existing users who have Discord configured automatically get health alerts. New users can opt out per-notification type in Settings → Discrd. Migration must use `ADD COLUMN IF NOT EXISTS ... DEFAULT TRUE` so it is non-breaking for both fresh installs and existing deployments.

### Decision 6: Frontend Transition Detection — All Services via `serviceStatus.js`

The `serviceStatus.js` store is the right place to centralize frontend health transition detection — not individual components. Approach:

1. Add a `_previousStatuses` private object inside the store alongside `serviceHealth`.
2. After each `fetchServiceStatus()` resolves, diff the new statuses against `_previousStatuses` for **every service in the map**.
3. On any transition to an unhealthy state (`degraded`, `disconnected`, `error`), call `useToast().warning()` or `.error()` with a short message and a link/hint toward Settings.
4. On recovery to `connected`/`healthy`/`configured`, call `useToast().success()`.
5. Write the new statuses to `_previousStatuses` after diffing.
6. **First-poll handling:** Treat `undefined → unhealthy` as an alertable transition. If the service is already `degraded` or `disconnected` on the very first poll (e.g., Classifarr restarted while sidecar was down), fire the alert. Skip toasts only if the service is already `connected`/`healthy` on first check — there is nothing to report.
7. Scope: apply to **all services** in the map — the logic is generic (one loop). Applying only to `imageEmbeddings` would be a missed opportunity given the store already tracks everything else.
8. **`imageEmbeddings` is already in the shared store mapping** — keep using `response.data.imageEmbeddings` (status) and `response.data.details.imageEmbeddings` (details) from `/api/system/health`. The remaining work is transition detection and notification behavior, not basic mapping.
9. **Reuse existing `SERVICE_NAMES`** from `client/src/constants/serviceConfig.js` for display labels. `imageEmbeddings` is already present in that map (`imageEmbeddings: 'Image Embeddings'`). Do not create a separate `SERVICE_DISPLAY_NAMES` constant.

This costs ~25 extra lines in the store and gives every future service health event a toast path for free.

### Decision 7: `checkImageEmbeddings()` Mode Guard

Before polling the sidecar, `checkImageEmbeddings()` must read the current `image_mode` from config. If `image_mode !== 'separate_local'`, immediately return a `{ status: 'not_configured' }` result (or skip the check entirely) without making any HTTP calls and without triggering any alerts. This prevents log noise and spurious Discord notifications for users running cloud embeddings or who have not configured the local sidecar at all.

### Decision 8: Replace `embeddingRouter.js` Inline Circuit Breaker with Shared Class

Since this issue already adds `CircuitBreaker` usage to `imageEmbeddingProvider.js`, we should simultaneously migrate `embeddingRouter.js` to use the same shared class. The current inline object is functionally equivalent but diverges in reset timeout (5 minutes vs. the shared class default of 60 seconds) and is harder to test in isolation.

Migration plan:
- Remove the module-level `circuitBreaker` plain object and the three inline methods (`isCircuitOpen`, `recordFailure`, `resetCircuit`) from `EmbeddingRouter`.
- Instantiate a `CircuitBreaker` from `circuitBreaker.js` at module level (or as a class property), configured with `{ failureThreshold: 5, recoveryTimeout: 300000, halfOpenMaxAttempts: 1 }` to preserve the current 5-minute reset behavior.
- Replace all calls to `this.isCircuitOpen()` / `this.recordFailure()` / `this.resetCircuit()` with `embedRouterBreaker.run(fn)` (added to the shared class in Decision 9 / section 5.12).
- Verify the existing `embed()` fallback-to-Ollama path still works when the breaker opens — now triggered by catching `err.code === 'CIRCUIT_OPEN'` from `.run()`.

### Decision 9: Fix `circuitBreaker.js` In This PR

Three pre-existing class issues (Gap 3.20 — unbounded `stateChanges`; Gap 3.21 — missing `.run(fn)`; Gap 3.22 — all instances share one logger name) are fixed in this PR rather than filed as separate follow-ups:

1. **This PR is the first serious consumer of the shared class** — adding circuit breaking to `imageEmbeddingProvider.js` and migrating `embeddingRouter.js` means we touch every existing caller. Fixing the class concurrently avoids a second PR that only touches the foundation.
2. **`.run(fn)` directly simplifies the code written in this PR** — without it, section 5.4's `embedImageFromUrl()` and section 5.11's `embed()` must manually track the `isAllowed()` / `recordSuccess()` / `recordFailure()` sequence. With it, a single `circuitBreaker.run(fn)` replaces all three calls and eliminates the forgotten-record failure class.
3. **Named instances are necessary for operational clarity** — with two circuit breakers in play after this PR, a shared `[CircuitBreaker]` log tag makes state-change alerts unactionable.

**`.run(fn)` design:**
- Calls `isAllowed()` first — throws `{ code: 'CIRCUIT_OPEN' }` immediately if rejected, before any work begins
- Skips `recordFailure()` for `AbortError` — user-initiated cancellations are not provider failures and must not trip the breaker; this also removes the need for callers to guard `recordFailure()` calls themselves
- On all other errors, calls `recordFailure(err)` then re-throws — callers retain full error information
- On success, calls `recordSuccess()` then returns the result

---

## 5. Proposed Changes by Component

### 5.1 DB Migrations

**Migration 1 — `20260310_200000_add_embedding_service_auth.sql`**
```sql
-- Store the sidecar API key as an encrypted value directly in ai_provider_config,
-- consistent with how image_embedding_cloud_api_key is stored for cloud mode.
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS image_embedding_local_api_key TEXT;

-- Add configurable per-request timeout (ms)
ALTER TABLE ai_provider_config
  ADD COLUMN IF NOT EXISTS image_embedding_local_timeout_ms INTEGER DEFAULT 15000;
```

**Migration 2 — `20260310_210000_add_discord_system_errors_flag.sql`**
```sql
-- Add opt-out toggle for system health Discord alerts.
-- DEFAULT TRUE: existing users who have Discord configured automatically receive
-- health event notifications without any manual action required.
-- New users start with it enabled and can opt out in Settings → Discord.
ALTER TABLE discord_config
  ADD COLUMN IF NOT EXISTS notify_on_system_errors BOOLEAN NOT NULL DEFAULT TRUE;
```

Both migrations use `ADD COLUMN IF NOT EXISTS` and are fully non-breaking for fresh installs and existing deployments.

### 5.2 `server/src/services/apiKeyService.mjs`

No changes required. The sidecar credential is stored as an encrypted column in `ai_provider_config`, not in the `api_keys` table.

### 5.3 `server/src/routes/helpers/aiSettingsHandlers.mjs` (mounted from `server/src/routes/settings.mjs`)

No new key-management endpoints needed. The `image_embedding_local_api_key` field is saved and cleared through the existing settings save flow — the same path used by `image_embedding_cloud_api_key`.

The settings route already handles encryption for sensitive fields. Ensure the following behavior is consistent:
- **On save:** if `image_embedding_local_api_key` is present and non-empty (and not a mask value), call `encryptValue(value)` before writing to `ai_provider_config`.
- **On read:** call `decryptValue(row.image_embedding_local_api_key)` — return only a masked representation (e.g., the last 4 characters) to the client, not the full plaintext. This prevents the key from being exposed in the settings API response.
- **On clear:** if the client sends an empty string for `image_embedding_local_api_key`, set the column to `NULL`.

This mirrors exactly how `image_embedding_cloud_api_key` is already handled on the cloud branch.

### 5.4 `server/src/services/imageEmbeddingProvider.mjs`

**`getConfig()` change:** Also select `image_embedding_local_api_key` (decrypt via `decryptValue` if non-null) and `image_embedding_local_timeout_ms`.

**Key loading:** No cross-table lookup needed. After decrypting the column value at config load time, store as `this._localApiKey`. Invalidate (set to `null`) in `resetConfig()`. Never log or expose the plaintext key.

**`embedLocal()` change:**
```js
async embedLocal(imageUrl, config, { model, imageSize }) {
    const host = config.image_embedding_local_host || 'localhost';
    const port = config.image_embedding_local_port || 8000;
    const timeout = config.image_embedding_local_timeout_ms ?? 15000;
    const headers = {};
    if (this._localApiKey) {
        headers['X-Api-Key'] = this._localApiKey;
    }

    const response = await axios.post(
        `http://${host}:${port}/embed-image`,
        { image_url: imageUrl, model, normalize: true, image_size: imageSize },
        { timeout, headers }
    );
    // ...existing response handling...
}
```

**Add circuit breaker (module-level):**
```js
const CircuitBreaker = require('./circuitBreaker');

// Module-level singleton — survives across getConfig() / resetConfig() cycles,
// ensuring failure state is preserved across settings refreshes.
// resetConfig() explicitly resets this when the circuit is not CLOSED (Gap 3.19).
const embedCircuitBreaker = new CircuitBreaker({
    name: 'ImageEmbedding',   // Gap 3.22 — distinct log tag; logs as [CircuitBreaker:ImageEmbedding]
    failureThreshold: 5,
    recoveryTimeout: 60000,   // 60s: fast HALF_OPEN probe for image-specific breaker
    halfOpenMaxAttempts: 2
});
```

**Correct wrapping order in `embedImageFromUrl()` (Gaps 3.18, 3.21):**

Order must be: circuit breaker (outermost, immediate rejection) → rate limiter (queuing) → retry (inner). This prevents limiter queue buildup during OPEN state.

`embedCircuitBreaker.run(fn)` is used — added to the shared class in section 5.12. `.run(fn)` calls `isAllowed()` first (throws `err.code === 'CIRCUIT_OPEN'` if OPEN, before `limiter.schedule()` is ever called), awaits `fn()`, then calls `recordSuccess()` or `recordFailure()` automatically — no manual tracking needed at the call site.

```js
// In embedImageFromUrl — correct ordering:
async function embedImageFromUrl(imageUrl, config, opts) {
    // Circuit breaker OUTERMOST — .run() calls isAllowed() before limiter.schedule() queues anything.
    // Throws err.code === 'CIRCUIT_OPEN' immediately if OPEN.
    // Calls recordSuccess() / recordFailure() automatically — no manual tracking needed.
    try {
        return await embedCircuitBreaker.run(async () => {
            // Rate limiter gates concurrency/RPS
            return limiter.schedule(async () => {
                // withRetry handles transient 5xx / network errors / 429+Retry-After
                return withRetry(
                    () => embedLocal(imageUrl, config, opts),
                    {
                        maxRetries: 2,
                        // Gap 3.24: data arg must be a plain object — include transport-level
                        // facts only; omit imageUrl (may contain auth tokens in non-standard schemes)
                        onRetry: (err, attempt) => logger.warn('[EMBED_RETRY] Retrying embed request', {
                            attempt,
                            statusCode: err.response?.status,
                            host: config.image_embedding_local_host,
                            port: config.image_embedding_local_port,
                            error: err.message
                        })
                    }
                )();
            });
        });
    } catch (err) {
        // Classified logging (Gaps 3.16, 3.18, 3.21, 3.24)
        // NOTE: logger.error() persists to the error_log DB table automatically (dual-write).
        // Use warn for CIRCUIT_OPEN — high-frequency rejections must not flood error_log.
        if (err.code === 'CIRCUIT_OPEN') {
            logger.warn('[EMBED_CIRCUIT_OPEN] Circuit breaker is OPEN — image embedding calls suspended', {
                recoveryTimeout: embedCircuitBreaker.recoveryTimeout
            });
        } else if (err.response?.status === 401) {
            logger.error('[EMBED_AUTH_FAIL] Sidecar rejected request: API key missing or incorrect', {
                statusCode: 401,
                host: config?.image_embedding_local_host,
                port: config?.image_embedding_local_port,
                hint: 'Verify the key in Settings → RAG & Embeddings → Image Embeddings'
            });
        } else {
            logger.error('[EMBED_FAIL] Image embedding request failed after retries', {
                error: err.message,
                host: config?.image_embedding_local_host,
                port: config?.image_embedding_local_port,
                statusCode: err.response?.status
            });
        }
        throw err;
    }
}
```

**`resetConfig()` extended for circuit breaker self-heal (Gap 3.19):**
```js
resetConfig() {
    if (embedCircuitBreaker.state !== 'CLOSED') {
        logger.info('[EMBED] Config changed — circuit breaker reset to CLOSED to allow immediate validation.');
        embedCircuitBreaker.reset();
    }
    this.config = null;
    this.limiter = null;
    this.limiterKey = null;
    this._localApiKey = null;
}
```

This means: if a user corrects a wrong API key in Settings and saves, the circuit breaker clears immediately, the next embed attempt validates the new key, and the breaker closes normally on success. No recovery timeout wait required after a deliberate config change.

When the circuit breaker transitions to OPEN after `failureThreshold` failures, the shared class already logs at `warn` via `transitionTo()`. No additional logging is needed at the `imageEmbeddingProvider` level for the open event itself — only for the call-site rejection (the `[EMBED_CIRCUIT_OPEN]` check above).

**`getLocalModels()` change:** Also pass the `X-Api-Key` header (sidecar's `/models` requires auth — see section 2.2). Also replace the hardcoded `{ timeout: 10000 }` with the configurable `image_embedding_local_timeout_ms` value (Gap 3.17) — consistent with the same change applied to `embedLocal()`.

**Retry-After handling:** In `embedLocal()`, catch `429` responses before passing to `withRetry`. If the response includes a `Retry-After` header, extract the delay and either respect it as the initial retry delay or reject immediately with a backpressure signal to the caller. Do NOT retry on `401` — that is a misconfiguration, not a transient error.

**Default RPS adjustment (or documentation):** Change `DEFAULTS.rps` from `2` to `0.5` (30/minute) to align with the sidecar's default rate limit — or document clearly that users raising `image_embedding_rps` above `0.5` must also raise `rate_limit_embed` in the sidecar's `config.toml`.

**Error classification (Gap 3.16)** is handled in the outer catch block of `embedImageFromUrl()` above. Design principles:
- **Always re-throw** — never swallow errors; the classification pipeline decides skip vs. abort.
- **`401` → `error` level** pointing to Settings. `isRetryableError()` already prevents retry on `401`; the error surfaces on the first attempt.
- **Circuit-open → `warn` level** — root-cause failures already produced `error` logs when they tripped the breaker; circuit-open is a protective consequence, not a new incident. Using `warn` also prevents high-frequency circuit rejections from flooding the `error_log` DB table (logger.error is dual-write; logger.warn is not).
- **All other failures → `error` level** with `[EMBED_FAIL]` tag for `grep`-ability.
- **Never log the key value** — met automatically by the logger's built-in `SENSITIVE_FIELDS` sanitiser (`api_key`, `secret`, `authorization` are already redacted). No special code needed; do not bypass with `console.log()`.
- **Data argument must be a plain object** (Gap 3.24) — `logger.*()` methods pass `data` to `sanitizeData()` and `JSON.stringify()`; passing a bare string produces malformed log lines and skips DB persistence.
- **Double-logging: callers should not re-log** — `embedImageFromUrl()` logs before re-throwing. If the classification pipeline's batch loop also calls `logger.error()` on caught errors, each failure logs twice. Callers should inspect `err.code` to decide how to handle, and treat the `[EMBED_*]`-tagged entry as the canonical log record — do not re-log.

**Settings save — audit log (Gap 3.22 note):** When `image_embedding_local_api_key` is written or cleared in the settings save handler, emit a `logger.info('[AUDIT] Sidecar API key updated', { action: key ? 'set' : 'cleared' })` call. Since `logger.info()` does not persist to `error_log`, this is a file/console-only record — sufficient to confirm the credential was changed without polluting the error store.

### 5.5 `server/src/services/healthCheckService.mjs`

Status update: the `/ready` polling and mode-guard parts of this section have already landed. The remaining work here is transition-aware alerting, richer logging, and any future sidecar-auth-aware operator behavior.

**`checkImageEmbeddings()` changes:**

1. **No auth header needed for `/health` or `/ready`** — both are public on the sidecar (see section 2.2). No change to the health/ready HTTP calls.

2. **Poll `/ready` in addition to `/health`:** After confirming the service is up (`/health` returns 2xx), issue a second `GET /ready`. If `ready: false` (model still warming up), set status to `degraded` rather than `connected`.
   - `connected` = `/health` 2xx AND `/ready` returns `{ ready: true }`
   - `degraded` = `/health` 2xx but `/ready` returns `{ ready: false }`
   - `disconnected` = `/health` unreachable or non-2xx

3. **Mode guard (see Decision 7):** Read `image_mode` from config at the start of the check. If not `separate_local`, return `{ status: 'not_configured' }` immediately — no HTTP calls, no alerts.

4. **Transition detection and Discord alerting:** Maintain a `_previousStatuses` map at module level (or as a closure variable). After computing the new status, compare against `_previousStatuses.imageEmbeddings`:
   - If `newStatus !== previousStatus`, call `discordBotService.sendSystemAlert(...)` (subject to the 15-minute cooldown enforced inside `sendSystemAlert`).
   - **First-poll edge case:** treat `previousStatus === undefined` AND `newStatus` is unhealthy as an alertable transition. If `previousStatus === undefined` AND `newStatus` is `connected`, write the status silently with no alert.
   - Always update `_previousStatuses.imageEmbeddings = newStatus` after the comparison.
   - Fire on transitions *to* `degraded`, `disconnected`, or `error` (and on recovery *to* `connected`).
   - Do **not** fire if status is unchanged between polls — this is the primary deduplication.

5. **Fix silent outer catch (Gap 3.23):** The existing outer `catch` block sets `status: 'error'` but emits no log. Add:
   ```js
   logger.error('[HEALTH] Unexpected error in checkImageEmbeddings', {
       error: error.message
   });
   ```
   Note: `createLogger` is not currently called in `healthCheckService.js` — a `const logger = createLogger('HealthCheck')` line must also be added at the top of the file.

### 5.6 `server/src/services/discordBot.mjs`

Add a `sendSystemAlert(serviceKey, newStatus, previousStatus)` method:

```js
async sendSystemAlert(serviceKey, newStatus, previousStatus) {
    // 1. Guard: check notify_on_system_errors flag in discord_config
    // 2. Guard: per-service cooldown — if an alert for serviceKey was sent
    //    within the last 15 minutes (tracked in a module-level Map), skip.
    //    Exception: recovery alerts ('connected') always bypass the cooldown.
    // 3. Build a minimal Discord embed:
    //    - Title: e.g. "⚠️ Image Embedding Service — Degraded"
    //    - Description: one sentence stating what changed.
    //      End with: "Check the Classifarr logs for details."
    //    - Color: yellow (warning/degraded), red (error/disconnected), green (recovery)
    //    - Footer: "Classifarr · System Health"
    //    No stack traces, no config values, no diagnostics — those live in the app logs.
    // 4. Send to the existing configured channel (same as classification notifications).
    // 5. Update the cooldown Map entry for serviceKey.
}
```

Severity → embed color: `degraded` = yellow `(0xF0A500)`, `disconnected`/`error` = red `(0xE74C3C)`, `connected` recovery = green `(0x2ECC71)`.

The cooldown Map is module-scoped (not persisted to DB) — it resets on server restart, which is acceptable. The message stays minimal by design: Discord is a *signal*, not a log viewer.

### 5.7 `client/src/views/rag/ImageEmbeddingsTab.vue`

**File correction:** The image embedding settings live in `ImageEmbeddingsTab.vue` (Settings → RAG & Embeddings → Image Embeddings), not `AI.vue`.

**`separate_local` block — add API key field:** Inside the `separate_local` conditional block, add a password-style input immediately after the existing host/port/model fields. This mirrors the `image_cloud_api_key` input already present in the cloud block:

```html
<!-- In the separate_local section, after the model input -->
<div>
  <label class="form-label">Sidecar API Key</label>
  <input
    v-model="config.image_local_api_key"
    type="password"
    class="form-input"
    placeholder="Paste key from sidecar .env (SERVICE_API_KEY)"
    autocomplete="new-password"
  />
  <p class="form-hint">
    Generate this key on the sidecar: <code>python scripts/generate_env.py</code>.
    Leave blank only if authentication is disabled on the sidecar (<code>REQUIRE_API_KEY=false</code>).
  </p>
</div>
```

**`config` ref addition (script section):**
```js
image_local_api_key: '',
```

**Masking behavior:** On settings load, the API returns a masked value (e.g., `"••••abcd"`) when a key is configured, or an empty string when not. On save, the client must check whether the value equals the mask — if so, omit the field from the payload to preserve the stored key. Only send the field when the user has typed or pasted a new value. This is the same guard used for cloud API key fields.

**Performance `<details>` (Advanced Options) — add timeout field** alongside the existing rps/concurrency/batch fields:

```html
<div>
  <label class="form-label">Request Timeout (ms)</label>
  <input
    v-model.number="config.image_local_timeout_ms"
    type="number"
    min="1000"
    step="1000"
    class="form-input"
    placeholder="15000"
  />
</div>
```

`config` ref addition:
```js
image_local_timeout_ms: 15000,
```

### 5.8 `client/src/api/` (settings API layer)

No new API client functions needed for key management. The `image_local_api_key` and `image_local_timeout_ms` fields travel through the existing settings save/load calls like any other config field.

Ensure the settings load function passes `image_local_api_key` (masked by the server) and `image_local_timeout_ms` into the `config` ref on mount, and that the settings save function includes both fields in its payload (with the mask-guard described in 5.7).

### 5.9 `client/src/stores/serviceStatus.js`

Status update: the shared store already maps `imageEmbeddings`, and `client/src/constants/serviceConfig.js` already includes the `imageEmbeddings` service entry. The remaining work in this section is generic transition detection plus user-facing notifications.

Remaining additions to the existing store:

**1. Preserve the existing `imageEmbeddings` service map entry** inside `fetchServiceStatus()`:
```js
imageEmbeddings: {
  status: response.data.imageEmbeddings,
  details: response.data.details?.imageEmbeddings
},
```
This is already in place and ensures the embedding service status is available to all components via `getServiceStatus('imageEmbeddings')`.

**2. Add transition detection for all services** — generic, fires toasts on any status change:
```js
import { useToastStore } from '@/stores/toast'
import { SERVICE_NAMES } from '@/constants/serviceConfig'  // reuse existing constant

// Inside the store, alongside serviceHealth:
const _previousStatuses = ref({})

// At the end of fetchServiceStatus(), after serviceHealth is updated:
const toastStore = useToastStore()
for (const [key, service] of Object.entries(serviceHealth.value)) {
  const prev = _previousStatuses.value[key]
  const curr = service.status
  const isFirstPoll = prev === undefined
  const changed = !isFirstPoll && prev !== curr
  const unhealthy = ['degraded', 'disconnected', 'error'].includes(curr)

  // Fire on: status change, OR first poll when already unhealthy
  if (changed || (isFirstPoll && unhealthy)) {
    const label = SERVICE_NAMES[key] || key
    if (unhealthy) {
      const level = curr === 'degraded' ? 'warning' : 'error'
      toastStore[level](
        `${label} is ${curr}. Check Settings for details.`,
        'Service Health'
      )
    } else if (['connected', 'healthy', 'configured'].includes(curr)) {
      toastStore.success(`${label} is back online.`, 'Service Health')
    }
  }
  _previousStatuses.value[key] = curr
}
```

**Current state:** `SERVICE_NAMES` already includes `imageEmbeddings: 'Image Embeddings'` in `client/src/constants/serviceConfig.js`. Reuse that existing constant; do not create a separate display names constant.

**Scope:** applies to all services in the map — generic logic, zero extra cost per new service added in future.

### 5.11 `server/src/services/embeddingRouter.mjs`

Replace the inline circuit breaker object with the shared `CircuitBreaker` class:

```js
const CircuitBreaker = require('./circuitBreaker');

// Replace the module-level plain object:
const embedRouterBreaker = new CircuitBreaker({
    name: 'TextEmbedding',    // Gap 3.22 — distinct log tag; logs as [CircuitBreaker:TextEmbedding]
    failureThreshold: 5,
    recoveryTimeout: 300000,  // preserve existing 5-minute reset
    halfOpenMaxAttempts: 1
});
```

Remove `isCircuitOpen()`, `recordFailure()`, and `resetCircuit()` from the `EmbeddingRouter` class body. Update `embed()` to use `embedRouterBreaker.run(fn)` (defined in section 5.12). `recordSuccess()` and `recordFailure()` are handled internally by `.run()` — no manual calls needed, and the `AbortError` guard before `this.recordFailure()` is eliminated (`.run()` skips it automatically).

The fallback-to-Ollama path is preserved by catching the `CIRCUIT_OPEN`-coded error from `.run()`. The AbortError guard *before fallback logic* is retained — an aborted request should not initiate a fallback call:

```js
// In EmbeddingRouter.embed() — replace the try/catch around the primary embedding call:
try {
    result = await embedRouterBreaker.run(async () => {
        return await embeddingProvider.getEmbedding(text, { signal });
        // (or the switch-case provider dispatch for the 'same'-mode path)
    });
    return result;
} catch (err) {
    if (err.name === 'AbortError') throw err; // propagate immediately; do not attempt fallback

    if (err.code === 'CIRCUIT_OPEN') {
        // Circuit is OPEN — fall back to Ollama immediately (same behavior as current isCircuitOpen() check)
        logger.warn('Circuit breaker open, using Ollama fallback');
        return await this.embedWithOllama(text, DEFAULT_MODELS.ollama, '5m', signal);
    }

    // Provider failed — recordFailure() already called by .run(); try Ollama fallback if enabled
    logger.warn('Embedding provider failed, trying fallback', { error: err.message });
    if (config?.ollama_fallback_enabled) {
        try {
            const fallbackResult = await this.embedWithOllama(text, DEFAULT_MODELS.ollama, '5m', signal);
            return { ...fallbackResult, fallback: true };
        } catch (fallbackError) {
            if (fallbackError.name === 'AbortError') throw fallbackError;
            logger.error('Fallback embedding also failed', { error: fallbackError.message });
        }
    }
    throw err;
}
```

This pattern applies identically to both the `mode !== 'same'` and the legacy `'same'`-mode paths in `embed()` — both have the same fallback shape.

### 5.12 `server/src/services/circuitBreaker.mjs`

Three fixes to the shared class, all brought in-scope per Decision 9 (Gaps 3.20, 3.21, 3.22):

**1. Add `name` option to constructor (Gap 3.22):**

```js
constructor(options = {}) {
    this.name = options.name || null;  // optional — used to make the logger tag distinct
    // Create a named logger so instances are distinguishable in log output:
    // 'ImageEmbedding' → [CircuitBreaker:ImageEmbedding], unnamed → [CircuitBreaker]
    this._logger = createLogger(this.name ? `CircuitBreaker:${this.name}` : 'CircuitBreaker');
    // ... rest of constructor unchanged
}
```

All internal `logger.*()` calls in the class body must be updated from the module-level `logger` to `this._logger`. The module-level `const logger = createLogger('CircuitBreaker')` becomes unused and should be removed.

**2. Cap `metrics.stateChanges` at 100 entries (Gap 3.20):**

In `transitionTo()`, immediately after the existing `stateHistory` trim, add:
```js
// Mirror the stateHistory cap — prevents unbounded growth during long uptime
if (this.metrics.stateChanges.length > 100) {
    this.metrics.stateChanges.shift();
}
```

**3. Add `async run(fn)` convenience method (Gap 3.21):**

```js
/**
 * Execute a function with circuit breaker protection.
 * Encapsulates the isAllowed() / recordSuccess() / recordFailure() sequence.
 *
 * @param {Function} fn - Async function to execute
 * @returns {Promise<*>} Result of fn on success
 * @throws {Error} err.code === 'CIRCUIT_OPEN' if the circuit rejects the call
 * @throws {Error} Re-throws fn's error after recording failure (non-AbortError).
 *                 AbortError is re-thrown without recording failure — user-initiated
 *                 cancellations are not provider failures and must not trip the breaker.
 */
async run(fn) {
    if (!this.isAllowed()) {
        const err = new Error('Circuit breaker is OPEN — request rejected');
        err.code = 'CIRCUIT_OPEN';
        throw err;
    }
    try {
        const result = await fn();
        this.recordSuccess();
        return result;
    } catch (err) {
        // AbortErrors are user-initiated cancellations — do not penalize the provider.
        if (err.name !== 'AbortError') {
            this.recordFailure(err);
        }
        throw err;
    }
}
```

Placement: add after `getMetrics()`, before `module.exports`, following the existing method ordering.

`run(fn)` does not suppress errors — it always re-throws. Callers classify the error using the pattern in section 5.4: `err.code === 'CIRCUIT_OPEN'` means the circuit rejected the call; all other codes mean the operation ran but failed (and `recordFailure()` has already been called). The `CIRCUIT_OPEN` distinction is the only signal callers need — no additional error properties are required.

  <label class="form-label">System Health Alerts</label>
  <label class="toggle">
    <input type="checkbox" v-model="config.notify_on_system_errors" />
    <span>Notify on service health events (degraded, disconnected, recovery)</span>
  </label>
  <p class="form-hint">
    Sends a brief Discord alert when a connected service changes health state.
    Details and diagnostics remain in the Classifarr application logs.
  </p>
</div>
```

The field is included in the existing Discord settings save/load payload. Server-side: read from `discord_config.notify_on_system_errors` wherever Discord config is queried.

---

## 6. Migration Numbers

Follow the timestamp-based naming convention. Two migrations for this issue:
```
20260310_200000_add_embedding_service_auth.sql
20260310_210000_add_discord_system_errors_flag.sql
```

---

## 7. Open Questions

1. **~~`embed_service` keys in Security → API Keys list?~~ — RESOLVED (moot)**
   - Sidecar credential stored in `ai_provider_config`, not `api_keys`. No action.

2. **~~Should we authenticate the `/ready` endpoint?~~ — RESOLVED**
   - Both `/health` and `/ready` are always public on the sidecar. See section 2.2.

3. **~~Discord notify flag — new config or reuse existing?~~ — RESOLVED**
   - New `notify_on_system_errors BOOLEAN DEFAULT TRUE` column on `discord_config`. See Decision 5 and section 5.1 migration 2.

4. **~~Retry-After: handle in `withRetry` or at call site?~~ — RESOLVED**
   - `retryUtils.js` already implements this fully. `parseRetryAfter()` handles both delay-seconds and HTTP-date formats. `getRetryDelay()` checks the `Retry-After` header first and falls back to exponential backoff. `withRetry` calls `getRetryDelay` internally. `isRetryableError()` already excludes `401` from retryable statuses. No additional handling needed at the call site — `withRetry` handles everything.

5. **~~Default RPS value — lower it or document the mismatch?~~ — RESOLVED**
   - Lower `DEFAULTS.rps` to `0.5` (30/min) in `imageEmbeddingProvider.js` and update the DB column default to match the sidecar's default rate limit.

6. **~~`IMAGE_EMBEDDER_API_KEY` env var fallback support?~~ — REJECTED**
   - The API key is entered exclusively through the Classifarr UI (Settings → RAG & Embeddings → Image Embeddings → Sidecar API Key field). No env var fallback will be implemented. The DB column is the single source of truth.

7. **~~`embeddingRouter.js` inline circuit breaker~~ — IN SCOPE**
   - Migrating to the shared `CircuitBreaker` class is included in this issue since circuit breaker work is already happening here. See Gap 3.15 and Decision 8.

8. **~~Should we poll `/ready` in addition to `/health`?~~ — RESOLVED**
   - Yes. See Decision 4 and section 5.5.

---

## 8. Task Checklist (Implementation Order)

When moving to implementation:

**DB / Schema**
- [x] Write migration `20260410_100000_add_embedding_service_auth.sql` — add `image_embedding_local_api_key TEXT` and `image_embedding_local_timeout_ms INTEGER DEFAULT 15000` to `ai_provider_config`
- [x] Write migration `20260410_110000_add_discord_system_errors_flag.sql` — add `notify_on_system_errors BOOLEAN NOT NULL DEFAULT TRUE` to `notification_config` (NOTE: table is `notification_config` with `type='discord'` rows, not `discord_config`)

**Server: settings route (`aiSettingsHandlers.js`, mounted from `settings.js`)**
- [x] Encrypt `image_embedding_local_api_key` on save, return masked value on read (same pattern as `image_embedding_cloud_api_key`)
- [x] Include `notify_on_system_errors` in Discord settings read/write (`notification_config`, not `discord_config`)

**Server: `circuitBreaker.js`**
- [x] Add optional `name` to constructor; store as `this._logger = createLogger(name ? \`CircuitBreaker:${name}\` : 'CircuitBreaker')`; update all internal `logger.*()` calls to `this._logger`; remove module-level `logger` constant (Gap 3.22)
- [x] Cap `metrics.stateChanges` at 100 entries in `transitionTo()` — one-line `shift()` immediately after the existing `stateHistory` trim (Gap 3.20)
- [x] Add `async run(fn)` method: `isAllowed()` check → throw `{ code: 'CIRCUIT_OPEN' }` if false; skip `recordFailure()` for `AbortError`; call `recordSuccess()` / `recordFailure()` automatically; always re-throw (Gap 3.21)

**Server: `imageEmbeddingProvider.js`**
- [x] Update `getConfig()` to load and decrypt `image_embedding_local_api_key` + `image_embedding_local_timeout_ms`
- [x] Store decrypted key as `this._localApiKey`; extend `resetConfig()` to: (a) null `this._localApiKey`, (b) call `embedCircuitBreaker.reset()` with `info` log if circuit is not already CLOSED (Gap 3.19)
- [x] Never log the plaintext key value — enforced automatically by logger's `SENSITIVE_FIELDS` sanitiser; use `logger.*()`, never `console.log()` for credential-adjacent code
- [x] Add `X-Api-Key` header to `embedLocal()` and `getLocalModels()` when `this._localApiKey` is set
- [x] Apply configurable `image_embedding_local_timeout_ms` to both `embedLocal()` AND `getLocalModels()` — replace both hardcoded values (Gap 3.17)
- [x] Lower `DEFAULTS.rps` from `2` to `0.5` (30/min); update DB column default
- [x] Add module-level `embedCircuitBreaker` (shared `CircuitBreaker` class, `failureThreshold: 5, recoveryTimeout: 60000, halfOpenMaxAttempts: 2`)
- [x] Implement wrapping order in `embedImageFromUrl()`: `embedCircuitBreaker.run(fn)` OUTERMOST (rejects before `limiter.schedule()` queues anything), rate limiter SECOND, `withRetry` THIRD — see Gaps 3.18, 3.21 and section 5.12
- [x] Error classification in outer catch of `embedImageFromUrl()`: `CIRCUIT_OPEN` → `logger.warn` with `{ recoveryTimeout }`; `401` → `logger.error` with `{ statusCode, host, port, hint }`; all others → `logger.error` with `{ error, host, port, statusCode }` — all `data` args must be plain objects (Gap 3.24)
- [x] Always re-throw after logging — callers must not re-log; treat `[EMBED_*]` tags as the canonical log record
- [x] ~~`Retry-After` delay and `401` retry-suppression~~ — already handled by `withRetry` / `isRetryableError` / `getRetryDelay`; no retry-layer changes needed

**Server: `embeddingRouter.js`**
- [x] ~~Replace inline `circuitBreaker` plain object and `isCircuitOpen()` / `recordFailure()` / `resetCircuit()` methods with the shared `CircuitBreaker` class~~ — superseded: `embeddingRouter.js` already uses the shared `embeddingCircuitBreaker` singleton; `embeddingProvider.js` owns the full 3-step CB lifecycle on that singleton, so adding `.run()` at the router level would double-record. Router-level migration is N/A.
- [x] ~~Configure with `{ failureThreshold: 5, recoveryTimeout: 300000 }`~~ — N/A (see above; shared CB is already configured)
- [x] ~~Replace manual `recordSuccess()` / `recordFailure()` calls with `embedRouterBreaker.run(fn)`~~ — N/A (see above)
- [x] ~~Remove `AbortError` guard before `this.recordFailure()`~~ — N/A (see above)
- [x] ~~Verify Ollama fallback fires correctly on `err.code === 'CIRCUIT_OPEN'`~~ — N/A (see above; provider owns CB lifecycle)

**Server: `aiSettingsHandlers.js`**
- [x] When `image_embedding_local_api_key` is saved or cleared, emit `logger.info('[AUDIT] Sidecar API key updated', { action: key ? 'set' : 'cleared' })` — file/console only (logger.info does not persist to error_log)
- [x] `updateConfig`: destructure `image_embedding_local_api_key` and `image_embedding_local_timeout_ms` from `req.body`; add `finalImageEmbeddingLocalApiKey` mask-guard (empty string → null/clear; masked or undefined → preserve existing; new plaintext → `encryptValue` + `formatEncryptedValue`)
- [x] `updateConfig`: add `image_embedding_local_api_key` and `image_embedding_local_timeout_ms` columns to INSERT (now $59/$60); update ON CONFLICT SET; add to params array
- [x] `getConfig`: after existing 3 mask blocks, decrypt + `maskToken` `image_embedding_local_api_key` (parse → decrypt → mask); null-out on decryption failure
- [x] `updateConfig` post-save response: same decrypt + mask pattern for `image_embedding_local_api_key`
- [x] `require('../../utils/encryption')` at module top (outside factory) for `encryptValue`, `formatEncryptedValue`, `parseEncryptedValue`, `decryptValue`

**Server: `healthCheckService.js`**
- [x] Add `const logger = createLogger('HealthCheck')` at file top if not already present (needed for Gap 3.23 fix) — was already present as `createLogger('healthCheck')`
- [x] Add mode guard: if `image_mode !== 'separate_local'`, return `{ status: 'not_configured' }` immediately — no HTTP calls, no alerts
- [x] Poll `/ready` in addition to `/health`; map `ready: false` → `degraded`, `ready: true` → `connected`
- [x] Add `_previousStatuses` map; call `discordBotService.sendSystemAlert()` only on status transitions (implemented via `maybeSendHealthAlert()` helper + `try/finally` in `checkImageEmbeddings()`)
- [x] Handle first-poll edge case: `undefined → unhealthy` is alertable; `undefined → connected` is silent
- [x] Fix silent outer catch (Gap 3.23): add `logger.error('[HEALTH] Unexpected error in checkImageEmbeddings', { error: error.message })` in the catch block
- [x] ~~No auth header needed for `/health` / `/ready`~~ — confirmed public, no change required

**Server: `discordBot.js`**
- [x] Add `sendSystemAlert(serviceKey, newStatus, previousStatus)` method
- [x] Gate on `notify_on_system_errors` from `notification_config` (loaded via `loadConfig()`)
- [x] Implement 15-minute per-service cooldown (module-scoped `_systemAlertLastSent` Map); recovery alerts bypass cooldown
- [x] Keep message minimal: what changed + "Check the Classifarr logs for details"   - First-poll edge case handled by callers in `healthCheckService.js` (only alert on transitions, not `undefined → connected`)

**Client: `constants/serviceConfig.js`**
- [x] Add `imageEmbeddings` to `SERVICE_NAMES` so shared service consumers recognize the image-embedding service
**Client: `stores/serviceStatus.js`**
- [x] Add `imageEmbeddings` to the service health map (from `response.data.imageEmbeddings`)
- [x] Add `_previousStatuses` ref and transition detection loop after each `fetchServiceStatus()`
- [x] Fire `useToast().warning()` / `.error()` on unhealthy transitions; `.success()` on recovery
- [x] Apply to all services in the map (generic loop)
- [x] Handle first-poll edge case: fire toast if first-poll status is already unhealthy
- [x] Use existing `SERVICE_NAMES` from `serviceConfig.js` for display labels (not a new constant)

**Client: `views/rag/ImageEmbeddingsTab.vue`**
- [x] Add `image_local_api_key` password field to `separate_local` block (mask-guard on save)
- [x] Add `image_local_timeout_ms` number field to Performance `<details>` section
- [x] Add both fields to `config` ref; include in settings load/save payload

**Client: Discord settings tab**
- [x] Add `notify_on_system_errors` checkbox toggle with label and hint text
- [x] Include in Discord settings save/load payload

**Tests**
- [x] `embeddingRouter.js` — circuit breaker state transitions behave identically to before after migration to shared class
- [x] `embeddingRouter.js` — Ollama fallback triggers when shared breaker is OPEN
- [x] `imageEmbeddingProvider.embedLocal()` — `X-Api-Key` header present when key configured; absent when not
- [x] `embedLocal()` — `401` response does not trigger retry
- [x] `embedLocal()` — `401` response produces an `[EMBED_AUTH_FAIL]` log entry pointing to Settings
- [x] `embedLocal()` — circuit breaker OPEN (rejected by `isAllowed()`) throws before entering `limiter.schedule()` — limiter queue stays empty
- [x] `embedLocal()` — circuit breaker OPEN produces a `[EMBED_CIRCUIT_OPEN]` warn log (not error)
- [x] `resetConfig()` — circuit breaker resets to CLOSED if not already CLOSED; no reset if already CLOSED
- [x] `resetConfig()` — after reset, a corrected key is validated on the very next embed call without waiting for `recoveryTimeout`
- [x] `embedLocal()` — `429` with `Retry-After` header respects the delay
- [x] Circuit breaker opens after `failureThreshold` failures and rejects calls while OPEN
- [x] `checkImageEmbeddings()` — `/ready: false` maps to `degraded`, `/health` failure maps to `disconnected`
- [x] `checkImageEmbeddings()` — Discord alert fires on transition, not on repeated same status
- [x] `sendSystemAlert()` — cooldown suppresses repeated alerts within 15 min; recovery bypasses
- [x] `sendSystemAlert()` — does not fire when `notify_on_system_errors = false`
- [x] `serviceStatus.js` store — toast fires on status transition, not on same-status refresh
- [x] `serviceStatus.js` store — `imageEmbeddings` mapped from `response.data.imageEmbeddings` / `response.data.details.imageEmbeddings` (confirmed present in `/api/system/health`)
- [x] `serviceStatus.js` store — first-poll toasts fire for already-unhealthy services, not for already-healthy ones
- [x] `serviceStatus.js` store — `_previousStatuses` tracks last known status; 7 new Vitest tests in `client/src/__tests__/stores/serviceStatus.test.js`
- [x] ~~No auth headers on `/health`/`/ready` calls~~ — confirmed public, no test needed
- [x] `CircuitBreaker.run()` — throws with `err.code === 'CIRCUIT_OPEN'` when circuit is OPEN or `halfOpenMaxAttempts` exhausted
- [x] `CircuitBreaker.run()` — calls `recordSuccess()` on success; HALF_OPEN transitions to CLOSED after `halfOpenMaxAttempts` successes via `.run()`
- [x] `CircuitBreaker.run()` — calls `recordFailure()` for non-AbortError failures; does NOT call `recordFailure()` for AbortError; always re-throws in both cases
- [x] `CircuitBreaker.run()` — does not swallow errors; re-throws exactly what `fn()` threw
- [x] `CircuitBreaker.metrics.stateChanges` — length never exceeds 100 after 101+ state transitions
- [x] `CircuitBreaker` with `name: 'ImageEmbedding'` logs state changes as `[CircuitBreaker:ImageEmbedding]`; unnamed instance logs as `[CircuitBreaker]`
- [x] `embeddingRouter.js` — `CIRCUIT_OPEN` triggers Ollama fallback; AbortError propagates before fallback; non-circuit errors also attempt fallback when `ollama_fallback_enabled`
- [x] `checkImageEmbeddings()` unexpected error (e.g. DB failure) produces a `[HEALTH]` error log entry (Gap 3.23) — NOTE: implemented, test not yet written
- [x] `embedImageFromUrl()` all `logger.*()` calls use a plain object as `data` arg — no bare strings (Gap 3.24)

**Docs**
- [x] Update `README.md` / `docs/` with end-to-end sidecar setup: run `generate_env.py` on sidecar, copy `SERVICE_API_KEY`, paste into Settings → RAG & Embeddings → Image Embeddings → Sidecar API Key
