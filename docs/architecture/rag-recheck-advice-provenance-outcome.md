# Adopted RAG recheck advice provenance outcome

November 11, 2026 Eastern. Baseline main
`e9c6d87d696f83c381944f9667b5e478741a9a0a`. The operator confirmed the
consumer boundary in Q1 and complete contract in Q2 before implementation.
The [investigation](rag-recheck-advice-provenance-investigation.md) records
official research, alternatives and PR review; the separate
[design](rag-recheck-advice-provenance-design.md) records the agreed contract.

## Implemented behavior

An adopted prompt-confirm RAG recheck now obtains optional advice/profile from
its successful fresh evaluation and exact expanded item. It no longer uses the
earlier context's breakdown, diagnostics or raw policy-section override for
that optional material.

`ragRecheckVerificationAdvice` holds a minimal fresh source immediately after
reevaluation. Private maps associate it with the exact successful stage, gate,
result and adopted candidate. The adopted rerun consumes that stage association
once and produces a private, single-use request handle. Matching fields, copies,
serialization, another item/pool/candidate or a retained result are insufficient.
No public result field or durable capture was added.

The existing retargeted verification context remains unchanged for candidate
admission, instructions and parsing. A RAG session supplies the fresh source
context to the established advice adapter and adds a validity guard requiring
agreement with that exact consumer's selected pool object/confidence and the
original stage/candidate association. Initial verification retains its existing
exact-context checks; the guard adds a condition rather than relaxing them.

The existing selection-only projection, profile lookup association, fixed
display prefixes, strict labels/fields, count/byte limits and omission lifecycle
are reused. Source or consumer changes after awaited work omit optional data;
observed invalidation cannot be reversed in that session. Prompt assembly keeps
its qualified-build-plus-one-omission bound and remains separate from transport
retry/refusal/capability handling.

The service passes the private stage through existing orchestration. AI counters,
configured caps, adoption/failure retention, resilience, rollout and route/learning
authorization remain unchanged. Non-adopted verification and final result's
baseline-context precedence are deliberately unchanged, including their earlier
context limitations. Profile placement remains observational evidence.

## Verification

Qualified local checks:

- Seven suites, 237 tests passed. Coverage includes native/compatibility live
  proof, one-use/copied/replaced/cross-item handoffs, skipped/failed/timed-out
  reevaluations and late completion, post-await source/consumer mutation,
  hostile accessors and the existing projection/resource limits.
- Real loopback Ollama/OpenAI-compatible requests prove fresh optional advice,
  copied-proof omission, unchanged strict verification and capability refusal,
  item-call caps and current stream retry boundaries. A whole production RAG
  owner test covers fresh metadata expansion, both stage handoffs and HTTP,
  rather than qualifying only a detached helper.
- Three production-factory PostgreSQL suites, 23 tests passed. Genuine native
  and compatibility rechecks bind one later library-specific profile query;
  copied results omit it with zero extra reads. Existing RAG apply/shadow and
  provider-failure/pending-resolution controls remain covered.
- Fresh backend coverage: 1,944 suites passed; 63,290 tests passed, one skipped.
  Statements/lines 89.32%, branches 86.81%, functions 90.87%. The coverage ratchet
  passed. All 7,442 frozen non-document inputs remained unchanged.
- Eleven browser checks passed, including three pending-review cases and eight
  production-asset cases with a fresh client production build.
- Backend/client type checks and lint, both backend dependency analyses,
  ownership, naming/language/removal/maintenance, ESM import/mock-shape,
  copyright and console-spy checks passed. The staged secret scan found no leaks.

Client coverage was reused after all 1,160 recorded inputs and the full installed
graph were verified unchanged. The report still contains 7,569 passing tests in
488 files, with SHA-256
`f505af45709e9e34ed021f7209a43304e445a05b9e07f63cfd91df9d4804579d`.

The initial whole-owner fixture stopped at the existing minimum-metadata gate;
adding its required synthetic metadata made it eligible without changing the
application's gate. An existing adopted-rerun assertion was updated only to
include the internal unavailable-advice marker; its target/confidence contract
and the non-adopted original-context assertion remain intact.

Fresh full audits show zero root/client findings and the same five low server
tooling findings. No package, lock, toolchain, install/scanner policy, triage
expiry or security exception changed. Existing runtime security limitations
remain outside this advice-association change.

## PR, maintenance and delivery

Current random singleton selection remains
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589). Its immutable
compiler proposal is unchanged and retains the
[demonstrated deferral](client-compiler-pr-589-outcome.md). No applicable stale
branch, compatible new subset, installation or PR merge was established.
Delivery recheck confirms the same head
`c6137f1467319a048e2d6babfe27dc6bb9859ffa`, mergeable with unstable checks.
No branch was rebased solely because main advanced.

Artifact inspection reuses the same-day scoped inventory, preserves current
evidence, worktrees, toolchains, recovery assets, other services/projects,
volumes and shared build cache. No artifact was newly verified for deletion;
no local image was built. Final comparison confirms all seven preexisting
container identities, images, start times and health/status values unchanged.
No files/images were removed; about 1.05 TB of host space remained free. Global
space movement is not attributed to this no-op cleanup. Private receipts remain
under `.tmp/rag-recheck-advice-assessment`.

The authorized commit/push follows these local checks. Hosted workflow receipts
are inspected separately for that exact revision; these results do not qualify
a different source, image, release or deployment.

## Limitations and next recommendation

This is successful-stage and loaded-snapshot association, not current database
freshness, full metadata/rule immutability, profile accuracy or correct
classification. Existing query duration, Promise assimilation, provider lock
and transport behavior are not bounded by the projection. Late evaluation
execution is not cancelled or replayed by this new evidence handoff.

Next, assess non-adopted verification-context coherence as a separate behavior
change: it can still use the earlier destination/confidence, and repairing it
may change admission, parsing and provider dispatch. Then assess retained result
context and its persistence semantics; this batch intentionally does not make
those claims.

The application uses existing automatic work and controls. No query, provider
call, public result field, schema, API/UI, setting, job, operator CLI trigger,
live configuration write, historical backfill, release or deployment is added.
