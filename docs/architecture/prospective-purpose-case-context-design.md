# Optional frozen policy context for purpose cases

Date: 2026-10-30. Status: complete first batch agreed; implemented.
Follows the [private purpose case view](prospective-purpose-case-view-design.md).
The separate [outcome](prospective-purpose-case-context-outcome.md) records facts,
validation and delivery status.

## Problem and current evidence

The purpose case view distinguishes the frozen policy leader, independently
proven original automated destination and explicit choice. It does not select
the immutable full policy evaluation. Consequently it cannot show which other
policies were evaluated, their retained order, numerical signals or exclusions.

Read-only investigation on October 30 confirmed that the current Unraid image
revision is `2fcf07bdc35e93bbe2f480b3268b15466f16e012`, package `0.49.3-beta`.
The image predates the purpose capture and case modules. A bounded read-only
schema probe found no policy capture, purpose supplement or authorized evaluation
snapshot table. No eligible new-cohort cases can be inspected on this deployment.
No item rows were queried, and deployment is outside this task. This finding
does not establish why an earlier classification chose a particular library.

## Agreed first batch

Add an explicit `--include-policy-context` modifier only for the existing private
`--prospective-purpose-cases` mode. Ordinary case output and aggregate modes keep
their existing JSON bytes, eligibility, denominators and admission behavior.
The opt-in report has its own versioned extension and optional-context coverage.

Use a case-only bounded read inside the existing read-only repeatable-read
snapshot. Do not unconditionally add full payloads to the aggregate query:
additional bytes could otherwise reject previously admissible aggregate runs.
Reuse the thirty-day window, cancellation and current transaction deadlines.
Admit at most 5,000 source events and 64 MiB total transferred input, including
optional headers and payloads. Withhold expired or over-budget payloads in SQL;
never fetch an unbounded value and rely on later JavaScript truncation.

Validate every relevant immutable child against exact classification ID, typed
item identity, header/payload version, capture time, event time and thirty-day
lease. Bind it to the already-frozen leader reference: policy/library IDs, final
score, capture/expiry times and purpose proof. Do not use current History,
library names or policy configuration to reinterpret historical evidence.

Full context is optional diagnosis. Missing, expired, legacy, overflow, invalid
or inconsistent evidence remains an explicit context gap and cannot change
purpose eligibility, action meaning, comparisons or denominators. A full child
cannot repair a commit-time supplement gap or release a chronological holdout.
Validate context coverage across the eligible window before display admission.

Project the existing closed complete pool of at most 64 candidates / 64 KiB:
policy/library IDs, signal scores and weights, thresholds, authority, purpose
origin, runtime admission, disposition, retained ranked order and exclusions.
Preserve raw scores and final ranked scores as different quantities. Null v2
purpose proof remains unknown; provenance alone does not establish a match.
Several policies can target one library, so a destination choice does not prove
which policy the operator selected.

Keep the fifty-case / 1-MiB complete-report limit and exact omitted counts.
Remove whole trailing cases when byte admission requires it; do not truncate an
individual pool or favor shorter later cases. Preserve canonical decimal-string
BIGINT references. Exclude names, titles, rule values, prompts, actor identifiers,
fingerprints and raw source envelopes. No current configuration joins, capture
version, schema, historical backfill, provider call, job, API/UI, routing,
learning, release or deployment change is proposed.

The implementation uses an additional parameter-bound context SELECT only when
the option is enabled. It deduplicates requested classification IDs and admits
the context envelopes against the remaining input budget after the unchanged
source query. SQL retains exact epoch-microsecond header times; the reader binds
those to the frozen source lease without rounding away submillisecond drift.

This command is an optional developer verification interface. The operator
workflow must progress toward scheduled execution and application-visible
results, with no required manual CLI trigger.

```sh
node server/src/scripts/runInventoryOutcomeCalibration.mjs --prospective-purpose-cases --include-policy-context
```

The opt-in JSON is `policy.purpose_outcome_cases.v2`; ordinary case JSON remains
v1. `policyEvaluationCoverage` counts available contexts and fixed gap reasons
for all first-item-eligible events, including unflagged events and cases omitted
from display. Context absence cannot repair a supplement gap. The CLI emits one
document without saving a report; redirected output remains private data.

## Alternatives and tradeoffs

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Separate opt-in frozen context | More ranking detail with stable existing reports | Additional bounded read/projection contract | Agreed first batch |
| Unconditional full context in shared SQL | One data shape | Changes aggregate transfer admission and failure behavior | Reject |
| Change routing from absent prospective cases | Immediate behavior change | No qualifying evidence supports the change | Reject |
| Interpret current placements/configuration as old intent | Easy to obtain | Cannot establish event-time intent or independent correctness | Reject |
| Deploy and accumulate evidence now | Enables real case inspection | Outside the requested no-release/deployment batch | Separate future task |
| Freeze later AI/router trace | Could support later-stage diagnosis | New capture lifecycle and authority design | Defer |

Recommended stack: immutable evidence → unchanged shared purpose eligibility →
case-only SQL admission → exact leader/context binding → closed optional
projection → whole-report limits and explicit gaps. Inspect real eligible cases
after a separately authorized deployment before choosing a routing fix.

## Official research checked October 30, 2026

URLs were discovered and primary documents read through MCP. Applications below
are engineering inferences; the chosen limits are repository contracts.

- [W3C PROV-DM Recommendation](https://www.w3.org/TR/2013/REC-prov-dm-20130430/)
  models producing entities, activities and derivation. Preserve the exact source
  and time of each retained evaluation rather than substituting current state.
  This does not introduce a PROV serialization or claim standards conformance.
- [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)
  documents access and snapshot isolation. Keep original evidence and optional
  context in one bounded read-only repeatable-read transaction.
- [OWASP API4 resource consumption guidance](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  motivates explicit limits on expensive operations and returned data. Although
  this surface is a private CLI, bound database transfer, decoded payload and
  final output separately, before materializing excessive private data.
- [NIST AI RMF core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  describes contextual interpretation and documented measurement limitations.
  Retained rankings explain the policy stage, while later AI/routing causation,
  suggestion bias and historical gaps remain separate limitations.

No web interaction is added, so no new WCAG claim or UI accessibility change is
part of this proposal. Diagnostic states use explicit textual categories.

## Verification plan

Compare ordinary aggregate and case JSON/error bytes against the starting main
revision. Test exact identity/leader/version/time/proof binding, legacy and
expired evidence, optional coverage independent of scoring, duplicate policy
destinations, null proof, raw/final score distinction and closed privacy output.
Test full-window validation before fifty-case selection, complete sixty-four
candidate contexts forcing whole-case byte omissions, SQL payload withholding,
combined admission, cancellation and cleanup. Use disposable PostgreSQL to prove
read-only coherent reads and no source/checkpoint writes. Run applicable local
coverage and repository gates, update Unreleased, then commit/push directly on
main after shared scope agreement. Create no release.
