# Optional purpose case context outcome

Date: 2026-10-30. Status: complete scope agreed; implemented and verified.
See the separate [design, research and tradeoffs](prospective-purpose-case-context-design.md).

## Starting point

Started clean on main at `95ff75f8a7b967106e51d638c0aee932bb70f0d6`.
The previous recommendation was to inspect eligible cases before selecting a
routing change. Two read-only fact investigations checked the deployed evidence
boundary and the existing immutable policy-pool reader seam. No code or deployed
configuration was changed during the investigation.

## Live capability findings

Existing RSA SSH access works with strict host-key checking. The running Unraid
Classifarr image reports revision `2fcf07bdc35e93bbe2f480b3268b15466f16e012`
(October 23) and package `0.49.3-beta`. Its code lacks the purpose capture,
supplement and case-view modules and the purpose CLI flags.

A schema-only probe used read-only repeatable-read isolation, a five-second
statement timeout, one-second lock timeout, ten-second idle timeout and rollback.
It returned:

| Capability | Present |
| --- | --- |
| Read-only transaction | Yes |
| Immutable policy evaluation captures | No |
| Purpose outcome supplements | No |
| Authorized outcome evaluation snapshots | No |
| Feedback sources | Yes |

No item/history rows or counts were queried. No provider calls, deployment,
configuration changes or data mutations occurred. Older private audits predate
these contracts and cannot substitute for new frozen evidence. Access information
is available; the constraint is deployed capability and prospective evidence.
No particular routing or weight fix is established by these findings.

## Repository findings and proposed next item

The purpose query already joins the immutable capture child but selects only
its holdout identity. Full alternatives are therefore an explicit input gap.
The inventory report's reader demonstrates bounded payload handling, but its
binding to mutable/inventory observation fields must not be reused unchanged.
Purpose context needs independent binding to the prepared frozen event and its
already-frozen leader reference.

The agreed first batch adds separately opt-in full policy context to private
purpose cases while preserving current reports and eligibility. It adds no
capture, learning or routing authority. The design records limits, exclusions,
pros/cons, official sources and a verification plan. The user confirmed the full
Q1 scope, including unchanged default reports, exact binding, combined admission,
optional gaps and the existing read-only/privacy boundaries.

## Implementation and validation

`--prospective-purpose-cases --include-policy-context` selects version-2 private
case JSON. Separate repository, validation and report-extension services own the
optional read and projection. The shared snapshot reads full context only when
requested; aggregate SQL and ordinary report bytes remain unchanged. Requested
classification IDs remain canonical BIGINT strings and are deduplicated before
the parameter-bound query. Context envelopes consume the remaining 64-MiB
budget, and SQL withholds expired or oversized payloads before transfer.

The validator checks exact typed identity, microsecond header times, the source
lease and the frozen leader's IDs, final score and purpose proof. Full pools keep
their original numeric signals, raw/final score distinction, authority, purpose
origin, runtime admission, ranked order and exclusions. Null proof is retained.
Multiple policies targeting a library do not establish operator policy selection.
Optional failures are fixed-category gaps and cannot change eligibility or
repair a commit-time gap. Coverage precedes display caps, with whole-case output
omissions rather than partial pools.

1,024 default aggregate/case JSON/error byte comparisons matched the starting
main revision across permutations, aliases, conflicts, gaps and holdout bridges.
Focused unit tests passed four suites / 105 tests. Disposable PostgreSQL tests
passed two suites / 18 tests, including SQL payload admission/expiry withholding,
no source evidence writes, exact BIGINT binding, cancellation of both reads and
one coherent snapshot across concurrent History/capture cascade deletion.
Unit cases also cover sixty-four-candidate pools forcing byte omissions,
coverage beyond display caps, binding/proof drift, unknown context, score
distinctions, modifier isolation, foreign/duplicate/missing rows and cleanup.
Both ordinary and opt-in real CLI processes emitted one quiet bounded JSON
document. Multiple source aliases fetched their exact BIGINT context once.

Full backend coverage passed 1,898 suites / 61,519 tests, with one existing skip:
89.20% statements/lines, 86.58% branches and 90.72% functions. The combined
coverage ratchet passed without changing its baseline; unchanged client source
reused its existing full coverage receipt. Server types/lint, both Knip modes,
static imports, ESM mock shapes, four policy gates, copyright, Markdown and the
reviewed ownership gate passed. Only the three affected read/CLI ownership
entries were reviewed; existing unresolved maintenance debt is preserved.
Unreleased is updated.

## PR and research inventory

GitHub MCP found no open PRs in `cloudbyday90/Classifarr`, including Dependabot.
No random PR was applicable and no stale Dependabot PR required rebasing.
Official W3C, PostgreSQL, OWASP and NIST sources were discovered/read through MCP
on October 30. No dependency manifests, locks or advisory suppressions changed.

Delivery is directly on main.
There is no release or deployment in this batch.

## Next recommended item

The user clarified that all operator workflows should work toward automation
or application UI actions, without required manual CLI triggers. This preference
is recorded in the root agent guidance mirrors and the docs guidance. The CLI
here is an optional developer verification surface, not an operator handoff.

The next batch should automatically evaluate the purpose cohort and expose
saved status/results in the existing administrator Evaluation progress area.
The existing evidence-gap worker supplies admission, ownership, cancellation,
bounded worker transport and cooldown/backoff patterns. Keep purpose evaluation
independent of the inventory audit's denominator and freshness. A closed
counts-only checkpoint is the smallest first surface; private item-level context
in the UI requires a separate access, storage and expiry contract. Status GETs
must read saved state and never trigger expensive evaluation. Empty retained
source rows do not establish producer readiness or zero classification gaps.

The user confirmed an independent automatic summary job, bounded aggregate-only
checkpoint and protected saved-status presentation in the existing administrator
Evaluation progress area. That implementation follows this verified foundation;
item-level UI remains separately scoped.
See its [design](automatic-purpose-evaluation-design.md) and
[outcome](automatic-purpose-evaluation-outcome.md).
After a separately authorized deployment and evidence accumulation, use the
results to choose a routing fix. Retained policy alternatives describe the policy
stage; later AI/router causation still requires its own frozen trace. This batch
does not reconstruct that trace from current History or media placements.
