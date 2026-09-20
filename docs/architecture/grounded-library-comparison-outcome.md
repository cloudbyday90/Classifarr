# Grounded library comparison outcome

Date: 2026-09-20.

## Implementation

The separate [design](grounded-library-comparison-design.md) is implemented in
three small ESM services: contract/prompt validation, fixed five-call comparison,
and aggregate reporting. The existing evaluator, local transport and CLI are
extended instead of adding a new provider, singleton, database or UI workflow.

`--leader-grounded` requires grouped folds, is exclusive with other experimental
modes, defaults to no generation, and caps generation at 32 cases / 160 calls.
It retains the preceding two-pass comparison as a matched control and adds
grounded original, identical-repeat and reordered assessments. Both library
indices and example references are remapped before comparison.

Only a distinct supported candidate with stable assessments can become an
experimental proposal. Contradiction, insufficient evidence and multiple supported
candidates remain distinct outcomes. Citation changes with an unchanged destination
also withhold the proposal. Reference validation establishes that cited input
exists, not that the interpretation is true. No output becomes a routing receipt,
training label, confidence percentage or new user question.

Errors stop further inference without repair prompts or fallback. Admission is
checked between passes; deferred/cancelled work retains actual generation-call
accounting. A fresh invocation can recover normally. Final source drift still
invalidates the whole report. Only aggregate results are retained outside private
runtime memory; prompts, item titles, descriptions and model responses are not
serialized into reports.

## Local evaluation

The rebuilt local Compose container was healthy with zero restarts and retained
its read-only root filesystem and 2 GiB limit. Two initial attempts deferred with
`busy` and zero generation calls while background discovery held the shared lease.
No lease was bypassed or background task disabled. A read-only lock check later
confirmed the slot was free. A third attempt deferred for memory pressure with
zero calls: available cgroup memory was about 720 MiB, below the unchanged 1 GiB
startup reserve. A controlled container recreation preserved volumes and services
before retrying; no memory threshold was weakened.

The first admitted run made eight calls but was invalidated by changes to metadata
and observed traits. Its results are not usable quality evidence.

After implementing [benchmark isolation](inventory-benchmark-isolation-design.md),
the same 300-description cohort ran in a separate bounded container. It waited
automatically through three busy checks (about 37 seconds of backoff), then
completed source verification without changing or restarting the live app.

- 28 eligible semantic cases: 18 movie and 10 TV, including three withheld-library
  probes. Sampling 300 descriptions does not mean 300 inference cases.
- Eight actual calls across two attempted cases; 26 cases were not run.
- One TV withheld-library probe completed all five passes. Identical-repeat
  decision and evidence were stable, but reordering changed both.
- The next movie case failed response validation on its first grounded pass.
  Further inference stopped, as designed. Raw responses were not retained, so
  no more-specific model failure cause is claimed.
- Zero stable proposals. Overall status: `completed_with_errors`, with
  `sourceVerified: true` and no changed source components. This is a negative
  feasibility result, not evidence of improved accuracy.

The model was `gemma4:e4b`, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`,
context 32,768, temperature zero and seed 42. Aggregate generation usage was
8,690 prompt tokens, 515 output tokens and 13,189 ms. The sample fingerprint was
`87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a`.
No second cohort or prompt-repair loop was run after this protocol failure.

## Verification

- Focused contract, evaluator, local transport and orchestration tests: 10 suites,
  250 tests passed. New services: 100% lines/functions and 99.26% combined branches.
- Real PostgreSQL corpus projection, description and vector-cache integration:
  3 suites / 24 tests passed.
- Lint, server/client type checks, copyright/dependency preflight, static ESM imports
  and ESM mock-shape checks passed.
- Before the admission extension, full backend coverage: 1,356 suites / 39,491 tests passed in 452.665 seconds.
  Coverage ratchet passed: server 90.29% lines/statements, 83.51% branches and
  92.42% functions. Final platform verification after the admission refactor is
  recorded in the [isolation outcome](inventory-benchmark-isolation-outcome.md).
- The separate production-naming gate still reports 43 pre-existing references
  against its zero baseline. None were added or waived by this change.

The preceding commit's CI and database tests completed successfully, as did CodeQL,
Gitleaks, OSV, Trivy and copyright workflows. GitHub MCP returned no open PRs at the
start of this work; no random open PR was available and no PR was merged.

## Recommendation and next item

Do not confuse stricter output validation with better classification. The current
five-call experiment costs more calls than its two-call control and creates no
automatic-routing authorization. It adds no acknowledgement screen.

The next item is a materially different scoring architecture: a dedicated local
cross-encoder with a capability-checked ESM adapter, revision-aware caching and
automatic outage recovery. The separate
[next-step reassessment](library-learning-next-step-reassessment.md) compares
technologies, prior failed approaches, implementation scope and explicit stop
conditions. Do not continue cycling through chat prompts or lowering thresholds.

No release, version increment, tag, new model download or remote provider was used.
