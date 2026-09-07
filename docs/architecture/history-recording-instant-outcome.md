# History recording instant outcome

Date: 2026-09-07.

## Design and implementation

Implemented the [recording-time design](history-recording-instant-design.md).
Migration `20260907_030000_add_history_recording_instant.sql` adds nullable
`classification_history.recorded_at`, then sets a future-insert default of
`statement_timestamp()`. It preserves every legacy null and the original
`created_at` field. A finite-or-null constraint and an AFTER UPDATE guard protect
the instant, including against changes made by another BEFORE trigger. The guard
runs as the caller with a fixed catalog search path and exposes a generic error.

The writer audit found three production insert sites:

| Writer | Behavior verified |
| --- | --- |
| `classificationPersistenceService.mjs` | Completed and retry history receive the database default through the existing lifecycle transaction |
| `queueClassificationHistoryQueries.mjs` | Source-library insert SQL omits the instant and receives the same default |
| `queueAdminService.mjs` | Manual classification receives its recording instant after routing finishes inside the transaction |

Their explicit column lists already support this default, so no duplicated writer
clocks or input mapping were needed. Tests supply misleading metadata timestamps
and confirm those values do not control the database column. Trusted inserts may
still supply an explicit finite instant or null for restoration/import; database
owners can bypass integrity rules. Existing calendar reports remain unchanged.

The existing evidence overview now includes `recording_time_coverage`, with exact
retained/recorded/unknown counts. A small ESM projection validates reconciliation;
a separate Vue component presents those counts and the calendar limitation in
plain text. Missing data is unavailable rather than zero. There is no additional
request, control, annotation task, provider call, accuracy claim or routing rule.

## Local observation

The read-only Compose observation at `2026-09-07T12:33:57.528Z` found PostgreSQL
18.6 and 6,772 retained history events. The running older image lacks the new
column, so an ignored local measurement adapter explicitly projected a null
instant for each row. All 6,772 were unknown and zero were recorded. The existing
feedback compatibility adapter was used only after verifying empty feedback.
This adapter is not a production schema fallback or a migration of user data.

The aggregate observation took 278.357 ms, with zero production writes, provider
requests or individual records returned. This is one local sample, not a latency
guarantee. The real PostgreSQL 5,000-event fixture took 20.419 ms. Existing payload
size bounds and fixed 14-date trend tests passed.

## Validation

- 162 server unit tests passed across persistence, queue writers, evidence
  projection, method attribution and daily provenance.
- 141 PostgreSQL integration tests passed across eight suites. They covered the
  populated upgrade without a table rewrite, unchanged legacy calendar values,
  mixed known/unknown counts, statement versus transaction time, repeated DST
  offsets, session-zone invariance, actual writers, finite constraints, update
  preservation, feedback receipts/evaluation and migration regressions.
- 63 focused client tests passed across the new summary, existing evidence views,
  statistics integration and API leaf. The browser flow passed keyboard scrolling,
  native table semantics, contrast, narrow viewports and zero writes. The new mobile
  summary screenshot was visually inspected; the harness disables finite animation
  during that capture so the responsive sidebar transition does not obscure it.
- Server/client typechecks, scoped ESLint, ESM import/mock-shape checks, production
  dependency checks, migration checks and whitespace validation passed.

- `classifarr:history-instant-local` built from the staged Git tree. The schema was
  regenerated from disposable PostgreSQL 18, then the image was rebuilt with that
  snapshot. A fresh container bootstrapped successfully and the schema comparison
  passed without drift. Temporary verification containers were removed; the
  running user Compose service was not redeployed.

The full server/client suites and combined coverage ratchet were not run in this
follow-up; there is no new endpoint or dependency change. These checks do not
replace independent classifier labels or certify every security/accessibility
property.

## Open PR check

At task start, GitHub MCP returned only [PR 528](https://github.com/cloudbyday90/Classifarr/pull/528).
A random draw from that one-item population selected head
`269481ca04e6d620e71d2587ce1eba7e20382d13`. Its exact manifest and lockfile patch
already exists in baseline main `7dbf34057cf99fa1a476505dc0239d8ae632a2fb`.
`git apply --reverse --check` succeeded against that fetched patch. No additional
unapplied PR was available, so this task verifies the adopted tooling locally
without inventing another dependency update. At final readback, GitHub reported
the PR closed with `merged: false` and no remaining open PRs. This task did not
close or merge it. Its [adoption outcome](client-tooling-528-outcome.md) describes
the prior change.

## Recommendations and next item

The final stack is a database-owned insert instant, immutable finite-or-null
storage, shared read-only aggregate SQL, strict modular ESM projection, and a
passive Vue summary. It captures evidence consistently with no operator input;
the costs are a migration lock, update checks and permanently unknown legacy
instants. The design compares alternatives and cites official PostgreSQL, W3C
and OWASP guidance checked in September 2026.

**Next: add a separately labelled UTC provenance trend for known recording
instants, with explicit unknown exclusions.** Reuse the fixed bounded window and
strict partitions. Keep the current stored-calendar view distinguishable and never
combine inferred legacy instants with known ones. This will show whether new
capture improves over time without asking anyone to annotate history.

Independent labels, readiness and frozen-study preflight still gate semantic
counter-evidence, which must remain review-only. README, Unreleased, design and
outcome documents were updated. No release, tag, version bump or deployment is
part of this work.
