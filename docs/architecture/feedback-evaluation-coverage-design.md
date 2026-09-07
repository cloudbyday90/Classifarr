# Feedback evaluation coverage: design

## Problem and decision

The prompt-persistence follow-up found that missing correction flags become false,
and false flags become accuracy successes even without an original candidate.
Dashboard queries repeat the same assumption. Keep all observations, but define
one database projection that distinguishes evaluated outcomes from unknown ones.

An evaluated outcome requires positive, currently active selected and original
library references with matching media types, a selected policy belonging to the
selected library, a finite nonfuture timestamp, and an explicit boolean correction flag
consistent with the two library IDs. A missing media type can use the two library
types; a supplied incompatible media type cannot. No title/name/metadata fallback
may reconstruct a missing library reference. Null and contradictory flags remain
unknown. The API writer preserves explicit booleans and stores missing/malformed
flags as null; it does not invent a correctness label.

The database default is also null for future inserts. Historical false flags may
have been supplied or defaulted; this change cannot distinguish those origins and
does not assert that existing labels were independently reviewed. It requires the
stored flag to agree with available candidate/destination evidence.

## Architecture

Add an invoker-rights `policy_feedback_evaluation` view with nullable
`evaluation_correct`, and a live aggregate `policy_feedback_learning_stats` view.
One SQL rule serves summary, time-series, breakdown, comparison, alerts, impact
metrics and suggestion evidence. Accuracy denominators include evaluated outcomes
only. Return null when none exist. Expose evaluated/unevaluated counts and evaluated
coverage alongside the unchanged observed decision totals. An unknown comparison
produces an unknown trend, not a stable/improving claim.

Live reads avoid stale accuracy after library deactivation, detachment or policy
reassignment. Keep the existing statistics table as a compatibility cache; refresh
it from the aggregate view in the existing transaction-aware ESM service. The
migration repairs existing cache metrics without rewriting feedback history.
Aggregate SQL replaces loading every raw record into the Node process.

Analysis consumes only evaluated feedback. Bump the frozen suggestion contract to
v3; old pending suggestions can be dismissed or superseded by normal analysis.
Application locks original candidate libraries as well as the selected destination
and feedback, then rechecks the canonical eligibility view before effects. This
prevents an active-state change from slipping between eligibility and application.
Preference observations are distinct from measured accuracy; other learning intake
contracts and automatic routing authority remain unchanged.

The dashboard, cards and detail view show evaluated coverage and explain N/A.
Use a native keyboard-operable control for the policy card's details action.
Existing API leaf functions retain raw field values, including null rates; no
operator labeling workflow or new endpoint is introduced.

## Official research: August 2026 baseline

URLs were discovered and read through web tools on 2026-09-07. These sources support
guidance available by August 2026; live documentation is not an archived snapshot.

| Source | Application |
| --- | --- |
| [PostgreSQL aggregate expressions](https://www.postgresql.org/docs/18/sql-expressions.html) | Nullable evaluated outcomes and filtered aggregates distinguish observations from measured outcomes. |
| [PostgreSQL CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html) | Ordinary views compute current results; invoker rights preserve underlying access restrictions. |
| [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) | Preserve provenance and disclose data quality/coverage instead of manufacturing complete evidence. |
| [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/) | Details actions must be keyboard operable and expose button semantics. |
| [PostgreSQL date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html) | Make the UTC interpretation of timezone-free history timestamps explicit before creating feedback instants. |

The eligibility rule is an application decision informed by these sources, not a
W3C conformance claim or proof of classifier accuracy.

## Alternatives and recommendation stack

| Option | Pros | Cons |
| --- | --- | --- |
| Change only the writer default | Small patch | Historical false labels and duplicated dashboard arithmetic remain. |
| Repeat checks in each service | Avoids views | Eligibility can drift across analysis, SQL and UI. |
| Canonical live views (selected) | One rule, current evidence, no operator refresh | Aggregation adds read cost; verify plans and local performance. |
| Delete incomplete observations | Smaller dataset | Destroys useful history and future inventory evidence. |
| Treat library equality as a label without an explicit flag | Larger evaluated sample | Infers a reviewed outcome the source may never have supplied. |

Recommended stack: retained observations → canonical nullable evaluation → live
aggregates with coverage → v3 frozen evidence → locked review. Validate real
PostgreSQL behavior, old-cohort invalidation, UI null/coverage rendering and cache
refresh/rollback. Results belong in the separate
[outcome document](feedback-evaluation-coverage-outcome.md).
