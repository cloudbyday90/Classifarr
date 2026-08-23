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
  Immediately after a successful exchange, the harness performs one read-only
  `GET /api/settings/ai` preflight using that JWT. It does not retry the
  credentialed exchange if this check fails.
- Validates preconditions:
  - `/api/libraries` has at least one configured library.
  - `/api/settings/ai` is readable and returns its current `ETag` write
    precondition.
- Iterates model matrix:
  - Updates `/api/settings/ai` with `primary_provider=ollama` and `ollama_model=<model>`, using `If-Match` with the current `ETag` and refreshing that precondition after every successful write.
  - By default, filters out fixtures that already exist in synced library items via `/api/media-sync/lookup/:tmdbId`.
  - By default, temporarily enables `require_all_confirmations=true` via `/api/settings` to block auto-routing to Sonarr/Radarr during the sweep.
  - For queued ingest modes, verifies queue lifecycle by observing task queue state and webhook log `processing_status` for each submitted `taskId`/`logId`.
- Runs each fixture through selected ingest mode.
- Validates classify response contract.
- In `direct` mode, polls `/api/classification/history` for a new persisted row
  and records `status` + `method`. In queued modes, polls the submitted task's
  decision-witness endpoint rather than guessing a response from history.
- Fetches a server-authored, read-only policy-context fingerprint. For
  versioned evaluation fixtures, reduces either the direct response or the
  task-bound queued decision witness plus history row to the strict evaluation
  contract, grades it, and writes fixture/policy/runtime/outcome SHA-256
  fingerprints. The response and policy source data are not written to the
  evaluation artifact.
- Restores baseline AI provider/model settings and `require_all_confirmations` at the end. The restore uses the latest AI-settings write precondition and fails closed rather than overwriting a concurrent settings change.
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
- No new `classification_history` row appears within timeout window in direct
  mode, or no valid queue decision witness appears in queued modes.
- A versioned evaluation fixture fails deterministic expected-outcome checks or
  response/history consistency checks.

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

Prefer a prompted environment variable so the key is not retained in shell
history or the process command line:

```powershell
$secureApiKey = Read-Host -Prompt "Admin API key" -AsSecureString
$apiKeyPointer = [IntPtr]::Zero
try {
  $apiKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)
  $env:CLASSIFARR_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($apiKeyPointer)
  npm run test:local:ai-policy-sweep -- --models "qwen3.5:4b,llama3.1:8b"
} finally {
  Remove-Item Env:CLASSIFARR_API_KEY -ErrorAction SilentlyContinue
  if ($apiKeyPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($apiKeyPointer)
  }
}
```

The command-line form remains available for controlled local use:

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

### Add reviewed local destination fixtures

The default fixture file stays portable and therefore does not encode an
installation's library IDs, names, confidence ranges, or policy-specific final
destinations. Add those only through a local fixture profile, which the sweep
pins to the active policy-context SHA-256 fingerprint before it changes
settings or submits media.

1. Run the default cohort once and copy the bounded
   `preflight.policyContext` value from its local report.
2. Copy `scripts/fixtures/ai-policy-sweep.policy-profile.example.json` to an
   ignored path under `.tmp/`, replace its all-zero policy fingerprint and
   example destination fixture with a policy-owner-reviewed local expectation.
3. Run the sweep with the profile:

   ```powershell
   node scripts/local-ai-policy-sweep.mjs `
     --fixture-profile ".tmp/ai-policy-sweep.policy-profile.json"
   ```

On Windows PowerShell with npm 12, use the direct ESM invocation shown above.
Npm can otherwise intercept `--fixture-profile` as one of its own options.

The profile accepts up to 32 versioned fixtures. It contains only a policy
fingerprint and strict evaluation fixtures; it cannot contain credentials,
policy terms, prompts, provider output, review notes, or a release approval.
The generated report exposes only profile version, fixture count, and the
already-bounded policy fingerprint—not the profile path or its expected
destination data.

Use a profile for reviewed positive final destinations and controlled retry
cases. Keep `fallbackAllowed: false` for normal quality cohorts: fallback and
contamination are negative safety signals, not outcomes to promote into a
passing release score. If the active policy changes, the profile fails closed;
review the change and intentionally create a new profile/baseline.

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
- explicit method-and-route scoping enforced by auth middleware for exchanged
  tokens; queue mutations are excluded
- admin API key required for exchange
- an immediate read-only scoped-token preflight before any settings change or
  media submission; a rejected token fails closed and is never logged
- explicit `HS256` allowlist and issuer validation for access JWTs, plus a
  second audience check for the scoped local-sweep token
- no automatic retry of the credentialed `POST` exchange; this avoids minting
  extra tokens or repeating its audit side effects after an ambiguous failure

Reference standards:

- RFC 9700 (OAuth 2.0 Security BCP): audience-restricted, least-privilege
  access tokens and secret handling
- RFC 8725 (JWT BCP): algorithm/claim validation, audience and confusion defenses
- RFC 7519 (JWT): registered claims and validation semantics
- RFC 6750 (Bearer): TLS protection, short-lived and scoped bearer tokens
- RFC 9110 (HTTP semantics): non-idempotent `POST` requests are not retried
  automatically without a specific idempotency design

The full design, researched options, security boundary, and regression coverage
are recorded in [Local AI Policy Sweep API-Key Authentication and
Preflight](architecture/local-ai-policy-sweep-api-key-authentication.md).

## Fixtures

Default fixture file:

- `scripts/fixtures/ai-policy-sweep.fixtures.json`

Legacy core-sweep shape (runs health checks but does not claim an expected
classification result):

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

Versioned evaluation fixtures may be mixed into the same JSON array. Direct
execution is scored from its bounded HTTP response; queued execution is scored
only after its task-bound decision witness is available. Use the full schema
and example in [Local AI Classification Evaluation
Contract](architecture/ai-classification-evaluation-contract.md), then replace
the library selector and acceptable outcomes with your reviewed local policy.

The default document includes four reviewed, installation-specific
clarification fixtures. They require `fallbackAllowed=false`, the reviewed
method, and `awaiting_decision` persistence, and are therefore a local policy
cohort rather than universal media truth. Their design and review boundary are
recorded in [Reviewed Local AI Classification Fixture Cohort v1](architecture/ai-classification-evaluation-fixture-cohort-v1.md).
The harness validates the complete fixture document before authentication or a
media request; malformed entries, unknown legacy fields, duplicate versioned
IDs, and unsupported fixture versions fail closed.

If a queued witness is unavailable or invalid, the report explicitly records a
`not_evaluated` reason and fails that versioned fixture rather than synthesizing
a response from history. Queue, history, contamination, and no-route checks
continue as normal. See [Queued AI Classification Evaluation: Decision Witness
Design](architecture/ai-classification-evaluation-queued-decision-witness.md).

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
- evaluation counts and, for evaluated direct or queued rows,
  fixture/policy/runtime/outcome SHA-256 fingerprints plus a deterministic
  quality score; queued rows also retain only task/history IDs and witness
  fingerprint metadata; the report distinguishes total versioned fixtures in
  the document from the subset runnable on this local library state

The sweep obtains policy context from `GET /api/policies/evaluation-context`.
That admin-protected endpoint is the only policy path added to the exchanged
local-sweep token. It returns only a fingerprint and aggregate counts; it does
not return policy content. See [Local AI Classification Evaluation: Observation
and Fingerprint Design](architecture/ai-classification-evaluation-live-sweep.md)
for the evidence and security boundaries.

## Compare a reviewed baseline

Run the same reviewed cohort after an intentional local model, policy, runtime,
or witness change, then compare the resulting candidate report with the prior
local baseline. This is a read-only, local review aid; it does not call the
application, change settings, or authorize a deployment, policy update, route,
or release.

```powershell
node scripts/compare-ai-policy-sweep-trend.mjs \
  --baseline ".tmp/reports/ai-policy-sweep-reviewed-baseline.json" \
  --candidate ".tmp/reports/ai-policy-sweep-candidate.json"
```

The package alias `npm run test:local:ai-policy-sweep:compare` is convenient in
shells that forward arguments normally. On Windows PowerShell with npm 12, use
the direct `node` form above because npm can consume the comparator's
`--baseline` and `--candidate` options as its own configuration flags.

The comparator writes a separate, access-controlled JSON artifact under
`.tmp/reports/`. It projects only fixture IDs, model identifiers, evaluation
source, the existing fixture/policy/runtime/outcome fingerprints, and aggregate
pass/fail counts. It never copies request titles, raw provider output, policy
content, tokens, webhook payloads, or history data from either input report.

It compares only exact fixture, model, evaluation-source, policy, and runtime
fingerprint cohorts. A policy, model/runtime, witness, source, or fixture change
is intentionally reported as `context_changed` or a one-sided cohort for human
review, rather than as a model regression. A matching-cohort pass-rate decline,
changed outcome distribution, changed sample size, or ungraded row likewise
requires review. A stable artifact is evidence only; a human must still make
the release decision. Legacy rows that were explicitly `not_requested` are
reported as excluded rather than as lost evaluation coverage.

See [AI Classification Evaluation Trend Baseline](architecture/ai-classification-evaluation-trend-baseline.md)
for the full comparison contract, security boundary, and review procedure.

## Evaluation-contract foundation

The sweep proves local request, queue, AI, response-contract, and history
persistence health. Direct paths grade versioned expected outcomes with a
bounded response/history projection and fingerprinted evidence. Queued paths
grade the submitted task's bounded decision witness against its bound history
projection; neither mode synthesizes a response from history.

## Notes for this core round

- This is intentionally focused on the core execution path and contract health checks.
- The reviewed trend-baseline comparator now supports deliberate pairwise
  local model comparison. Live sweeps and comparison artifacts remain
  local-only, not a CI release gate.
- Installation-specific final-destination, retry, fallback, and contamination
  expectations belong in a policy-pinned local fixture profile, never in the
  portable checked-in default corpus.

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
- linked decision witnesses cascade with their task or classification-history
  parent and require no independent cleanup action
- explicit webhook records by report `logId` in `webhook_log`

The cleanup is report-driven and designed to avoid broad deletes outside sweep-linked artifacts.
