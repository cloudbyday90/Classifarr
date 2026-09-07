# Retained history lifecycle outcome

Date: 2026-09-07.

## Delivered behavior

Implemented the [lifecycle design](evidence-lifecycle-design.md). The existing
Policy Statistics overview automatically includes lifecycle counts globally and
within every retained library/method group. Four mutually exclusive categories
reconcile to history events. Native description lists show their names and values
inside the existing five-column history table, preserving captions and scoped
headers. A small ESM component also renders the global counts.

Completed includes completed, corrected, verified and routed history. Pending
decision combines pending and awaiting-decision history. Retry pending uses the
persisted pending-retry status. Other includes failed, superseded, null and unknown
states. The UI explains that these are current retained-row states, not queue
depth or independently evaluated correctness. Missing lifecycle fields in older
payloads remain unavailable; they do not become zero.

The SQL query retains one read-only snapshot, a five-second timeout and 200-group
caps. Service validation now reconciles displayed groups to global counts in
both populations, accounting for truncation. No new endpoint, migration,
classification behavior, provider request or operator workflow was introduced.

## Local evidence

A read-only query against the local Compose database, captured at
`2026-09-07T11:00:40.176Z`, found:

| Population | Count |
| --- | ---: |
| Retained history events | 6,772 |
| Completed | 6,699 |
| Pending decision | 31 |
| Retry pending | 0 |
| Other | 42 |
| Imported membership | 6,699 |
| Original candidate recorded | 5 |
| Retained / evaluated feedback | 0 / 0 |

All 6,699 completed rows belong to the imported-membership method. The remaining
73 rows have no completed outcomes in this snapshot; only five contain the
original candidate ID checked by the coverage query. Pending comprises 27 pending
and four awaiting-decision rows. Other comprises 41 reclassified rows and one
failed row. The 16 library/method groups were uncapped.

PostgreSQL 18.6 returned the coverage query plus a status-count cross-check in
256.916 ms. This is one local observation, not a production performance bound.
The deployed container predates feedback source/evaluation schema. The ignored
measurement helper first verified feedback was empty and substituted empty
relations only for that read. No compatibility fallback was added to production
code. The query made zero database writes or provider calls and returned no
individual media records. The read-only container accepted the ESM helper through
stdin; no file copy or filesystem change was required.

## Validation

| Check | Result |
| --- | --- |
| Service unit tests | 19 passed: integer safety, lifecycle partitions, missing fields, complete/capped group reconciliation and unavailable responses |
| PostgreSQL integration | 26 passed: all current statuses, nulls, expanded vocabulary, superseded/replacement rows, independent attribution, 201-group caps, empty datasets and privacy assertions |
| Populated query fixture | 5,000 imported events: 8.671 ms in the final integration run |
| Client tests | 37 passed across the breakdown, statistics integration and named API leaf |
| Browser regression | Passed labelled global/group counts, native tables, desktop and 390/320-pixel access, keyboard overflow, 4.5:1 text contrast and GET-only activity |
| Visual review | Desktop and mobile history screenshots inspected; counts remain labelled and table overflow stays inside its focusable region |
| Type and ESM checks | Server/client typechecks, static import and test mock-shape gates passed |
| Scoped lint | Client and server changed source/tests passed |
| Application image | `classifarr:evidence-lifecycle-local` built from a staged Git archive, excluding ignored data and secrets |
| Container startup/schema | Disposable container startup and authoritative schema comparison passed; the checked-in schema is unchanged |

The integration suite uses its own disposable database. Current status constraints
reject arbitrary strings, so unknown-state fallback is tested by temporarily
relaxing that constraint only in the suite database, then restoring it. Method
fixtures use the real allowed vocabulary. No production constraint was weakened.

Full repository suites and the combined coverage ratchet were not run. No new API
endpoint was added. Targeted regressions cover the changed behavior; this is not a
repository-wide security or accessibility certification.

## Recommendation and next item

Retain PostgreSQL aggregation, strict ESM projection, the existing named API and
native Vue semantics. The benefit is immediate, reproducible visibility without
manual input. The limitation is that retained status describes workflow history,
not validated classifier quality. The design records the official W3C/PostgreSQL
sources and the alternatives with their pros and cons.

**Next: audit and standardize automatic original-candidate capture across
non-import classification methods.** Only five of 73 such observations currently
contain the candidate ID recognized by this query. Identify which writers lack
the original candidate snapshot, preserve provenance when a candidate exists, and
expose bounded missing-reason counts when it does not. Do not reconstruct an
original prediction from the eventual selected library. This improves the data
available for future classification research without creating an operator task.

These measurements do not satisfy independent labeling, readiness or frozen-study
preflight. Keep those gates separate before considering review-only semantic
counter-evidence; no automatic semantic routing was added.

README, Unreleased and the previous recommendation were updated. The independent
[QEMU action outcome](qemu-action-update-outcome.md) records the random PR work.
No release, tag, version bump or deployment is included.
