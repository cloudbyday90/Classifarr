# Local Policy-to-AI Model Sweep (Core)

This core harness executes real local classification requests through the policy path into AI, switches models between runs, validates response contracts, and verifies persistence in classification history.

It is intentionally local-only and refuses to run in CI/CD by default.

It supports three ingest paths:

- `requests` (default): closest to Seer-style queued submission (`/api/requests/submit`)
- `webhook-overseerr`: Overseerr-like webhook ingestion (`/api/webhook/overseerr`)
- `direct`: direct classify shortcut (`/api/classification/classify`)

## Why this design

This implementation follows current testing and reliability guidance:

- OpenAI evaluation guidance (2026): define task-specific eval objectives, use representative datasets, include edge cases, automate scoring, and continuously evaluate.
  - Source: https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OpenAI eval workflow guidance (2026): run with structured test data and compare runs over time.
  - Source: https://developers.openai.com/api/docs/guides/evals
- Azure Retry pattern guidance (updated 2026): distinguish transient vs terminal errors, cap retries, and avoid noisy logging.
  - Source: https://learn.microsoft.com/en-us/azure/architecture/patterns/retry
- Ollama structured output guidance: prefer constrained output where model behavior supports it, validate output shape, and use low temperature when determinism is needed.
  - Source: https://ollama.com/blog/structured-outputs
  - Source: https://docs.ollama.com/api

## What the core harness does

- Authenticates with an existing bearer token, or logs in as admin and extracts access token.
- Supports admin API key exchange into a short-lived scoped JWT via `/api/auth/token/exchange-local-sweep`.
- Validates preconditions:
  - `/api/libraries` has at least one configured library.
  - `/api/settings/ai` is readable.
- Iterates model matrix:
  - Updates `/api/settings/ai` with `primary_provider=ollama` and `ollama_model=<model>`.
  - By default, filters out fixtures that already exist in synced library items via `/api/media-sync/lookup/:tmdbId`.
  - By default, temporarily enables `require_all_confirmations=true` via `/api/settings` to block auto-routing to Sonarr/Radarr during the sweep.
  - For queued ingest modes, verifies queue lifecycle by observing task queue state and webhook log `processing_status` for each submitted `taskId`/`logId`.
  - Runs each fixture through selected ingest mode.
  - Validates classify response contract.
  - Polls `/api/classification/history` for a new persisted row and records `status` + `method`.
- Restores baseline AI provider/model settings and `require_all_confirmations` at the end.
- Emits machine-readable JSON report.

## Core pass/fail checks

A run is marked failed when any condition is true:

- HTTP request fails.
- Response is missing `method`.
- Final response lacks required `library` or numeric `confidence`.
- `needs_clarification=true` but no policy question payload.
- `needs_retry=true` but no reason.
- Method is `fallback` (unless `--allow-fallback` is set).
- Status is `routed` while no-route guardrail is enabled.
- Queued lifecycle verifier does not observe dispatch evidence (`pending`/`processing`/`queued`/`received`) or does not reach terminal status.
- Persisted method is `existing_media` or `source_library` for runnable fixtures (contamination guard).
- No new `classification_history` row appears within timeout window.

## Run it

> CI/CD safety: this script exits with an error when CI environment variables are detected. This prevents accidental execution in GitHub Actions or other pipelines where local Ollama/Plex context is not present.

Override only for intentional exceptional use:

```powershell
npm run test:local:ai-policy-sweep -- --allow-ci-run
```

or set:

```powershell
$env:CLASSIFARR_ALLOW_CI_LOCAL_SWEEP="true"
```

### Option 1: Seer-like queued path (default)

```powershell
npm run test:local:ai-policy-sweep -- --token "<ACCESS_TOKEN>" --models "qwen3.5:4b,llama3.1:8b"
```

### Option 1b: admin API key exchange (recommended for local automation)

```powershell
npm run test:local:ai-policy-sweep -- --api-key "<CLF_ADMIN_API_KEY>" --models "qwen3.5:4b,llama3.1:8b"
```

You can also pass a `clf_...` key with `--token`; the harness auto-detects it and performs exchange.

### Option 2: explicit direct classify (legacy shortcut)

```powershell
npm run test:local:ai-policy-sweep -- --token "<ACCESS_TOKEN>" --ingest-mode direct --models "qwen3.5:4b,llama3.1:8b"
```

### Option 3: login credentials

```powershell
npm run test:local:ai-policy-sweep -- --username "admin" --password "<PASSWORD>" --models "qwen3.5:4b,llama3.1:8b"
```

### Option 4: Overseerr-like webhook path

```powershell
npm run test:local:ai-policy-sweep -- --token "<ACCESS_TOKEN>" --ingest-mode webhook-overseerr --webhook-key "<WEBHOOK_SECRET>" --models "qwen3.5:4b"
```

### Optional tuning

```powershell
npm run test:local:ai-policy-sweep -- \
  --username "admin" \
  --password "<PASSWORD>" \
  --models "qwen3.5:4b,llama3.1:8b" \
  --runs-per-fixture 2 \
  --history-timeout-ms 20000 \
  --history-poll-interval-ms 1000 \
  --output ".tmp/reports/ai-policy-sweep-core.json"
```

### Guardrail controls

- Default behavior:
  - skips fixtures already present in synced libraries
  - blocks auto-routing to Sonarr/Radarr during the run
- To include known-existing titles anyway:

```powershell
npm run test:local:ai-policy-sweep -- --token "<ACCESS_TOKEN>" --include-existing-fixtures
```

- To allow normal auto-routing behavior:

```powershell
npm run test:local:ai-policy-sweep -- --token "<ACCESS_TOKEN>" --allow-arr-routing
```

- To disable strict queue lifecycle verification (queued modes):

```powershell
npm run test:local:ai-policy-sweep -- --token "<ACCESS_TOKEN>" --no-queue-lifecycle-verify
```

## JWT security profile for local sweep exchange

The exchange endpoint follows current JWT/Bearer guidance:

- short-lived token lifetime (5 minutes default, capped at 15 minutes)
- explicit audience: `classifarr:local-ai-policy-sweep`
- explicit token use claim: `local_ai_policy_sweep`
- unique `jti` per token
- API-prefix scoping enforced by auth middleware for exchanged tokens
- admin API key required for exchange

Reference standards:

- RFC 8725 (JWT BCP): algorithm/claim validation, audience and confusion defenses
- RFC 7519 (JWT): registered claims and validation semantics
- RFC 6750 (Bearer): TLS protection, short-lived and scoped bearer tokens

## Fixtures

Default fixture file:

- `scripts/fixtures/ai-policy-sweep.fixtures.json`

Shape:

```json
[
  {
    "name": "Movie - clear mainstream",
    "tmdb_id": 550,
    "media_type": "movie",
    "title": "Fight Club"
  }
]
```

## Report output

Default output path:

- `.tmp/reports/ai-policy-sweep-<timestamp>.json`

Contains:

- run metadata and configuration
- per-model and per-fixture run records
- response latency
- validation issues
- persisted history status/method
- summary counters (pass/fail/fallback/pending-retry/awaiting-decision)

## Evaluation-contract foundation

The sweep currently proves local request, queue, AI, response-contract, and
history persistence health. The versioned fixture contract and pure scorer in
[Local AI Classification Evaluation Contract](architecture/ai-classification-evaluation-contract.md)
now define how a later sweep revision will evaluate whether a classification is
correct for the configured policy. That integration is intentionally separate:
it will project only bounded response/history fields, add fingerprints, and
preserve this harness's no-route and cleanup safeguards.

## Notes for this core round

- This is intentionally focused on the core execution path and contract health checks.
- Next iteration can add richer grading and thresholds (pairwise model comparison, stricter parse diagnostics, trend baselines, and CI export).

## Cleanup for Re-Tests

Use the dedicated cleanup utility to remove sweep-created artifacts so the same fixtures can be re-tested cleanly.

Default cleanup (all local sweep reports under `.tmp/reports`):

```powershell
npm run test:local:ai-policy-sweep:cleanup
```

Dry-run preview (show targets only, no deletes):

```powershell
node scripts/cleanup-local-ai-policy-sweep.mjs --all-reports --dry-run
```

Target one specific report:

```powershell
node scripts/cleanup-local-ai-policy-sweep.mjs --report ".tmp/reports/ai-policy-sweep-2026-06-17T12-00-00-000Z.json"
```

What it removes:

- `classification_history` rows created by the sweep run(s)
- linked rows in `media_requests`, `webhook_log`, `app_notifications`, `clarification_responses`
- linked rows in `content_analysis_log`, `classification_corrections`, `classification_embeddings`, `embedding_errors`, `pattern_match_log`
- explicit queued records by report `taskId` in `task_queue`
- explicit webhook records by report `logId` in `webhook_log`

The cleanup is report-driven and designed to avoid broad deletes outside sweep-linked artifacts.
