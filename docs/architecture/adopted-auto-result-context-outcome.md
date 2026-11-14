# Adopted automatic result-context outcome

November 14, 2026 (America/New_York). Implemented on main from
`cf6a314ef1c877b77ae0e0ba4df5a6293d0b675f`, following the confirmed
[design](adopted-auto-result-context-design.md). No release or deployment.

## Result and architecture

New genuinely adopted automatic candidates now receive construction-owned
`signalContext` and no inherited `ai_advisory`. The context contains exactly
the current ranking, overall confidence and loaded destination, or is null
when independent live numeric proof is unavailable. This covers candidates
that later complete, require review or become pending retry.

The reproduction was A / 80 in inherited context after native or compatibility
reevaluation adopted B / 90. The existing saved v3 frame could correctly show B
while earlier nested support and advisory remained attached. The new context
uses B's evaluation; retained outcome confidence can independently remain 98.
Original automated metadata and historical rows remain unchanged.

Two existing runtime leaves changed. The context helper admits automatic action
and retains its expected `policy_auto` method with the private single-use source.
The builder gives automatic candidates the same context/advisory null defaults
as pending policy candidates. Existing stage capture/application, actual candidate
identity and reference association are reused unchanged. No additional owner,
query, provider invocation, public field or storage version was introduced.

The 64-candidate / 64-library / 16-KiB closed numeric witness still requires exact
live item, evaluation, candidate destination and action/method agreement.
Optional labels, prompt advice and review-frame status are separate. The outer
context is frozen; referenced ranking rows and libraries are not. This proves
construction-time ownership, without a continuing freshness lease or a total
size bound on all reachable objects.

Missing optional proof adds no routing hold. Independent route restrictions,
maximum outcome confidence, verification-status clearing, top-level signals/RAG,
provider accounting, comparison and rollout remain unchanged. Shadow and refused
application retain the baseline. Automatic reruns still make zero additional AI
calls. Later reference mutation can retain populated context while independent
v3 validation correctly records a gap.

## Observed consumer effects

Earlier nested-only signals/RAG no longer supply persistence fallbacks. Explicit
top-level evidence retains precedence and exact result references. Earlier question
summaries and advisory text disappear from new automatic rows. Whole signal
context is not serialized, and original `metadata.policyResult` is preserved.

Removing the inherited advisory also removes its generic historical-advisory
notice. New answer fingerprints and Discord button IDs can change while the
current destination, score, saved holds and command meanings remain the same.
Old fingerprints are rejected before completion; exact completed receipts still
recover after later row changes. Historical records are not rewritten.

## Verification

- Six focused evaluator/stage/owner/HTTP/Discord suites: **265 passed**.
- Two isolated production-factory PostgreSQL/HTTP suites: **111 passed**.
- Fresh backend coverage: **1,953 suites, 63,887 passed tests**, with the existing
  single local skip. Statement / branch / function / line coverage is
  **89.35 / 86.85 / 90.91 / 89.35 percent**.
- Fresh affected pending-review browser suite: **11 passed**.
- Full single-worker Chromium sweep: **105 passed**.
- Fresh production client build and browser suite: **8 passed**.
- Typecheck, server/client lint, both server dependency analyses, ownership
  inventory, npm CLI policy, production naming/product-language/removal/maintenance
  audits, static imports, mock shapes and copyright checks: **passed**.
- Markdown checks: **2,553 files, zero errors**.

The automatic unit matrix uses genuine evaluation and decision projection for
native and compatibility sources. It checks retained confidence, exact references,
single-use sources, copied/offline/mismatched/changed proof, action/method crossover,
candidate/pool bounds, hostile output slots, frozen outputs and the explicit
construction-only lifetime. Shared-helper controls retain numeric-byte overflow
coverage. The 64-candidate automatic acceptance control uses corroborated
compatibility evaluation: the corresponding native fixture legitimately chooses
selection, so the test does not force an automatic action after minting proof.

PostgreSQL controls cover both provenance sources across completed, review-held
and retry outcomes, with and without explicit top-level evidence. They verify
advisory/summary removal, original evidence, v3 recorded/gap behavior, exact row
binding, safe-range replacement concurrency and single-row BIGINT binding. Both
copied-proof/no-independent-hold cases complete with null optional context and
no v3 frame. Other controls retain rollback, delayed/lost acknowledgement, stale
answer rejection and exact completed replay after the method changes.

Both saved Discord paths use the same new fingerprint and current technical
reference. Production-owner loopback controls cover apply, shadow, comparison
refusal and later rollout mutation, preserving call counts and baseline behavior.
Existing web primary/bulk/explicit-choice controls passed without UI changes.

GPT-6 Astra reviewed the actual runtime/test diff and found no blocking correctness
or scope issue. Its additional missing-proof/no-hold acceptance control was added
and passed for both provenance sources. Astra's review was read-only; test receipts
come from the implementation run.

Backend and client coverage pass the existing ratchet. Existing client unit
coverage is reused after verifying unchanged relevant source, toolchain, installed
dependency graph and report hash. Validation used Node 24.22.1 and npm 12.2.2.
All 7,470 non-Markdown source inputs remained unchanged through the full validation
run, with source-set SHA-256
`d50308d7443d333051048a857f21a28a52bcd7fd99d4afdecb701080effa3d08`.
The eventual pushed commit's own CI is inspected separately; local receipts do not
establish publication or deployment acceptance.

The unchanged client report covers 488 files and 7,587 tests, with statement /
branch / function / line coverage of 87.93 / 82.17 / 87.71 / 89.61 percent. Its
SHA-256 remains
`2fc6f1ac926ff16cb4be44ef83d23dfd4db44624973a857d73c20351e6742f36`.
The two cross-workspace unit-test inputs are unchanged health-summary and Undici
loopback helpers; neither imports the changed application context owner/builder.
The full installed client dependency graph also compares equal.

Fresh full audits report zero root/client findings and the same five low-severity
server tooling entries (`@jest/core`, `deepmerge`, `jest`, `jest-cli`,
`jest-config`). This batch adds no exception or severity relaxation; the existing
scoped server triage expires November 16 and still needs independent review before
expiry. These results are not a claim that all platform security debt is resolved.

## Research, options and recommendation stack

Official sources and application-specific inferences are recorded in the
[design](adopted-auto-result-context-design.md#independent-review-and-official-research).
W3C provenance supports tracing the inputs actually used; OWASP decision/output
guidance supports keeping diagnostic evidence separate from authorization. WAI
guidance favors useful information in existing controls. No full accessibility
or exploit-remediation claim follows from this attribution correction.

| Approach | Benefit | Cost |
| --- | --- | --- |
| Keep inherited context | No behavior change | Earlier support remains attached to a new candidate |
| Always null context | Simple removal | Discards useful genuine current evidence |
| Proven minimal context or null | Current attribution using existing proof | Changed nested fallbacks/notices/fingerprints; construction-only guarantee |
| Continuous validation | Could remove later stale context | Requires new lifetime/copy/writer contracts |

Recommend the third approach: live numeric witness, captured action/method,
construction-owned null defaults, fresh minimal context, independent saved-review
validation and route safety, final apply, transactional persistence, then exact
completed-answer recovery. It adds no operator procedure or UI clutter.

## Next item and exclusions

Prioritize the separately reproduced pending-replacement BIGINT precision defect
in `classificationPendingDecisionLifecycleService.mjs`. Its row-ID normalization
uses `Number`, so `9007199254740993` can become `9007199254740992` before the
supersession UPDATE. A later pending INSERT can then conflict with the active
identity constraint. No production occurrence was established. Design canonical
BIGINT handling through lifecycle supersession, notification predicates and
result handling, with real replacement concurrency, rollback and receipt tests.
Do not broaden unrelated item-ID normalization without tracing its consumers.

No open PR was available at intake or the implementation recheck. There was no
random applicable PR to adopt and no stale open Dependabot branch to rebase.
No closed PR was reused or PR merged. There are no dependency/scanner-policy,
scoring, schema, API/UI, scheduler, operator CLI trigger, historical inference,
live configuration, routing/learning authority, release or deployment changes.

## Local artifact maintenance

Applied the repository's artifact-maintenance skill before heavy validation and
at handoff. The initial inventory had 21 containers, 474 image/tag rows and four
worktrees on the pinned desktop-linux daemon. No stale generated output or image
was sufficiently established as disposable in this pass; protected recovery,
reference, toolchain and current evidence remained intact. No blanket prune,
volume removal or shared-cache change was made.

An interim inventory observed unrelated/shared activity, with 490 image/tag rows
and transient new test containers. All original container identities, image
references, start times and observed health remained unchanged. No global storage
change or reclaimed capacity is attributed to this task. Current browser reports
were preserved under the task's private evidence directory before subsequent runs.
