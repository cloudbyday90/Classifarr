# Provenance-aware native policy scoring outcome

Date: 2026-11-08 Eastern. Status: implemented and locally verified under the
confirmed first-batch agreement. No release or deployment.
See the separate [design, research and alternatives](policy-provenance-scoring-design.md).

## Implemented boundary

The live evaluator now records a private contribution for the matched declared
purpose subset. This record requires the exact evaluator result object and a
validated binding to typed movie/TV identity, policy, library and unchanged
native contract. It is held in a WeakMap and adds no public or stored field.
Copied/parsed diagnostics, retained cards and missing binding cannot create it.
Presentation-only v1 proof remains a separate record with its existing schema.
Both paths share the same small binding leaf.

The declared subset uses the existing rule scorer and all four combination
modes. Existing helpful boosts and avoid penalties apply after a declared
match. Mixed policies cannot transfer a stronger profile-derived rule's score
into this contribution. Source semantics follow matching declared rules,
instead of the complete mixed contract. Shared rule-scoring and source-semantics
leaves avoid duplicate formula or broad-genre implementations.

Profile-derived or unverified purpose contributes zero intent weight. Existing
profile support remains available, with no inferred-intent fallback if it is
missing. The full native evaluation still serves scope admission and its
compatibility diagnostics, including eligible zero-score inferred candidates.
The private contribution is revalidated after asynchronous supporting reads.
Actual weighted native contributions drive agreement and positive-source
diagnostics; disabled channels do not receive votes. The legacy-preset branch
keeps its prior calculation.

A disabled intent weight still leaves a genuine bound declaration available
for the existing observed-absence advisory rule. It supplies no numeric vote
or positive source. This preserves declaration precedence without confusing
it with the weighted channel; a focused regression covers that distinction.

Configured weights, positive-only normalization, strict conflicts, specialized
identity checks, calibration, ambiguity and route/learning authorization remain.
Numeric scores, ordering and threshold bands can change. Removal of a low source
is not a general guarantee of lower scores. No historical record is rescored,
no legacy heuristic statistic is reinterpreted, and no capture or schema version
changes. No new operator process, UI, endpoint, job or provider call is added.

## Regression evidence

A provider-free diagnostic loaded the original composition function from the
starting Git revision while supplying the same current supporting modules and
fixed inputs to both functions. With observed intent 80 and profile support 30,
the old composition produced raw 62.13 and two contributing votes at 1.05.
The new composition produced raw 30, intent zero and one vote at 1.0.
This establishes the composition distinction; it is not a complete historical
deployment replay, calibrated accuracy measurement or provider-routing test.

A separate controlled ablation supplies synthetic profile-derived contracts
with the previously reconciled numeric inputs to the existing specialization,
calibration and decision projections:

| Case | Old first / second scores | New first / second scores | Resulting meaning |
| --- | --- | --- | --- |
| A | 37.06 / 17.59 | 17.50 / 17.59 | Ordering reverses; close weak candidates still require manual review |
| B | 51.85 / 45.07 | 51.30 / 35.81 | First profile remains stronger; explicit selection remains required |

These controls illustrate removal of duplicated support and the remaining
profile-ordering limit. They are not new historical mixed-rule proof or labels
for an accuracy benchmark. No current policy terms are used to reconstruct old
declarations, and no underlying provider request or historical mutation occurs.

Focused native/policy suites cover mixed stronger inference, unknown-origin
matches, declared mismatch, all combination modes, helpful/avoid rules, copied
and changed proof, typed identity, asynchronous contract change, disabled
weights, generic compatibility, hard limits and observed-absence precedence.
Threshold controls exercise 59.99/60 and 84.99/85 through real specialization,
calibration and decision projection. A remaining strong RAG score without
declared specialized support stays subject to the existing weak-evidence hold.

Three isolated PostgreSQL suites pass 54 tests on the final runtime inputs.
They load real stored native contracts and provenance through the production
policy reader, verify all four mixed combination modes, retain declared sources
whose inference_state is inferred, reject unbound identities for contribution,
and cover existing review/replay safeguards. Fixtures are synthetic and
disposable; no live appdata or generation provider is accessed.

Some older positive unit fixtures omitted provenance and exact binding. They
now model actual declarations; distinct missing-origin/binding regressions
remain. Positive integration items now carry explicit numeric TMDB identities.
The native runtime admission score for profile observations is preserved;
tests assert the separate effective contribution rather than relabel that score.

The final focused policy/native run passes 137 suites / 864 tests. Current
baseline compiler controls pass three files / 64 tests with retained 3.3.13.
The final full backend CI command passes 1,929 suites / 62,549 tests, with one
existing skip. All thirteen changed server runtime/test input hashes match
the frozen inputs before accepting that run. An earlier in-flight full run
was superseded by the observed-absence guard and is not delivery evidence.
Final staged cleanup removed one empty EOF line; the executable AST and source
positions remained identical, with no additional runtime change.

Qualified the configured backend JSON-summary, LCOV and HTML outputs from the
accepted run and copied them byte-identically into the standard coverage
location. Initial handoff assertions incorrectly expected optional report
formats; the repository's actual producer and existing ratchet establish the
accepted result. No application test failed because of that handoff check.
The coverage ratchet passes with baselines unchanged: server 89.26% lines/
statements, 86.67% branches and 90.80% functions; client 89.60% lines, 87.93%
statements, 82.16% branches and 87.72% functions.

Reused the last complete client coverage run of 484 files / 7,537 tests only
after all 1,229 recorded client/source/install/report inputs remained identical.
No client source, package graph or coverage report changed. The 64 compiler
controls, client lint and both client type scopes are fresh in this batch;
the existing browser receipts remain prior evidence on unchanged client inputs.

The complete preflight passes all eight jobs, including ownership, both server
dependency gates, copyright and the tooling controls. Final lint, type checks,
the four policy gates, ESM imports/mock shapes and Markdown pass. All three
installed dependency trees validate. No coverage baseline, ownership
classification, install policy or scanner threshold was relaxed.

## Dependency and CI context

Random PR 581 remains the same open, unmerged compiler proposal. Its previously
demonstrated failures still justify retaining exact 3.3.13; no new passing
candidate execution is claimed. Fresh baseline controls accompany this batch.
The [compiler outcome](client-compiler-pr-581-outcome.md) records the unchanged
artifact and actual mergeability check. Server ESLint from 580 is already
adopted; no genuinely stale applicable branch warrants a rebase.

Fresh complete npm audits report root/client zero and server five low affected
nodes in the existing rejected-CVE advisory chain, with zero moderate/high/
critical workspace findings. These are full development-plus-runtime audits.
The separately approved server-local OSV triage still expires November 16 UTC;
this scoring batch renews no exception and claims no dependency remediation.
The existing npm-bundled ip-address requirement before another release remains.

The starting revision 7af299b5874c07f913dba2b08c76118f635def04 passed its
[CI/CD pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/42548745834),
attempt 1, including build/test, database, installation/upgrade and acceptance
readout jobs. Publication/promotion jobs remained skipped. Its earlier recovery
table-lock timeout did not recur in that database run, but the old log still
does not identify a blocker. No timeout, retry or recovery policy was altered
to obtain that result. A passing earlier revision will not be substituted for
the scoring commit's own CI receipt.

## Remaining limitations and recommendation stack

This corrects a demonstrated provenance error, not every wrong library order.
The sampled frozen cohort lacks matched declared purpose and full mixed-rule
numeric replay inputs. Current configuration is not used to fill historical
gaps, AI agreement is not a correctness label, and remaining pattern/RAG/history
channels are not asserted statistically independent.

1. Deliver the declared-contribution correction with its source diagnostics.
2. Use existing purpose review to establish precise generic/specialized
   destination meaning; inventory-derived drafts remain context until declared.
3. Assess further source-family correlation and calibration using suitable
   prospective evidence before changing more weights or thresholds.
4. Investigate old pending-History reconciliation separately through existing
   ownership and recovery boundaries.

The batch remains on main without a release, deployment, branch or PR merge.
The separate design/outcome documents, compiler assessment and Unreleased note
accompany the code. The containing commit identifies the delivered source;
its own remote checks must be inspected independently of the green starting
revision above.

Delivery PR checks retain the same two open, unmerged heads and confirm both
branches MERGEABLE with UNSTABLE checks. There is no applicable stale branch
to rebase and no dependency edit to force for the inapplicable compiler.

Reused the recent artifact inventory and revalidated the same desktop-linux
daemon. All 444 image/tag records and the exact identity, image, start time and
health of the three protected services remain unchanged; four worktrees are
preserved. No additional verified stale candidate was selected or removed.
Current reports, recovery assets and other projects remain protected. Separate
runbrace ledger-fixture activity on the shared host was identified and left
untouched, without attributing its lifecycle or global storage changes to this
work. No image build, backup retirement, shared-cache or volume cleanup occurred.
