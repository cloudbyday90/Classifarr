# Adopted RAG result context outcome

November 13, 2026 Eastern. The implementation follows confirmed Q1 in the
[design](adopted-rag-result-context-design.md), on main from baseline
`26db6c5c47f45bf86f1cab0c22cda5f32754102d`.

## Implemented behavior

Fulfilled adopted verification results now retain the exact context passed to
their invocation and the advisory supplied by the current result. A fresh
confirmation supplies explicit advisory absence, clearing the inherited value.
ABSTAIN, contract violation and capability refusal retain their current
advisory through the existing result overlay.

A small pure helper in the existing verification leaf prepares the scoped
baseline after fulfillment. The stage selects it for adopted verification.
The current candidate builder then performs its existing result construction.
This makes a current B/75 result return its actual invocation's B/75 context.

The invocation context still includes earlier ranking/support fields alongside
its current destination/confidence. Its nested loaded references remain mutable.
The implementation establishes ownership at candidate construction. Freshening
the invocation's inputs is the next scoped follow-up.

The saved current-policy frame continues to provide its independently validated
ranking and review mechanics. Its existing checks detect source loss, including
later mutation of the returned invocation's selected confidence. The diagnostic
gap remains latched after that value is restored. Mutating earlier support
ranking follows the existing loaded-reference lifecycle.

## Consumer effects

The History writer stores null advisory after current confirmation. It stores
the current bounded advisory for review outcomes. Existing nested signal and
retrieval fallbacks retain their invocation data. The temporary question builder
receives the existing summary, and normalization removes that summary from the
ordinary saved question.

Clearing the advisory changes its decision-summary category and therefore the
answer fingerprint. The saved-frame recommendation and score retain their own
evidence source. Both pending and confidence Discord entry points construct
buttons with the current fingerprint. Current contract validation rejects the
earlier advisory fingerprint.

Actual PostgreSQL resolution rejects that earlier fingerprint while leaving the
row awaiting decision. A current answer commits once, and its exact replay
returns the completed receipt with `shouldRoute:false`.

## Verification

Focused verification passes 331 tests in ten suites. Production-factory isolated
PostgreSQL verification passes 39 tests in two suites. The controls exercise
the real evaluator fixtures, actual loopback Ollama/OpenAI transports, all four
fulfilled statuses, same/different destinations, maximum intermediate confidence,
advisory replacement/absence, copied and missing diagnostic proof, optional
profile omissions, long labels, apply/shadow/comparison rejection and rollout
mutation. Cap, resilience, mode, permanent-error and transient-error paths retain
their established candidate and accounting behavior.

Persistence controls cover current frames, nested signal/retrieval fallbacks,
canonical row binding, concurrent pending replacement, rollback, delayed/lost
acknowledgement, stale answers and exact completed replay. Both Discord formatters
use the current saved contract and reject the earlier fingerprint in validation.

The first focused run found two assertions observing the service method after
the loop owner had already captured its callable. The tests now observe the
owner's actual invocation. The confidence-notification fixture also now supplies
the awaiting-decision state used by the pending flow. These fixture corrections
retain actual HTTP dispatch and strict fingerprint assertions.

Typechecks, server/client lint, dependency declarations, ownership and policy
checks pass. Full npm audits report zero root findings, zero client findings and
the same five low server tooling entries as the baseline. Exact server finding
records match the previous audit.

Fresh full backend coverage passes 1,947 suites and 63,551 tests, with one
existing skip, in 739.298 seconds. Statements/branches/functions/lines coverage
is 89.34 / 86.83 / 90.89 / 89.34 percent. The joint ratchet passes with the fresh
backend report and verified retained client report. All 7,455 non-Markdown paths
and hashes match the pre-coverage snapshot.

Client reuse checks verify all 1,231
input hashes, the installed dependency graph and retained coverage JSON hash
`58628fd1337bbfad8c5b9e61ceb92f9438b9748246231498cc3847014a800d5f`.
The retained evidence covers 7,569 client tests in 488 files, production build
and 13 browser controls.

## PR assessment and delivery

Current intake again selects the sole open PR, 589, at immutable head
`c6137f1467319a048e2d6babfe27dc6bb9859ffa`. All eleven reviewed compiler artifact
versions/integrities match the prior assessment. Retain the demonstrated
deferral and compatible 3.3.13 graph. The five candidate control failures are
prior executions. The [compiler investigation](vue-compiler-graph-investigation.md)
records their causes and the coherent-candidate recommendation.
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589).

The existing application execution and review surfaces receive the result
automatically. The implementation touches two existing service modules. Artifact
reconciliation confirms the same Docker daemon, seven unchanged containers,
four protected worktrees and 471 unchanged image/tag records. Current evidence
and recovery assets remain protected. This pass removes zero files and images.
Exact-source CI is checked after the authorized main push.

Next evaluate fresh, coherent ranking/support inputs for adopted verification,
with an explicit contract for source availability, provider admission and call
accounting. The current batch makes the returned envelope accurately identify
the invocation that produced it.
