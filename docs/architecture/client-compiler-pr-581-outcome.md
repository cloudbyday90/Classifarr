# Client compiler PR 581 compatibility assessment outcome

Date: 2026-11-02 (America/New_York). Status: assessed and verified; candidate deferred.
Design: [agreed differential assessment](client-compiler-pr-581-design.md).

## Decision

Retain exact vue-tsc 3.3.13 and its complete compiler graph. The randomly selected
[PR 581](https://github.com/cloudbyday90/Classifarr/pull/581), reviewed at head
15b66950a5739e6fdb5290f2cf4c0120d4259015, was installed and assessed locally but
is inapplicable: its 3.3.14 compiler fails five of twelve new normative controls.
The PR remains unmerged. Permanent baseline-compatible regression tests are kept;
no application syntax, compiler flags, typecheck scopes or diagnostic assertions
were weakened to accept the update.

The ordinary two project typechecks passed on the candidate. That does not
discharge the targeted failures: those commands do not enroll every application
SFC or reported template pattern. These are locally reproduced compiler-contract
regressions using synthetic fixtures, not proof that current shipped application
source or a production classification request fails.

## Review, install and differential results

The exact candidate and complete published graph were reviewed before strict
installation. The generated lock changed the root declaration and six package
artifacts, added five matching compiler/protocol packages and removed none.
Published integrity matched all eleven changed/added artifacts. Engines and
peers fit Node 24.22.1/TypeScript 6.0.3; Volar's TypeScript <7 peer is optional.
No reviewed artifact adds a native/platform restriction or install lifecycle
hook. Existing overrides and strict script decisions stayed intact.

Strict npm ci installed 300 packages. Its full tree was valid, and its audit
reported eleven moderate affected nodes, zero high/critical, with the existing
tooling advisory chains. Then identical real-CLI controls ran on both versions:

| Control | 3.3.13 | 3.3.14 |
| --- | --- | --- |
| Reactive non-Ref model, URL literal | Pass | False TS2339 about value |
| Contextual event inference, URL literal | Pass | False TS7006 implicit-any parameter |
| Invalid operation on inferred numeric event, URL literal | Exact TS2339 | Wrong TS7006; expected operation diagnostic missing |
| Whole-slot default with imported-property read | Pass | Generated TS1005/TS1181 |
| Same slot plus unrelated included .ts semantic sentinel | Exact TS2322 | TS2322 missing; generated syntax errors instead |
| Seven non-URL / slot-variant controls | Pass | Pass |

The baseline passed 12/12 in 11.16 seconds; the candidate passed seven and failed
five in 10.59 seconds. The assertions were unchanged across versions. The helper
retains no-shell execution, sanitized environment, 384-MiB heap, 30-second timeout,
1-MiB output and owned temporary cleanup. Fixed companion filenames and explicit
.ts inclusion enable the multi-file semantic sentinel without a generic runner.
Existing source-mapped negative checks still require the exact diagnostic and
reject unrelated startup/syntax errors.

The entire baseline manifest/lock was restored and strict npm ci reinstalled
295 packages. All nine intake hashes for the three workspaces' manifests, locks
and installed locks match exactly. Installed vue-tsc/language-core are 3.3.13,
Volar TypeScript is 2.4.28 and TypeScript remains 6.0.3. The restored focused
six-file tooling run passes all 102 tests. No dependency manifest/lock change is
part of the final commit.

## Audit, recommendations and remaining evidence

November 2 follow-up at base a85ec7eb76e80ba1ad86ef16fef35f999f281080:
a new uniform random selection again chose PR 581. MCP confirms its exact head
15b66950a5739e6fdb5290f2cf4c0120d4259015 and published artifact are unchanged.
The installed baseline graph and client inputs also match the prior assessment.
The official release and issues linked below still establish no fixed candidate.
Retain this settled deferral without reinstalling identical known-failing inputs.
The retained compiler's twelve real-CLI controls were freshly rerun and pass;
the five candidate failures above remain prior executions. See the separate
[publication investigation outcome](source-pair-publication-admission-outcome.md)
for current audits, evidence provenance and delivery checks.

Full retained-tree audits include development dependencies: root has zero
findings, server has 29 moderate / three low affected nodes, and client has eleven
moderate nodes. There are no high/critical findings; both runtime-only audits
are clear. These are npm affected-node counts, not unique platform alerts or a
claim of exploitability. Existing advisory/scanner policy and the independent
npm bundled-parser hold are unchanged.

The official [3.3.14 release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14)
and open upstream reports [6322](https://github.com/vuejs/language-tools/issues/6322)
and [6328](https://github.com/vuejs/language-tools/issues/6328) were read through
MCP on November 2. They guided the synthetic controls; their open status alone
was not used as proof of an application failure. No fixed-release link was
established. Reassess a coherent later published compiler with these same
controls and the existing gates before changing the pin.

Recommendation stack: retain the proven baseline and semantic regression guards,
keep the selected PR deferred, assess an upstream fixed compiler separately,
and preserve independent runtime ownership and npm/tooling follow-ups. This
foregoes the newer compiler's improvements while protecting diagnostic authority.
Do not bypass failures with application workarounds, version mixing or ignores.

The application's next ownership investigation is
[read-time quota/retention maintenance](capture-advance-fence-outcome.md#ownership-review-and-remaining-limits),
separate from this dependency decision. No second PR was randomly selected to
replace the inconvenient assessment result.

## Final verification and delivery

Fresh client coverage passes 484 files / 7,521 tests in 218.08 seconds. Coverage
S/B/F/L is 87.90 / 82.04 / 87.69 / 89.57 percent. The production Vite build and
all eight Chromium asset/navigation checks pass. Fresh backend coverage passes
1,924 suites / 62,341 tests with one existing skip in 894.957 seconds. Backend
coverage S/B/F/L is 89.25 / 86.64 / 90.80 / 89.25 percent. The joint ratchet passes
with both current reports and no baseline changes; no earlier report is reused.
Lint/types, both Knip gates, source/policy/ownership checks, Markdown, staged
secret and whitespace checks pass. The dependency/tooling suite passes 72/72.

The delivery recheck found independent
[PR 580](https://github.com/cloudbyday90/Classifarr/pull/580) unmergeable at its
original single Dependabot commit 58468cabc7753b37902201ce8baf7c3145a4f623.
Rebased that existing branch onto main base 7285cbb6a in an owned detached
checkout, without creating a named branch or switching the primary checkout.
Range comparison and stable patch ID prove its provider patch is unchanged:
only server/package.json and server/package-lock.json retain the ESLint 10.14.0
proposal. The lock-only package tree is valid. An explicit force-with-lease
protected the original remote head while publishing replacement commit
46ba6518b0bca0ddc8a19da52ba8ee7a2e080f52. Remote/MCP checks confirm that head is
open, unmerged and mergeable. The owned temporary worktree was removed through
Git after path/head/clean-state checks; every pre-existing worktree is retained.

This is branch synchronization, not local adoption or a claim its new CI gates
pass. Server ESLint/parser pins and the installed main tree remain unchanged;
the unselected tooling update still needs its own parser/ownership review before
adoption. Selected PR 581 stays open and unmerged with its demonstrated compiler
deferral. No second random selection was made.

Separate design/outcome documents, relevant follow-ups and Unreleased record the
result. Work stays on main with no release, deployment, PR merge, new UI,
operator CLI trigger or production behavior workaround. Private candidate,
restored-tree and branch-maintenance receipts stay under .tmp.

Final artifact reconciliation confirms the same desktop-linux daemon, three
unchanged containers and 425 comparable image-tag rows. Classifarr remains healthy
with unchanged identity/image/start time. No pre-existing artifacts or images
were retired; existing recovery assets, worktrees and shared resources remain
protected. The sole worktree removal was the newly owned rebase checkout above.

## November 2 repeated selection recheck

During the subsequent [budget maintenance batch](adjudication-budget-maintenance-outcome.md),
a new uniform selection from the two current open PRs again chose 581. MCP
confirms the same head 15b66950a5739e6fdb5290f2cf4c0120d4259015, still open and
unmerged. The registry still publishes 3.3.14 as latest, with integrity matching
the saved candidate lock. Original reports 6322/6328 remain open/pending triage;
no fixed published candidate was established.

Reuse the settled deferral and prior 12/12 baseline, 7/12 candidate and restored
102/102 focused receipts. These are prior tests, not new executions. Current
client source/tree/report checks match the verified baseline. No compiler install,
dependency edit, new fixture scope or second random selection is warranted.
Keep npm unchanged, leave PRs unmerged and rebase only genuine applicable drift.

## November 8 review-recommendation selection

The [shared review-reference batch](review-recommendation-reference-design.md)
made one uniform random selection from currently open PRs 580 and 581 and chose
581. MCP confirms the same head 15b66950a5739e6fdb5290f2cf4c0120d4259015, open,
unmerged and mergeable. The two-file immutable diff and registry integrity for
vue-tsc 3.3.14 still match the assessed artifact. The registry's latest is still
3.3.14; reports 6322 and 6328 remain open. A newly updated issue is not evidence
of a repaired published compiler artifact.

Retain the established deferral and exact 3.3.13 compiler graph. The five failing
candidate controls above are prior executions, not new tests in this batch.
Normal current-tree compiler controls and quality gates will run with the
presentation implementation. Neither an unchanged known-failing candidate nor
the already adopted server ESLint patch warrants a forced new dependency edit.
Both PRs are mergeable at intake; recheck at delivery before any synchronization.

## November 8 provenance-scoring selection

The [provenance-aware scoring batch](policy-provenance-scoring-design.md) again
selected 581 uniformly from the two current open PRs, at 2026-11-09T02:05:26Z.
Fresh MCP retrieval confirms the unchanged two-file diff and exact head
15b66950a5739e6fdb5290f2cf4c0120d4259015. Published 3.3.14 integrity still matches
the demonstrated failing compiler; no fixed published replacement was found.
Reports 6322 and 6328 remain open. Retain 3.3.13 and distinguish prior candidate
failures from current baseline verification; do not reinstall an identical
known-failing graph or weaken template diagnostics to adopt it.

The MCP mergeable boolean reported false, but a fresh direct GitHub REST/CLI
check established both 580 and 581 as MERGEABLE with UNSTABLE checks. That state
is not a branch conflict. Server ESLint 10.14.0 from 580 is already installed.
No genuinely stale applicable branch was established, so no rebase, comment,
merge, close or replacement PR was performed. Delivery rechecks and current
baseline control results are recorded in the scoring outcome.
