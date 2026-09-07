# Evidence method attribution outcome

Date: 2026-09-07.

## Delivered behavior

Implemented the [design](evidence-method-attribution-design.md) as an additive
`history_attribution` population in `evidence.coverage.v2`. It describes the same
retained events as the existing history view. Original method and candidate source
come from a validated pre-routing capture; recorded method follows the current
history record. Manual resolution can therefore appear beside its original policy,
AI or retry method. Feedback is still grouped by selected library and the source
history's recorded method, now labelled explicitly in its caption.

Shared SQL validation distinguishes a valid capture of an invalid candidate from
an invalid capture envelope. Captured, unrecorded, invalid and unsupported
provenance partition all retained events. Legacy policy rankings continue to count
as candidate availability but do not establish an original method. Unsupported
and malformed captures expose neither original method nor candidate source.

Attribution has its own stable 200-group limit with uncapped totals and validation
against the history population. Small ESM modules separate SQL, numeric projection
and attribution. One materialized scalar history projection feeds both history
views in a single read-only statement, retaining the five-second timeout. The new
Vue component uses the existing overview request, escaped text, a native table,
scoped headers and a labelled keyboard-scrollable region. Older payloads show
attribution as unavailable. No new controls or operational annotations were added.

The existing schema, classification writers, routing decisions, provider calls,
feedback evaluation eligibility and study readiness contract remain unchanged.
No raw media records, prompts or JSON metadata are returned by attribution.

## Local Compose observation

The read-only aggregate and status cross-check at `2026-09-07T11:52:09.633Z` took
90.591 ms against local PostgreSQL 18.6:

| Population / provenance | Count |
| --- | ---: |
| Retained history events | 6,772 |
| Original method captured | 0 |
| Original method unrecorded | 6,772 |
| Invalid / unsupported provenance | 0 / 0 |
| Attribution groups | 16 |
| Legacy candidate availability | 5 |
| Retained / evaluated feedback | 0 / 0 |

The running Compose image predates candidate capture. Its five legacy rankings do
not recover original methods for any row. This measurement documents the historical
gap; it does not indicate that capture failed in the new build or validate model
accuracy. The helper returned aggregates only, with zero database writes and
provider requests. Raw local artifacts remain ignored.

That older container also lacks feedback source/evaluation relations. The helper
verified feedback was empty before substituting empty relations for this local
measurement. Production has no schema fallback. The application container and its
retained history were not changed.

## Validation

- 82 server unit tests passed across capture, aggregate service and attribution
  projection suites. Checks include safe integer counts, redaction, dimensions,
  missing data, duplicate groups and partition reconciliation.
- 101 distinct PostgreSQL integration tests passed across evidence coverage,
  feedback evaluation and source-bound feedback. The final coverage rerun passed
  all 45 tests, including all capture sources after manual resolution, explicit
  malformed captures, missing legacy provenance, empty populations, independent
  attribution capping at 204 groups and a future method vocabulary. The 5,000-event
  local coverage fixture took 15.832 ms. Timings are observations, not guarantees.
- 58 client tests passed across five suites, including auth/setup router guards,
  statistics integration, the named API leaf and evidence components.
- The browser regression passed three native tables, labels, unchanged GET-only
  statistics requests, keyboard scrolling, contrast checks and desktop/390/320-pixel
  layouts. Desktop and mobile attribution screenshots were inspected.
- Server/client typechecks, scoped ESLint, ESM static-import and mock-shape gates,
  and production Knip dependency analysis passed.
- `classifarr:method-attribution-local` built successfully from the staged Git tree,
  excluding ignored data and secrets. Fresh disposable startup/schema validation
  passed through the current migration set; the authoritative schema snapshot was
  unchanged. The helper removed its disposable container after validation.

Two added fixture cases initially violated the existing method check constraint.
The cap fixture now uses 17 allowed recorded methods; the future-vocabulary case
changes and restores the constraint only inside its disposable test database.
The application schema was not relaxed.

Full repository suites and the combined coverage ratchet were not run; this change
extends an existing endpoint. The tests do not constitute independent human labels
or certify every security/accessibility property. The separate
[Vue Router outcome](vue-router-527-outcome.md) documents the randomly selected PR.

## Recommendation stack and next item

Keep immutable capture JSON, shared envelope validation, one bounded SQL snapshot,
strict aggregate projection, the existing authenticated API and native Vue tables.
The benefits are passive operation, traceability across resolution changes and
explicit missingness. The costs are another aggregate view, limited displayed
groups and no recovery of lost historical provenance. The design compares
alternatives and links official W3C, PostgreSQL and OWASP research checked in
September 2026.

**Follow-up implemented:** the [daily coverage design](daily-provenance-coverage-design.md)
and [outcome](daily-provenance-coverage-outcome.md) add a bounded date window with
explicit partial today and exclusions. The existing timestamp type required
disclosing the database calendar rather than inventing historical offsets. The
daily outcome records the next recommendation.

Independently labelled real evidence, readiness and frozen-study preflight still
gate future review-only semantic counter-evidence. This reporting does not enable
automatic routing or broader learning eligibility. README, the prior next item
and Unreleased were updated. No release, tag or application version change is part
of this work.
