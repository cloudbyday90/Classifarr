# Review-held automatic policy outcome

November 14, 2026. Implementation of the
[agreed design](review-held-auto-policy-design.md), following the
[source investigation](review-held-auto-policy-investigation.md).

## Result

New retained adopted automatic-policy candidates now publish a distinct
`policy.current_review.v3` source. The ordinary History writer admits that source
only after deriving `awaiting_decision`. Its single existing INSERT binds the
closed frame to the actual row ID and typed item. Completed automatic and retry
rows use the ordinary INSERT and receive no automatic review frame.

When fresh B/90 replaced original A/80 and an independent hold required review,
the old reader could recommend A/80. A valid v3 frame now supplies B's current
destination, score and evidence. Original `metadata.policyResult` stays intact.
Missing, copied, changed or excessive proof produces a version-bound evidence
gap rather than reviving A. v1 confirmation and v2 selection contracts retain
their previous meanings.

Existing current-reference rules govern the primary and bulk shortcut. They can
expose B where inherited unbound comparison advice formerly suppressed it; this
is an intentional recommendation/default change. Saved routing holds and server
command authorization remain independent. Missing or corrupt safety evidence
with an otherwise recorded automatic score keeps the existing stale/retry-only
protection. A policy gap keeps existing generic explicit-destination semantics.

Every newly constructed adopted automatic candidate also clears inherited
`candidate_bound_verification`. No verification ran for that new candidate. The
original baseline and historical rows remain untouched; genuine provider
observations and accounting remain unchanged. Future confirmation/abstention
statistics consequently stop counting an earlier candidate's status.

## Implementation boundaries

Small version and live-receipt helpers retain exact action/method association.
The private attempted marker carries the automatic version through unknown
copies without granting evidence authority. Known owner copies retain the
private receipt; ordinary spread copies become explicit gaps. This private marker
is process-local and does not survive JSON serialization or grant cross-process
authority. Publication still follows final apply selection and fulfilled rollout.

The shared evidence contract retains the complete ranking of at most 64 candidates,
five detailed projections, six score components and a 64-KiB payload bound. Its
underlying live numeric witness retains the 64-candidate/64-library/16-KiB bounds.
No raw rules, prompts, retrieved content or provider text enter the new frame.
Evidence survives with its History row, including configuration restores, and is
deleted with that row. No export, expiry job or configuration freshness read was
added.

Automatic context/advisory inheritance remains as agreed. Normal automatic
routing, scoring, thresholds, comparison/rollout, retries, charged attempts,
authorization, native questions and completed replay retain their existing
owners. No new endpoint, page, public field, provider call, SQL round trip, schema,
setting, background job or operator CLI requirement was introduced.

## Verification

Focused tests exercise real scoring and decision projection for native and
compatibility origins, actual RAG stages and the production RAG owner. They cover
apply/shadow/rejection, rollout mutation, copied/offline/overflow proof, action and
method binding, latched gaps, hostile descriptors, question membership, exact
candidate limits, byte admission and independent missing-safety refusal.

The production database factory against isolated PostgreSQL verifies genuine
policy loading/evaluation, authority/admin/low-confidence holds, completed/retry
exclusions, authoritative derived-state admission despite later flag mutation,
pre-INSERT evidence loss, BIGINT row binding, ordinary concurrent replacement,
rollback and lost/delayed acknowledgement. Loopback HTTP confirms stale answers
cannot route and either current or alternative explicit destinations resolve once
through the existing receipt. New candidates do not add inherited verification
counts; retained historical evidence remains counted.

Both Discord notification paths use the saved current contract and fingerprint.
Browser controls exercise the existing compact disclosure, keyboard destination
commands and narrow layouts without adding interface elements. Fresh client
coverage passes 488 files / 7,587 tests with statements/branches/functions/lines
87.93% / 82.17% / 87.71% / 89.61%. The first default-four-worker run hit the existing
six-second bound in seven Vue subprocess controls; the other 487 files passed.
All seven controls passed in isolation with unchanged deadlines. The fresh full
rerun used two local workers and passed without changing assertions, deadlines,
configuration or package contents. The client build and all eight production
browser controls pass.

Fresh backend coverage passes 1,952 suites / 63,856 tests, with one existing skip,
in 938.699 seconds. Statements/branches/functions/lines are
89.35% / 86.85% / 90.91% / 89.35%. Focused source/owner/contract/Discord verification
passes eight suites / 359 tests; the final added boundary controls are also covered
by the full run. Isolated production-factory PostgreSQL verification passes two
suites / 97 tests.

Type checks, server/client lint, development/production dependency analysis,
ownership inventory, npm flag policy, naming/language/delivery/runtime audits,
ESM checks and copyright checks pass. No ownership baseline, review cap, parser
pin or scanner policy was relaxed. Fresh full audits report zero root/client
findings and the existing five low-severity server tooling entries. The scoped
server triage remains unchanged. Staged secrets and Markdown checks are clean.
The final coverage ratchet passes, and the frozen non-Markdown source hash is
unchanged through validation. Exact-source pushed CI is assessed separately from
these local receipts; a local result is not a pushed CI result.

The broader development-browser sweep passed 100 cases, including all current
review/primary/bulk/gap controls, and failed five untouched pgvector startup cases.
Their expected `pgvector startup compatibility` region and explanatory fields no
longer match the concise `pgvector` facts panel introduced by existing commit
`e50019ffb`. The fixture mounted successfully and displayed that current panel.
Both panel and old test bytes are unchanged by this batch. This is a separate
stale-browser-contract follow-up, not a passed whole-browser gate. Screenshots,
traces and the original report are preserved privately; no assertions, timeouts
or UI were changed to conceal it.

## Research and recommendation stack

[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) supports tracking the input that
actually influenced a derived result. The application inference is to preserve
original decision evidence separately from the current review evaluation.
[OWASP decision/output guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Decisions_And_Output_Handling_Cheat_Sheet.html)
supports keeping contextual evidence and authorization checks bound to their
actual subject/action. The saved frame supplies evidence, not permission.
[WAI input predictability](https://www.w3.org/WAI/WCAG22/Understanding/on-input)
and [labels/instructions guidance](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
support the existing intentional controls; these explanatory resources do not
mandate another confirmation ceremony or establish full accessibility conformance.

| Approach | Benefit | Cost |
| --- | --- | --- |
| Retain original review source | No new contract | Can recommend the earlier destination |
| Replace mutable context alone | Cleaner returned support | Saved review mismatch remains |
| Distinct current frame for held auto | Coherent technical reference and preserved hold | Version/cohort checks and changed defaults/fingerprints |

Recommended stack: live evaluation proof, exact action/method-bound association,
final apply publication, derived pending-state admission, transactional row
binding, independent saved safety and existing authorized operator commands.

## Follow-ups and limitations

The immediate quality follow-up is to synchronize the five stale pgvector browser
expectations with the already chosen concise panel, preserving meaningful fact,
staleness, mismatch, accessibility and no-health-claim assertions. Do not describe
the full development-browser suite as green until that separate fix is verified.

The separate [browser-contract outcome](pgvector-browser-contract-outcome.md)
records that follow-up without changing the concise panel or health behavior.

The next ordinary classification cleanup is construction-owned context/advisory
for adopted automatic candidates. This batch deliberately preserves their earlier
context/advisory, while correcting saved review evidence independently. Settle
that behavior separately before implementation.

That construction-owned cleanup is implemented and verified in the separate
[automatic result-context outcome](adopted-auto-result-context-outcome.md).

An isolated test also reproduced a separate pending-replacement precision defect:
the existing lifecycle's `positiveInteger` coerces an active row ID through
`Number` and permits unsafe integers. ID `9007199254740993` rounds to
`9007199254740992`, so the supersession UPDATE misses its predecessor and the next
pending INSERT hits the unique identity constraint. No production occurrence was
established. This batch proves exact single-row BIGINT frame binding and ordinary
safe-range concurrency separately; it does not claim to repair replacement-ID
precision. A follow-up should preserve canonical BIGINT text through lifecycle
supersession, notification predicates and result handling, with real concurrency,
rollback and receipt controls.

No open PR was available at intake or the subsequent implementation check. No
closed PR was reused, no PR was merged and no unrelated dependency was changed.
Delivery rechecks open PRs and exact-source CI separately. No release or deployment
is part of this change.

## Local artifact maintenance

The pre-build inventory retained fourteen containers, 473 comparable image/tag
rows and four worktrees. Temporary storage was already inventoried without
following links; aged large entries contain protected recovery/reference assets,
models, toolchains or insufficiently attributed outputs. Current evidence remains
protected.

The post-browser reconciliation retains all fourteen original container identities,
states and start times, all 473 image IDs/tags/creation times and all four worktrees.
Four additional stopped containers were observed on the shared daemon; their
Classifarr ownership was not established and they were preserved. Relative image
age labels changed naturally; comparison of stable fields shows no image drift.
No files, images, containers, volumes, shared cache or recovery assets were removed.
