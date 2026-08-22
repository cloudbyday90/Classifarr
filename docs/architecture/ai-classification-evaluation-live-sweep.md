# Local AI Classification Evaluation: Observation and Fingerprint Design

Status: Steps 2 through 4 implemented on 2026-08-22. This document describes the local,
opt-in evaluation path that connects the versioned fixture contract to a real
direct classification run. It does not authorize routing, deployment, or a
release.

## Objective

The local policy-to-AI sweep already verifies request submission, queue
lifecycle, classification-history persistence, cleanup, and its no-route
guardrail. This step makes direct classification runs answer the higher-value
question: did the bounded classification response and its separately persisted
history outcome satisfy a policy-owner-reviewed expected result?

Every evaluated direct run now produces four canonical SHA-256 identifiers:

1. **fixture** — the versioned expected outcome and the exact media request;
2. **policy** — a server-authored digest of the active decision-relevant policy
   state, preset attachments, and native intent state;
3. **runtime** — provider/model selection, ingest mode, no-route state, and
   the policy digest; and
4. **outcome** — the deterministic grading result and named checks.

The report contains these identifiers and bounded provenance counts, not the
raw policy payload or raw provider output. SHA-256 fingerprints establish
comparability and change detection; they do not make a decision correct, hide
the underlying source material, or replace access control.

## Official-Source Research

Research was performed on 2026-08-22 from current primary sources.

- [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model)
  recommends benchmarking representative tasks with explicit task success,
  answer completeness, evidence, latency, and cost rather than measuring a
  single superficial metric. It also recommends bounded, structured workflows
  for deterministic processing and validation. The sweep therefore uses a
  versioned fixture and a deterministic result grader rather than another model
  acting as the system-of-record judge.
- [OpenAI API backward-compatibility guidance](https://developers.openai.com/api/reference/overview#backwards-compatibility)
  notes that model prompting behaviour and outputs can vary between model
  snapshots, and recommends pinned versions plus application evals. The
  runtime fingerprint records the selected local model and provider state so
  comparable results can be grouped correctly.
- [NIST FIPS 180-4 Secure Hash Standard](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
  specifies hash algorithms for message digests that detect input changes.
  This supports canonical SHA-256 fingerprints for evidence integrity. The
  implementation uses Node's standard `node:crypto` SHA-256 and a repository
  canonical JSON serializer; it does not implement cryptography itself.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends input validation, safe event fields, and excluding or masking
  sensitive data such as access tokens and sensitive personal data. The adapter
  allowlists the observation fields, the policy endpoint returns only a digest
  and counters, and the report no longer keeps the direct raw classify response
  or raw queued submission payload.

## Options Considered

### Retain transport and history health checks only

Pros:

- no new endpoint or fixture authoring;
- all ingest paths remain equally covered.

Cons:

- an incorrect library selection can still appear healthy;
- model or policy changes cannot be safely compared beyond timestamps;
- no explicit quality score exists.

Decision: rejected as the only verification layer. Existing health checks are
retained as a complementary layer.

### Grade every queued run by reconstructing an AI response from history

Pros:

- all current ingest paths would receive a score immediately;
- no endpoint contract would need to change.

Cons:

- it compares a persisted record with a reconstruction of that same record,
  which is not an independent response/history consistency check;
- queue acknowledgements intentionally do not expose the classification result;
- it could report an unjustified quality pass.

Decision: rejected. Queued runs are now scored only from the dedicated,
task-bound decision witness described below; they are never reconstructed from
history. Their lifecycle and history health checks still run and can still fail
the sweep.

### Return the full policy document to the local sweep client

Pros:

- the client could construct a fingerprint without another server service;
- fewer server-side queries.

Cons:

- expands a short-lived, local-sweep token from narrowly scoped execution to
  policy-content disclosure;
- makes it easy for reports to retain raw policy terms or destination details;
- broadens the security impact of an accidentally exposed report.

Decision: rejected. `GET /api/policies/evaluation-context` is admin-protected
and is the only additional path granted to an exchanged sweep token. It reads
five decision-state projections server-side and returns only a canonical
digest plus aggregate counts.

### Store raw model output in the report for later debugging

Pros:

- may aid ad-hoc prompt troubleshooting.

Cons:

- increases retention of model text, user-controlled values, and possibly
  commercially sensitive media context;
- complicates safe report sharing and cleanup;
- is unnecessary for deterministic contract grading.

Decision: rejected. The live adapter receives the response only in memory,
projects the fixed contract fields, then writes the grader result and
fingerprints. Existing report fields retain request metadata and bounded queue
IDs needed by the report-driven cleanup utility.

## Design

```text
versioned expected fixture                 active policy state
             |                                      |
             v                                      v
      direct classify response --> bounded adapter <-- server-only policy context
             |                       |                    |
             |                       v                    v
persisted classification history --> deterministic grader  SHA-256 policy digest
                                      |
                                      v
          fixture + policy + runtime + outcome fingerprints in local report
```

### Strict observation boundary

`scripts/lib/aiClassificationEvaluationSweepAdapter.mjs` is a thin ESM bridge.
It admits only the current response fields `method`, `confidence`, `library`,
`needs_clarification`, and `needs_retry`, plus persisted `method`, `status`,
`confidence`, `library_id`, and `library_name`. It passes that projection into
the Step 1 validator/grader; unexpected raw output fields never enter the
evaluation artifact.

A final decision must include a confidence and destination projection. A queued
clarification or retry witness deliberately stores those values as `null`; the
adapter preserves the absence instead of deriving confidence from history. The
grader keeps method, decision kind, history-status, no-fallback, and applicable
library checks, while explicitly marking confidence consistency as not
applicable when the non-final source value is not observable.

The adapter supports a mixed fixture file so existing legacy core-sweep
fixtures continue to run unchanged. A fixture is evaluated only when it uses
the exact `classifarr.ai_classification_evaluation_fixture.v1` shape. Legacy
fixtures produce `not_requested`, not a misleading pass or failure.

### Fingerprint boundary

`server/src/services/aiClassificationEvaluationPolicyContext.mjs` builds the
policy digest from canonical, sorted server-side database projections. It
includes policy records and destinations, attached preset state, and active
native intent/rule/template state. It excludes non-semantic lifecycle
timestamps from the digest so timestamp-only writes do not break comparison.

`server/src/services/aiClassificationEvaluationFingerprint.mjs` creates
fixture, runtime, and outcome digests with the existing canonical serializer.
The runtime digest references the policy digest rather than its source data.
The public evaluation endpoint response contains only the policy digest and
five aggregate counts, and is registered before `/:id` policy routes.

### Execution behaviour

- The harness fetches policy context once at preflight. It is read-only.
- The harness reads the AI-settings `ETag` before its temporary model change,
  supplies it as `If-Match`, and carries the returned replacement tag into the
  next write and final restore. A concurrent configuration change therefore
  makes the restore fail closed instead of being overwritten.
- The existing default `require_all_confirmations=true` no-route guardrail is
  applied and restored exactly as before.
- In `direct` mode, a versioned fixture with an observed history row is graded.
  A failing grade makes the sweep row fail.
- In `requests` and `webhook-overseerr` modes, queue/lifecycle checks run and
  the harness polls the submitted task's bounded decision witness. A versioned
  fixture is graded only when that witness and its bound history projection
  validate; unavailable or invalid evidence is a failed `not_evaluated` row.
- A missing history row remains a normal health-check failure and is also
  reported as `persisted_history_not_observable` for direct evaluation.

## Implementation Outcome

- `server/src/services/aiClassificationEvaluationPolicyContext.mjs` owns safe
  policy-state canonicalization and its SHA-256 digest.
- `server/src/routes/policiesRouteEvaluationContext.mjs` owns the narrow,
  read-only API projection. `authRouteShared.mjs` grants that precise `GET`
  route through the exchanged local-sweep token's explicit method-and-route
  profile.
- `server/src/services/aiClassificationEvaluationFingerprint.mjs` owns the
  canonical fixture, runtime, and outcome fingerprint projections.
- `scripts/lib/aiClassificationEvaluationSweepAdapter.mjs` owns compatibility
  with legacy fixtures, bounded live observation, grading, and report-state
  decisions.
- `scripts/lib/aiPolicySweepFixtureDocument.mjs` validates the complete mixed
  legacy/versioned fixture document before authentication, rejecting malformed
  entries and preventing unsupported versions from silently becoming ungraded
  legacy fixtures.
- `scripts/local-ai-policy-sweep.mjs` consumes the adapter, preserves cleanup
  identifiers in a reduced submission summary, polls queued task witnesses,
  and adds evaluation counters. Its API-key flow is isolated in
  `scripts/lib/localAiPolicySweepAuthentication.mjs`; it exchanges the key once
  and verifies the resulting scoped token with a read-only request before the
  sweep changes settings or submits media. See [Local AI Policy Sweep API-Key
  Authentication and Preflight](local-ai-policy-sweep-api-key-authentication.md).

Focused tests cover canonical policy context construction, timestamp stability,
semantic change detection, digest non-disclosure, the read-only API response,
legacy fixture compatibility, direct and queued grading, witness tamper
rejection, and allowlisted observation projection.

## Final Recommendation Stack

1. Use direct, local, versioned evaluation fixtures for the first trustworthy
   AI quality score. Start with reviewed happy-path, ambiguity, clarification,
   retry, collision, and contamination cases for every local policy.
2. Compare quality only within a matching fixture, policy, runtime, and
   outcome fingerprint context with the local [trend-baseline
   comparator](ai-classification-evaluation-trend-baseline.md). Treat a policy
   or runtime fingerprint change as a new evaluation cohort, not an automatic
   regression.
3. Keep queued-path lifecycle/history verification enabled. Use the dedicated
   [queued decision-witness design](ai-classification-evaluation-queued-decision-witness.md)
   to introduce response/history consistency scoring without returning raw
   provider output.
4. Keep reports local and access-controlled. Do not add tokens, prompts, raw
   provider output, or raw policy documents to report artifacts. Apply normal
   retention and cleanup practices to report metadata as well.
5. Run unit tests in CI and run live model sweeps only against an intentional
   local Docker/Ollama setup with the no-route guardrail intact. Review the
   generated report before treating a model or policy change as ready.

## Next Recommended Item

The reviewed local trend-baseline comparator is now implemented. Before any
release-process automation is considered, grow the reviewed versioned fixture
cohort with policy-owner-approved routing, retry, and contamination examples,
then continue to keep local model evidence advisory and human-reviewed.
