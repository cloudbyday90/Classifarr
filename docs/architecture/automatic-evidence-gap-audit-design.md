# Automatic evidence gap audit design

Date: 2026-10-28. Status: both grill-me decisions confirmed; implemented locally.
Validation and delivery are recorded in the [outcome](automatic-evidence-gap-audit-outcome.md). Follows the
[placement-informed automation design](placement-informed-automation-design.md).

## Purpose and retained boundaries

Automatically explain evidence availability for retained prospective movie/TV
comparisons. Reuse the existing typed capture, observation adapter, connected
holdouts and reducer. An audit describes coverage, not classifier accuracy,
historical recoverability or routing permission. Current placement remains an
inferred profile input; it cannot become a confirmed historical label.

The first batch should cover one database-clock thirty-day capture window and
its explicitly reported outcome cutoff. It does not scan archives, import data,
repair identity, create feedback, change intent or call a provider.

## Recommended independent lifecycle

Use a new small domain adapter around `createAutomaticEvaluationWorker` and a
separate singleton aggregate checkpoint. Sharing the existing destination report
would be smaller, but malformed/over-budget prospective evidence could then
erase an otherwise valid saved-decision result. Independent failure/freshness is
the recommendation.

Reuse the established schedule pattern: check each minute, respect a five-minute
successful recheck interval, delay initial work until startup settles, coalesce
locally and hold a database advisory lease across the operation. Retry failures
with bounded five-to-sixty-minute backoff and use the existing local fallback
when retry state cannot be persisted. Stop cancels work and joins the fixed worker
thread before releasing ownership. Never retry an uncertain commit as a recovery
action; a later read/recompute is independently safe.

Use `createInventoryDiscoveryAdmission` directly for shared heavy-work ownership
and memory monitoring, with the existing conservative 768 MiB resource allowance.
Reuse the no-RAG/no-inventory foreground-idle predicate for actual ingestion/due
queue work. A resource refusal is a quiet deferral, never a successful zero-gap
audit. Do not invoke inference consent, source-pair capture, model clients or
read methods that prune other stores. Empty/no-library installations can still
report no intake; lack of RAG or an AI allowance is not an audit prerequisite.

Source reads use `withTransaction(callback, { signal, readOnly: true,
isolationLevel: 'repeatable_read' })`, a
repeatable-read snapshot and the database clock, with the existing abortable
operation's fifteen-second maximum, statement/lock bounds and no external I/O.
Pure computation runs in fixed-code ESM worker isolation: no inherited preloads
or credentials, a 64 MiB serialized input ceiling, bounded heap, deadline and
strictly validated aggregate output. No vector transport or model computation is
needed. Malformed/oversized data fails closed rather than silently truncating
a reported population.

The abortable reader establishes isolation in `BEGIN`, before its internal
backend-identity/settings query. Setting isolation in the callback would be too
late in PostgreSQL. The new option accepts only fixed `read_committed` and
`repeatable_read` literals; existing callers keep their default behavior.

Publication/failure writes are separate, short operational transactions with
signal checks before and after the statement and monotonic observation-time
fencing. This is **read-only source auditing**, not zero database writes: the
checkpoint and normal scheduler receipts may change. Once COMMIT is in flight,
cancellation cannot promise rollback; the bounded transaction must settle before
ownership is released.

Add a migration and generated fresh schema for one replaceable aggregate, with
no accumulating case history. Keep it out of portable backup exports. Clear it
inside both merge/replace restore transactions after reference validation, so
restored data is not paired with a pre-restore audit. Normal runtime maintenance
admission already prevents supported restore from overlapping the scheduled job.
No new restore generation is needed while that lifecycle remains authoritative.

## Report contract and population accounting

Publish exact allowlisted keys only: version, status, window/observation times,
fixed evidence-state phase, intake activity, capture-level accounting, optional
bounded observation diagnostics and explicit limitations.

- Intake counts retained movie/TV history, not successful classifications or
  failed comparisons. Its existing 5,001 sentinel means a lower bound when capped.
  Do not derive an exact missing-comparison count from that capped value.
- Capture exclusions form a disjoint waterfall: invalid, duplicate, unbound,
  identity mismatch, conflict, unverified evidence, awaiting outcome, unavailable
  destination, mixed action kinds and outside candidate scope. Together with
  eligible comparison groups they must reconcile to inspected captures.
- The 101-observation sentinel preserves exclusion aliases but cannot score.
  Overflow is a subset of invalid captures, not an extra exclusion to sum.
- Observation reasons overlap and include duplicate captures. Their ceiling is
  505,000 inspected records, not the saved-decision validator's 10,000 ceiling.
  Label them bounded inspected diagnostics; they can be lower bounds when any
  inspected observation group hits the SQL sentinel. Do not publish percentages
  or an exact all-observation denominator from these values.
- Preserve 5,000 captures, 100 scorable observations per capture, 64 candidates
  and library strata. Population/transport overflow produces an explicit limited
  or unavailable state, not a partial successful report.
- Historical recovery is `not_assessed`. A missing snapshot does not distinguish
  expiry, pruning, deletion or never-captured data. Unknown legacy action kinds
  and unbound v1 captures remain explicit; present placement cannot repair them.

Keep raw titles, descriptions, actors, library IDs/names, identity keys, event
IDs, source fingerprints, candidate scores and error text out of the aggregate.
Use fixed failure/deferral codes. Validate arithmetic, size and exact fields at
both worker output and checkpoint read boundaries. Successful data expires from
display after fifteen minutes without revalidation; failed, deferred, future,
invalid, missing and stale states must not masquerade as completed zero counts.
Freshness uses the source audit observation, not HTTP request time.
The client anchors elapsed age to the original monotonic request start, including
network time. Vue proxies are unwrapped for that response-specific anchor;
pause/resume and a hidden tab cannot restart the freshness allowance.

## Recommended visibility

Show one quiet optional section in the existing administrator Evaluation progress
area. Use a protected, rate-limited, `no-store`, read-only saved-status GET that
does not run the audit, seed a row or repair anything. Keep its failure independent
from the existing comparison-history response. Centralize the named client API
leaf, strictly project safe data and reuse nonpersistent polling/access-loss
clearing/paused presentation patterns. No new dashboard or per-item alert cards.

Keep changing status text in a concise polite live region; timestamps and expanded
reason details need not be repeatedly announced. Use native disclosure controls,
clear labels for overlapping populations and no focus movement on refresh. An
existing private CLI status option should also read the saved aggregate only.

## Official research and alternatives

Sources were discovered and read through connected MCP search/GitHub services on
2026-10-28. These are applications of guidance, not compliance certification.

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) supports explicit derivation.
  Derived gap counts retain their cohort/window meaning instead of becoming
  operator labels or recovery authority.
- [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  supports the existing consistent multi-query read snapshot. Separate bounded
  checkpoint writes from source reads and preserve ownership fencing.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports aggregate diagnostics and omission of access tokens, connection data
  and identifying content.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports notifying assistive technology of meaningful status changes without
  taking focus or unnecessarily interrupting the user.

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Independent job/checkpoint using shared lifecycle | Isolated availability; bounded private aggregate | New migration and small adapters | Recommended |
| Embed audit in destination evaluation | Fewer lifecycle/storage changes | Couples evidence failures and resource policy | Defer |
| In-memory aggregate only | No durable checkpoint | Restart loss and no cross-process CLI status | Reject for this batch |
| Existing Evaluation progress section | Visible automation without another page | Protected status API and client validation needed | Recommended |
| Private CLI only | Smallest presentation scope | Operator must fetch results manually | Alternative |
| Recover history from current placement | Apparent completeness | Invented provenance and circular evaluation | Exclude |

Final recommendation stack: existing scheduler/admission/lifecycle, abortable
read-only snapshot, fixed isolated pure computation, strict independent aggregate
checkpoint, safe optional status API and accessible existing-view presentation.

## Verification and next boundary

Test empty/legacy inputs, disjoint sums and overlapping counters, capped activity,
all 101-row sentinels, BIGINT identity and strict malformed-output rejection.
Use real disposable PostgreSQL for read-only enforcement, snapshot consistency,
publication fencing, cancellation/rollback, competing instances, freshness,
backoff and restore invalidation. Verify no provider, classification, feedback,
snapshot or replay-guard mutations, and no work caused by GET. Cover administrator
access, rate/no-store/query constraints, output redaction, access-loss clearing,
paused polling, native disclosures and quiet status announcements.

Run scoped checks before full affected coverage/quality gates. No live recovery,
production mutation, new branch, release or deployment is part of this work.
The next source-specific improvement remains frozen feedback action/reference
capture; historical import requires independently proven evidence and a separate
reviewed dry run.
