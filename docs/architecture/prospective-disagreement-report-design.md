# Prospective disagreement report design

Date: 2026-10-28. Status: agreed scope implemented and locally verified.

Follows the [History feedback outcome](feedback-served-reference-outcome.md).
The separate [investigation outcome](prospective-disagreement-report-outcome.md)
records verified facts and current progress.

## Problem and evidence boundary

The next diagnostic should connect verified operator assessments to the evidence
that was actually preserved. It must not imply that a disagreement proves a
classifier error, or that an assessment confirms successful media movement.

There are three different evidence families:

| Evidence | Available facts | Boundary |
| --- | --- | --- |
| Frozen ranking capture v2 | Typed item identity; numeric description, metadata and company inputs; two experimental winners | This is a candidate-ranking experiment, not the final policy/AI score |
| Validated frozen outcome | Explicit action, selected destination, source and sometimes prior decision context or original-destination reference | Confirmation references differ by producer; missing prior destinations remain unknown |
| Retained History/current policy context | Top-five policy candidates, diagnostics and today's intent authority | These are not a versioned, frozen record of original policy ranking or historical intent |

The existing prospective SQL's `original_decision` is retained History metadata.
It supports conservative identity-alias exclusions today. It must not become
positive proof of an original destination in the new report. Use independently
validated frozen outcome context or the bound v3 feedback original reference.
An original `awaiting_decision` state legitimately has no destination.

The persisted correction signal's `declared_policy` state is also insufficient
proof of declared purpose: an eligible native-intent result plus purpose-rule
count can produce that state without retaining declaration provenance. Today's
authority contracts distinguish declared and inferred provenance, but cannot
reconstruct what was declared at an earlier decision.

## Agreed first batch

Use existing frozen evidence and expose explicit gaps for historical declared
intent and full policy ranking. Preserve confirmation/change cohorts, unknown
legacy kinds, selection-only diagnostics, temporal boundaries, conflicts and
connected holdouts. Do not add new capture versions, provider calls, policy
changes, learning, routing or historical evidence mutations in this batch.

The private, explicit mode in the existing evaluation CLI is confirmed. The
administrator Evaluation progress area currently exposes aggregates only;
item-level HTTP/UI details would add a new privacy and workload boundary.
No API/UI or scheduled saved detail report is part of this first batch.

Separate comparisons should remain independently named:

- Proven original automated destination versus explicit assessment, when a
  trustworthy original destination exists.
- Frozen experimental baseline versus assessment.
- Frozen experimental company arm versus assessment.
- Difference between the two experimental arms.

These describe distinct disagreements, not a shared accuracy rate or causal
explanation. No equality test may invent an action kind or its reference.

## Shared preparation before presentation

`inventoryProspectiveCases.mjs` extracts deterministic cohort preparation and case
dispositions from the aggregate evaluator. Both aggregate scoring and the report
consume that same result. Preserve current validation,
exclusion order, counters, 64-stratum ceiling and output semantics.

Retain private source/reference provenance alongside validated observations.
Canonical operator action references, retained correction context and v3 original
automated-destination references must remain distinct. Do not expose actor hashes,
command receipts or internal event keys merely because they exist in the reader.
Conflicting original references must not be resolved by choosing a favorable one.

Plan all identity/description alias bridges across the bounded cohort before
selecting cases. Reserve the earliest connected capture even if it has no label,
legacy binding or another exclusion. Display limits must never choose a later
favorable retry or hide a conflicting observation.

Keep original-reference availability diagnostics separate from existing scoring
eligibility. A missing prior destination can limit explanation without invalidating
an otherwise valid experimental comparison. Outcomes without eligible captures
must not silently enter its denominator; wider recovery coverage remains a
separate, explicitly unassessed question.

## Resource, privacy and transaction boundaries

Reuse the database-side payload-budget pattern before private rows cross into
Node. Keep a database-clock UTC thirty-day source window and fixed outcome cutoff.
Reuse the established 5,000-capture, 64-candidate and 100-observation limits, with
5,001/101 sentinels and the 64 MiB total input ceiling. Input overflow must fail
explicitly rather than return a biased partial cohort.

A genuinely read-only, repeatable-read transaction must use explicit SQL or the
abortable database helper with a signal. Passing read-only/isolation options
without a signal does not select that helper in the current database module.
Retain bounded statement, lock and transaction deadlines; close the runtime on
success and failure. Do not hold transactions while rendering or waiting for
human input. No saved report, scheduler checkpoint or viewed-audit write belongs
in the proposed first batch.

The confirmed CLI output contains exact classification/library IDs and frozen numeric
alternatives only. Titles, names, descriptions, current-policy prose, raw
snapshots, hashes, actor identifiers and credentials should stay out of default
output. IDs still identify private records; this explicitly agreed exposure is
not an anonymous public report.

The confirmed presentation is one deterministic bounded case list with complete
aggregate coverage, explicit omitted-case counts and a final response-byte ceiling:
50 cases / 1 MiB. This is presentation truncation after complete cohort gating,
distinct from input overflow. Detail exposure, separately named comparisons and
the budget were included in the final complete-scope confirmation.

An HTTP/UI alternative needs explicit administrator authorization, active-user
revalidation, a no-store allowlisted response, request cancellation, rate/resource
limits and an intentional load action. Existing API-key authentication writes
usage/audit metadata; it cannot support an unqualified claim of zero application
writes. The representative-review read executor can also write a viewed audit
and belongs to a different cohort, so it is not a read-only shortcut.

## Alternatives, pros and cons

| Approach | Pros | Cons / risk | Recommendation |
| --- | --- | --- | --- |
| Existing frozen evidence with explicit gaps | Reproducible numeric comparisons; preserves existing cohorts | Cannot diagnose unrecorded historical intent | First batch |
| New prospective policy/intent capture now | Builds future explanatory evidence | New contract, payload budget and authority review; does not recover the past | Separate follow-up |
| Treat today's policy context as the old explanation | Easy to display | Temporal mismatch and false historical authority | Reject |
| Shared preparation/dispositions | Prevents report/scoring eligibility drift | Requires regression proof for existing aggregates | First refactor |
| Private explicit CLI mode | Reuses a read-only diagnostic entry point; no new HTTP disclosure | Less convenient than an in-app report | Confirmed first surface |
| Administrator API/UI now | Easier repeated inspection | New item-level privacy, authorization and workload boundary | Defer |
| Saved automatic detail checkpoint | Convenient repeated access | New storage, retention, ownership and scheduling requirements | Defer |

Final recommendation stack: bounded coherent source read → shared validated
observations and connected holdouts → explicit case dispositions → source-aware
original-reference diagnostics → separately named experimental disagreements →
minimal bounded private presentation. No promotion or routing authority follows.

## Official research checked October 28, 2026

URLs were discovered and read through MCP services. The applications below are
engineering inferences from those sources, not certification claims.

- [PostgreSQL 18 SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  supports coherent repeatable-read snapshots and database-enforced read-only
  access. Apply both to the whole multi-query source read.
- [PostgreSQL connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html)
  documents statement, transaction and lock deadlines. Use scoped limits to bound
  diagnostic work without changing installation-wide settings.
- [OWASP property-level authorization](https://github.com/OWASP/API-Security/blob/master/editions/2023/en/0xa3-broken-object-property-level-authorization.md)
  supports explicit response projection and minimal exposed fields. A validated
  internal snapshot is not automatically suitable for a public response.
- [OWASP resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  supports bounded records, payloads and execution costs. Separate input admission
  failure from display truncation and avoid automatic repeated heavy reads.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls)
  supports keeping evaluation information out of fitting and model selection.
  Frozen predictions and existing cohort exclusions remain unchanged; the report
  does not tune weights on observed disagreements.
- [W3C tables tutorial](https://www.w3.org/WAI/tutorials/tables/)
  supports semantic captions and header relationships for a future table UI.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports concise, programmatically exposed loading/unavailable states. If the
  first surface is CLI-only, no unrelated UI rewrite or web-conformance claim
  belongs in this batch.

## Verification and delivery plan

The evidence boundary, CLI surface and complete output/comparison/safeguard scope
were confirmed under grill-me before implementation.

Preserve exact existing aggregate results across current fixtures and new
adversarial cases: transitive aliases, earlier unlabeled/legacy captures, late
outcomes, unavailable contradictions, mixed actions, malformed receipts and
observation/capture overflow. Prove separate original-reference status and source
semantics, exact BIGINT IDs, deterministic ordering and privacy projection.

Use disposable PostgreSQL tests for genuine read-only enforcement, snapshot
coherence, database-clock cutoffs, payload admission, timeout/cancellation and
cleanup. Check CLI option conflicts and sanitized failures. Follow with appropriate
coverage, unchanged-baseline ratchet, lint/types, dependency usage, ownership,
ESM, Markdown, copyright and secret/whitespace gates. Add client and browser checks
if the agreed scope includes an HTTP/UI surface.

Work remains on `main`; update Unreleased and the separate outcome before final
commit/push. No new branch, PR merge, release or production activation is implied.

## Implementation and use

The implementation separates cohort dispositions, validated reference projection,
bounded snapshot reads, individual case projection, report assembly and CLI read
lifecycle into small service modules. The existing audit imports the same snapshot
reader, preserving its SQL export alias, failure prefixes and write/checkpoint
behavior. The ranking formula is shared with the numeric diagnostic; no weights
or winner rules changed.

From the repository's `server` directory, using its pinned Node runtime and usual
database configuration:

```powershell
node src/scripts/runInventoryOutcomeCalibration.mjs --prospective-disagreements
```

This explicit mode uses the database's current thirty-day window and rejects other
mode/window/sample options. Existing retrospective, prospective and saved-audit
status modes retain their contracts. SIGINT/SIGTERM and an optional programmatic
abort signal cancel the read, and listeners/runtime connections are cleaned up.
Failure prints a fixed nonzero-exit diagnostic without private arguments or a
partial report. No report file or checkpoint is automatically written.

Output is private JSON containing local record IDs. `evaluation` preserves the
existing complete aggregate; `cohorts` separates confirmations and changes and
counts each named comparison independently. Counts overlap when a case has
multiple differences. `cases` contains only eligible flagged cases in chronological
order with exact BIGINT tie-breaking. `display` distinguishes eligible, flagged,
shown and omitted counts. Numeric alternatives are ordered by experimental
baseline score, then library ID; that presentation order is not a policy ranking.

Original-reference status is available, unavailable or conflicting. Missing and
non-completed/non-automated source contexts remain explicit gaps; one valid frozen
original can coexist with missing context from another source, which is counted
as partial provenance. Conflicting positive originals are never resolved by
choosing one. Company comparisons are unavailable without company evidence,
even though the unchanged legacy aggregate retains its baseline-fallback arm.
Abstentions remain separate from differences.
