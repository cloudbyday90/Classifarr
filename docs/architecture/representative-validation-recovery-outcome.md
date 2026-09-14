# Representative validation diagnosis and recovery outcome

Date: 2026-09-13. Scope: query receipt, decision binding and private profile caches.

## Underlying issues addressed

The previous generic `invalid_input` result concealed which validation check
failed. Profile refresh verified a model header but not all cached geometry,
allowing invalid geometry to persist until ordinary cache expiry. A second issue
allowed a rejected replacement query to leave an older captured query available.

The new ESM validation service preserves the authoritative embedding validator
and diagnoses vector shape, dimensions, non-finite values, unsafe float32 values
and zero vectors. It also distinguishes invalid query identity/representation,
changed item identity/description, invalid decision scope and malformed profiles.
These codes identify the failed check; they do not speculate about an unobserved
upstream provider bug.

The diagnostic service emits fixed plain-language explanations, recovery behavior
and operator steps. It deduplicates unchanged failures for 30 minutes, caps counts
at one million, ignores arbitrary error text and isolates both synchronous and
asynchronous logger failures. No raw metadata, vectors or credentials enter its
events. Deduplication is process-local; restart or a new episode after recovery
can produce a new first warning.

## Automatic recovery and backfill

All profile geometry is validated before reuse/publication. Invalid private
profiles are withdrawn and discarded. The existing scheduler retries with bounded
backoff and refits from cached vectors, without additional inference. Current
source and representation checks must pass before publication and recovery logging.
Valid pending observations survive within their five-minute lifetime and resume
after recovery. Invalid replacement queries clear earlier capsules immediately.

Rejected query payloads are not repaired by padding, truncation, fabricated IDs or
silent fallback. They cannot be replayed because a valid capsule was never
retained. Future eligible classifications may supply valid query data through the
normal path. Persistent provider-response recovery is not claimed by this slice.

## How to read the logs

Look for module `RepresentativeValidation` and the message "Library comparison
data failed validation". The fixed `code`, `source`, `problem`, `recovery` and
`steps` fields describe the issue without sending you to a forum.

- `profile_dimensions` or another `profile_*` code: Classifarr withdraws the
  private cache and retries rebuilding automatically. Normally no action is needed.
  Repeated failures after rebuilding warrant checking provider health and refresh
  logs; do not edit the vectors manually.
- `query_dimensions`, `query_nonfinite`, `query_zero` or another vector code:
  check that the configured embedding model is available and returns a nonzero,
  finite vector of its declared size. Do not pad or truncate its response.
- `query_contract` or `decision_*`: inspect metadata refresh/classification logs
  for changed identity, description or candidate scope. Do not invent identities
  or force the rejected comparison into routing.

Successful publication emits "Library comparison profile validation recovered"
at info level with the original fixed code. This records recovery in application
logs; it does not delete historical warnings or claim that an external provider
or an earlier rejected query was repaired.

## Local evidence

Final backend regression passed 1,289 suites / 37,324 tests. Frontend regression
passed 368 suites / 5,114 tests; real PostgreSQL integration passed three tests.
The combined coverage ratchet and repository quality checks passed. Full coverage
and UI verification details are in the [comparison outcome](unseen-profile-diagnosis-outcome.md).

Focused synthetic tests passed for diagnosis, log redaction, 5,000 repeated
warnings producing one initial event, cooldown, cache withdrawal, rebuilding,
pending comparison completion, stale-source rejection and stale-capsule clearing.

An isolated Compose probe read the real cached corpus: 10 libraries and 6,650
exclusive descriptions. It injected a wrong-dimension centroid only into its own
in-memory cache, not the application worker or database. The result was:

- One `profile_dimensions` warning, then one recovery event.
- Eight pending controls retained through failure/cooldown, then zero pending.
- Four movie and four TV controls correctly excluded as known inventory items.
- Two fits total (initial and recovery), zero generated embeddings.
- No real inventory, live routing or model configuration changes.

An earlier attempt yielded during normal sync work, and a subsequent changed-source
attempt correctly invalidated publication. The completed probe required no
freshness bypass. This is recovery verification, not an unseen-item accuracy study.

## Recommendation stack and next component

Keep strict validation, fixed actionable diagnostics, scheduled cache rebuilding,
source revalidation and the existing SWR summary. Benefit: self-healing derived
data and far fewer duplicate warnings. Costs: bounded retries consume CPU and
observations may expire; invalid provider payloads still cannot be reconstructed.
Pros/cons and official sources are in the
[design](representative-validation-recovery-design.md).

Next recovery component: extend this fixed diagnosis vocabulary to the actual
provider-response boundary and a bounded, idempotent retry/backfill queue. Resume
only after the provider is healthy and returns validated data. Preserve media-
agnostic recovery mechanics while leaving provider-specific parsing in adapters;
do not use a library-name or genre allowlist to guess missing evidence.

Follow-up implemented for local inventory-description refresh:
[provider-response backfill outcome](provider-response-backfill-outcome.md).
It reuses existing PostgreSQL checkpoints rather than adding a second queue.
Cloud-provider recovery and live-query replay are not included in that slice.
