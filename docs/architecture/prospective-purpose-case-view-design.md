# Private prospective purpose case view design

Date: 2026-10-30. Status: Q1–Q2 scope agreed; implemented.
Follows the [purpose cohort outcome](prospective-purpose-correction-cohort-outcome.md).
The separate [outcome](prospective-purpose-case-view-outcome.md) records validation
and delivery.

## Problem and agreed meaning

The purpose cohort already measures agreement between a retained policy leader
and explicit choices. Its aggregate cannot identify particular disagreements.
The existing private disagreement view covers an inventory experiment, which is
a different population. Its eligibility cannot become purpose eligibility.

The agreed view lists only first-item-eligible purpose events where the policy
leader or independently proven original automated destination differs from the
explicit choice. Keep three named comparisons: policy versus choice, original
versus choice, and policy versus original. Confirmation/change remains the
recorded command meaning, never inferred from these comparisons. Missing original
proof stays unknown. Gapped and held-out items remain aggregate coverage rather
than item-level output.

This is a diagnostic comparison, not an accuracy rate, error label, successful
route or causal explanation. It cannot establish why a later AI/routing stage
acted. Routing, learning, legacy statistics and inventory cohorts are unchanged.

## Existing evidence and limits

| Fact | Existing frozen source | Boundary |
| --- | --- | --- |
| Policy leader | Purpose outcome supplement | Policy/library IDs, final score, capture/expiry times and fixed purpose evidence only |
| Explicit choice | Canonical authorized snapshot or History review v3 | Selected library and recorded action, not a selected policy ID |
| Typed identity | Frozen action source and same-bound supplement | Movie/TV and TMDb ID; classification and source BIGINTs remain canonical strings |
| Action reference | Prepared source kind | Manual prior destination, runtime answer contract and original automated destination are distinct |
| Original automated destination | Valid frozen completed decision context, or validated History-review original reference | Never current History; a pending original context is not a completed automated destination |
| Full policy alternatives | Not in this read contract | Immutable child exists separately, but is not selected by this batch |
| Later AI/routing trace | Not in this read contract | Mutable History and queue witnesses cannot substitute for frozen proof |

History review v3 independently freezes its served original destination. Preserve
that proof for BIGINT classifications even when the older int32 decision-context
format is null. Do not invent a missing original method. Manual/runtime sources
without valid completed automated context have an unavailable original reference.
Actual manual-prior/runtime-answer destination IDs are not retained by this
contract and must not be inferred from the policy leader or selected destination.

The representative source reference is the validated numeric authorized receipt
ID for manual/runtime events, or classification ID for History feedback. Do not
print raw runtime event keys, which contain contract-key fragments. The query
already deduplicates tier aliases; this reference is representative, not an
exhaustive list of physical receipt aliases.

## Architecture

Extract deterministic purpose preparation from the aggregate reducer: validate
the complete window, prepare every canonical source/event, construct the entire
connected identity graph and reserve the earliest event before counting. Keep
microsecond ordering, exact numeric ID tie-breaks, conflicts, legacy gaps, target
availability, purpose strata and first-item/observed-gap counts identical.

Both aggregate and case consumers use that preparation. The existing aggregate
keeps its protocol, property insertion order, JSON bytes and denominators. The
new report embeds that unchanged aggregate, but its separate comparison counts
and display metadata describe the newly agreed case selection. Display caps
cannot alter aggregate counts or release a later favorable retry.

Share the existing snapshot orchestration rather than duplicating SQL or opening
a second read. Preserve the fixed thirty-day UTC, read-only repeatable-read
transaction; 5,000 admitted events / 64 MiB database-side admission; cancellation;
12-second statement, one-second lock and fifteen-second transaction deadlines.
The new exclusive private CLI mode adds no SQL query, schema, capture version,
provider call, API/UI, scheduled job, saved report or historical reconstruction.

Use small preparation, reference projection, case projection/report and snapshot
orchestration modules. Do not enlarge the classification or routing singleton.

## Output and privacy

After whole-cohort validation and holdouts, project a strict scalar allowlist:
canonical numeric classification/source references, typed identity, leader
policy/library IDs, selected/original library IDs where proved, times, retained
policy score and fixed evidence categories. Preserve source/action-reference
meaning, explicit missing-data reasons and separate comparison names.

Never spread event, source or reference objects. They can contain Sets, BigInts,
identity aliases, review IDs, actor fingerprints and raw snapshots. Exclude titles,
library/policy names, prompts, rule values, raw event keys, hashes, actors and
credentials. IDs are still private installation data; require an explicit local
CLI invocation and create no public HTTP surface.

List at most fifty flagged eligible cases and bound the complete report to 1 MiB.
Preserve chronological order and remove only whole trailing cases for byte
admission. Report eligible, flagged, shown and omitted counts and truncation.
If the report envelope itself cannot fit, fail rather than emit a partial report
with misleading denominators. No display cap is pushed into source SQL.

## Alternatives and tradeoffs

| Option | Pros | Cons / risk | Decision |
| --- | --- | --- | --- |
| Shared preparation and separate case projection | Identical eligibility and complete holdouts | Refactor requires byte-level aggregate parity tests | Agreed |
| Duplicate eligibility in the case report | Less initial extraction | Two denominators can drift | Reject |
| Named policy/original/choice comparisons | Reveals original disagreement even when policy agrees | Must preserve independent reference meanings and gaps | Agreed |
| Policy disagreements only | Smaller view | Misses original-destination disagreements when the leader agrees | Not selected |
| Include gapped/held-out item details | More diagnostic inventory | Broadens disclosure of unscorable evidence | Aggregate coverage only |
| Fetch full immutable policy alternatives now | More ranking context | Additional read/binding/admission scope | Deferred |
| Use mutable History AI/routing details | Convenient immediate content | Cannot establish frozen later-stage proof | Reject |
| Public administrator UI/API | Easier access | New privacy/access boundary | Outside first batch |

Final recommendation stack: existing frozen evidence → one shared eligibility
preparation → unchanged aggregate → strict private case projection → separate
comparisons → bounded display with explicit omissions and evidence gaps.

## Official research checked October 30, 2026

Sources were discovered or revalidated/read through MCP. These applications are
engineering inferences, not certification or standards-conformance claims.

- [W3C PROV-DM Recommendation](https://www.w3.org/TR/2013/REC-prov-dm-20130430/)
  distinguishes entities, activities and derivation. Preserve the producing
  reference for each comparison rather than substituting current state for
  missing event-time evidence.
- [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)
  documents transaction access and isolation. Keep detail and aggregate derived
  from one read-only repeatable-read snapshot with bounded transaction scope.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  describes event correlation and excluding sensitive information. Project only
  the numeric references needed for private investigation, not raw snapshots or
  actor/review identifiers.
- [NIST AI RMF core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  supports contextual explanations, documented measurement limitations and bias.
  Keep suggestion-biased confirmations distinct and avoid claiming that a
  disagreement proves an error or a particular cause.

No web interaction changes are included, so this batch makes no new WCAG claim.
Output uses explicit textual categories and missing states rather than color.

## Verification and delivery

Invoke explicitly from the repository root with the installation's existing
private database environment:

```sh
node server/src/scripts/runInventoryOutcomeCalibration.mjs --prospective-purpose-cases
```

This mode accepts no other options and emits one JSON document to standard
output, without saving a report. Existing `--prospective-purpose` remains the
aggregate-only mode. Both modes share `purposeOutcomeSnapshotRead.mjs` and
`purposeOutcomeCohortPreparation.mjs`; original-reference validation, closed case
projection and capped report construction live in separate service modules.
Treat any redirected output as private installation data. Do not paste it into
public issue logs without reviewing its numeric references.

Compare baseline and refactored aggregate JSON bytes across mixed, gapped,
conflicting and permuted cohorts before integrating detail. Cover original proof
sources, missing/non-automated/pending originals, History-review BIGINTs, action
meaning, exact source IDs, microsecond ties, legacy holdouts, late conflicts,
privacy, caps, CLI option isolation, cancellation and runtime cleanup. Use real
PostgreSQL for no-write/coherent-read and source binding. Run applicable coverage,
types, lint, ownership and repository gates, update Unreleased, then commit and
push directly on main. No release or deployment.
