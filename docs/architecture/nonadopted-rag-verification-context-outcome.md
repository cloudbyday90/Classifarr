# Fresh non-adopted RAG verification context outcome

November 11, 2026 Eastern. Implements the confirmed Q1/Q2 contract in the
[design](nonadopted-rag-verification-context-design.md), following the separate
[investigation](nonadopted-rag-verification-context-investigation.md). Baseline:
`37cd4c38edf2c360bdf81cab3e7532434dd3beaf` on main.

## Delivered behavior

An already-eligible non-adopted RAG verification now uses the successful fresh
recheck's destination and overall confidence together. For example, original
prompt-confirm A/80 and fresh prompt-confirm B/75 now verify B/75. A CONFIRM,
ABSTAIN, strict-output violation or capability refusal derives its numeric
reference from that same fresh context, including when the destination stays
the same and only confidence changes.

The intermediate policy adoption gate remains false in this reproduction. The
existing final comparison and apply/shadow rollout decide whether to use the
verification result. This can change actual provider dispatch and review/final
results; it does not change scoring, configured caps, provider capability/schema
requirements or routing/learning authorization.

`nonadoptedRagVerification.mjs` privately associates the actual fulfilled
evaluation with its exact item, loaded pool, stage and non-adopted gate. It
reuses the genuine live selection witness and its 64-candidate/64-library/
16-KiB limits. One consumed handoff prepares a minimal fresh context and a
single-entry request. It never spreads earlier breakdown, diagnostics or raw
policy advice into that context. Numeric authority stays independent of optional
profile/full-label availability and its existing bounded projection.

Continued checks cover fulfilled configuration/provider/admission work, profile
completion, lock acquisition under cleanup coverage, prompt assembly, each
existing generation-attempt entry and owner acceptance after the AI service
settles. Observed invalidation stays latched for that lifecycle. Missing, copied,
retained, failed, timed-out, changed or overflowing proof cannot become a guessed
verification request.

`nonadoptedRagVerificationRefusal.mjs` supplies a private error identity. Provider
messages or codes cannot manufacture it. A local proof refusal returns the
existing skipped stage shape and context-missing reason, retaining baseline
without provider-failure classification, cooldown, repair or replay.

| Boundary | Accounting and result |
| --- | --- |
| Missing proof before AI-service invocation | No additional invocation; no configuration/profile/provider work |
| Proof loss after AI-service entry, before generation | Invocation stays charged; no generation or provider-failure observation |
| Genuine capability refusal | Invocation stays charged; existing refusal uses fresh destination/confidence |
| Proof loss during entered transport or metric completion | Preserve completed observations; discard rerun result and retain baseline |
| Actual stream failure before proof prevents its retry | Keep that error and its observations; no second HTTP attempt |

The new private checks do not cancel already-entered transport or claim an exact
HTTP-dispatch fence. They add no refund or uncertain replay. Genuine rejected
operations and existing cleanup/metric-error precedence remain intact.

## Verification

Qualified local checks:

- Seven focused suites, 282 tests passed. These cover genuine native/compatibility
  sources, copied/reused/cross-item/stage/gate mutation, one-use handoffs, hostile
  accessors, retained/skipped/failed/timed-out/late evaluations, overflow and
  unchanged eligibility exceptions.
- Real loopback Ollama/OpenAI-compatible requests cover A/80 to B/75 and
  same-destination confidence, CONFIRM/ABSTAIN/invalid/capability-refused output,
  pre-invocation omission, asynchronous proof loss, actual completed observation
  retention and earlier real stream-error precedence. Production RAG orchestration
  covers fresh metadata expansion and both apply/shadow modes.
- Three production-factory isolated PostgreSQL suites, 27 tests passed. Genuine
  native/compatibility non-adopted stages admit one correctly associated profile
  query; copied results skip with zero further reads. Existing pending explicit
  resolution/replay, provider-failure and RAG rollout controls also pass.
- Eleven browser checks passed: three pending-review tests and eight production-
  asset tests, with a fresh client build. Fixtures retain their assertions and
  deadlines; expected unavailable-status observations remain fixture behavior.
- Backend/client type checks and lint, both backend dependency analyses,
  ownership, naming/language/removal/maintenance, ESM import/mock-shape,
  copyright and console-spy checks passed. No ownership classification, parser
  pin, analysis baseline or authorization gate changed.

Fresh backend coverage passed: 1,945 suites, 63,368 tests passed and one existing
skip. Statements/lines 89.33%, branches 86.82%, functions 90.88%. The new private
reference and refusal leaves have 100% statement/line/function coverage. All
7,446 frozen non-document inputs stayed unchanged throughout the run. The coverage
ratchet passed. Coverage summary SHA-256:
`cf802cf8fdecc8c9a51f268b2ef39fafee9c3d55881020a8e06dfc898ae63b8c`.

Client coverage is reused after all 1,160 recorded inputs, its full installed graph
and report hash were verified unchanged. That report contains 7,569 passing tests
in 488 files, with SHA-256
`f505af45709e9e34ed021f7209a43304e445a05b9e07f63cfd91df9d4804579d`.

Fresh full audits show zero root/client findings and the same five low server
tooling findings, including identical finding details. No manifest, lockfile,
toolchain, install/scanner policy, triage expiry or security exception changes.
This context fix does not remediate unrelated runtime security limitations.

## Research, tradeoffs and recommendation stack

Official sources were discovered through MCP and rechecked November 11:
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/),
[OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
and [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
Their application here is explicit source/consumer association, validated model
output and separate server authorization. No PROV conformance or accuracy claim
is made; no new web surface requires another operator process.

| Choice | Benefit | Cost or limitation |
| --- | --- | --- |
| Genuine fresh reference with continued checks | Coherent verification; intentional baseline retention on unknown proof | Conservative availability and a small private refusal lifecycle |
| Reuse structural fields or old context | Less plumbing | Retained/copied data can masquerade as fresh evidence; reject |
| Repair stored context in the same change | Broader coherence | Changes downstream evidence semantics; separate next batch |

Recommended sequence: deliver this bounded request-context fix, then examine
retained/persisted result context, then assess stronger database freshness or
transport-internal fencing only with their own uncertainty and cancellation
contracts. No operator CLI trigger, new UI or recurring manual step is needed.

## PR, maintenance and delivery

The current open-PR inventory still contains only
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589), so uniform random
singleton selection chooses it. Its head remains
`c6137f1467319a048e2d6babfe27dc6bb9859ffa`, mergeable with unstable checks. Its
unchanged compiler proposal retains the
[demonstrated deferral](client-compiler-pr-589-outcome.md). No new compatible
subset or genuinely stale applicable branch was established; no dependency
installation, branch rebase or PR merge is represented as completed.

The artifact-maintenance intake reused the same-day scoped inventory. Recovery
assets, current evidence, worktrees, toolchains, other projects/services, volumes
and shared cache remain protected. No artifact was newly verified for removal,
no file/image was removed and no image was built. The same daemon and all seven
preexisting container identities, images, start times and health/status values
remain unchanged. About 1.05 TB of host space remains free; global space movement
is not attributed to this no-op maintenance.
Private verification receipts stay in `.tmp/nonadopted-rag-verification-assessment`.

Unreleased records this behavior change. Commit/push on main follows final
verification; hosted workflow receipts will be inspected for that exact revision.
No release or deployment is created.

## Limits and next item

This proves loaded-snapshot consistency at the named application boundaries,
not current database freshness, full rule/metadata immutability, correctness of
classification or bounded transport/shutdown. Entered HTTP may still finish.
Optional profile placement remains observed evidence, not verified labels.

Next, trace retained result context through `buildAiRerunCandidate` and persistence.
Its existing baseline-context precedence remains deliberately unchanged, so a
fresh verification result can still retain earlier `signalContext`. Define the
reference meanings and downstream consumers before changing that evidence.
Keep initial/adopted verification, historical records and routing/learning
authority separate from that assessment.

This batch adds no query, provider-call site or attempt allowance, public result
field, schema, API/UI, setting, job, operator CLI trigger, live write, historical
inference, release or deployment. Existing calls formerly rejected for stale
context can now dispatch when the agreed fresh reference admits them.
