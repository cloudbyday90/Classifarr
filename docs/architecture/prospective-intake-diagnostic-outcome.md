# Prospective intake diagnostic: outcome

Date: 2026-09-23. See the separate
[design, tradeoffs, and recommendation stack](prospective-intake-diagnostic-design.md).

## Implemented

The read-only `--prospective` report now performs one additional bounded history
query inside its existing fixed-window repeatable-read transaction. It reports
`activity.recordedMovieTvEvents` and `activity.capped` (5,001 means **at least**
5,001, not an exact total). When there is no recorded movie/TV classification in
the window, `evidenceState.phase` is `awaiting_classification_intake`. If events
exist but none produced a frozen complete comparison, the phase remains
`awaiting_live_comparisons`. Captured events waiting for feedback retain their
existing phase.

The aggregate is counts and fixed codes only. The previous `status`, exact-event
feedback query, sample metrics, anonymous strata, `promotionAllowed: false`,
provider-call and routing-change contracts are unchanged. No database migration,
queue operation, model training, UI status, or release was added. SQL and pure
projection live in separate ES Module service files.

## Observed live state

The healthy approved local container reported zero captured comparisons through
`2026-09-23T09:36:37.411Z`. A separate read-only check found zero classification
history rows since `2026-09-23T09:03:40Z`; the latest recorded classification was
`2026-09-22T04:10:02.174Z`. No classification task was pending or processing, and
no webhook had arrived since August 29. One Overseerr webhook configuration is
enabled. This supports **quiet intake**, not a demonstrated capture failure. It
does not establish accuracy or an outage.

On 6,798 existing history rows, PostgreSQL's read-only `EXPLAIN (ANALYZE,
BUFFERS)` measured approximately 3.5 ms for the bounded date-window count,
scanning 2,143 cached buffers. The count remains subject to the existing 15-second
query timeout. A new history index would require a migration with write-lock
considerations and is not justified by this measurement alone.

## Verification

The full backend coverage run passed (1,385 suites / 40,648 tests), and the
server/client coverage ratchet passed. Focused unit and CLI tests passed again
after the final guard change (2 suites / 19 tests); focused PostgreSQL tests
passed (1 suite / 3 tests). These cover the exclusive window, media scope,
sentinel ceiling, quiet versus uncaptured intake, pending feedback, and
malformed-count fail-closed behavior. The capped 5,001 count is correctly
treated as a lower bound even if captured events exceed 5,000. Server lint and
typecheck, knip, ESM import checks, markdownlint, copyright, and diff checks
passed.

The [previous commit's hosted CI](https://github.com/cloudbyday90/Classifarr/actions/runs/35842937906)
passed its build/test, database and release-acceptance jobs. GitHub's open-PR
endpoint returned no PRs, so there
was no random PR patch to apply locally or merge.

## Local deployment verification

With operator approval, the local image was rebuilt from code commit
`966f3fcf65a252db5e1289269bc60bbb05a58c30` and passed an isolated
no-network diagnostic smoke test. The previous image remains tagged
`classifarr:rollback-20260923`. The Compose service was recreated without
changing its persistent data mount or routing settings; the new container is
healthy with zero restarts. `/health` returned HTTP 200 with a connected
database, and unauthenticated `/api/libraries` still returned HTTP 401.

The deployed read-only report for `[2026-09-23T09:03:40Z,
2026-09-23T09:54:00Z)` returned zero recorded movie/TV classifications and
zero complete comparison captures. Its phase is now
`awaiting_classification_intake`, with `promotionAllowed: false`, zero provider
calls, and zero routing changes. This confirms the diagnostic behavior, not
future capture correctness or classification accuracy. No release or tag was
created in Git.

## Next high-value item

First reconcile the enabled Overseerr source with actual request activity: if
Overseerr has received recent requests, trace webhook delivery, authentication,
application receipt and queue admission without exposing payloads or secrets. If
it has been quiet, do not treat idle intake as an outage. Once a genuine
classification enters the fixed window, inspect whether its comparison is
eligible and frozen. If events occur but captures stay at zero, add a bounded,
privacy-preserving eligibility-reason aggregate at the retrieval boundary and
test movie/TV persistence. Only after real corrections accrue should a disjoint
later cohort inform any reversible ranking proposal.
