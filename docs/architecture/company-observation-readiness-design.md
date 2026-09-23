# Company observation readiness: design

Date: 2026-09-23.

## Finding and scope

The preceding prospective-ranking change passed hosted CI, but the local running
image predates both company capture and prospective ranking capture. Read-only
inspection found 6,696 movie/TV source rows, zero company observations, a configured
TMDB integration and no pending or processing tasks. Existing keyword/language
coverage is not evidence that production companies were acquired.

The health reader also omits company metadata from its narrow projection. Extend
that existing report rather than introduce another benchmark, scheduler, consent
screen or per-item task. Keep company-assisted routing disabled. Updating source
code does not update a running container.

## Recommended implementation

- Preserve the existing keyword/language acquisition-state contract and historical
  scan counters. Add separate current company-observation counters and coverage.
- Reuse the company model's typed-identity, version, timestamp and company-set
  validator. Valid empty sets are successfully checked observations, not missing
  records or useful company evidence. Missing, malformed, mismatched, future and
  expired records cannot count as current.
- Bound the independently projected company envelope with the existing 4 KiB
  per-observation response limit. Expose withheld counts, never raw company names,
  provider identifiers, credentials or source titles. This is row-based coverage,
  not model eligibility or accuracy; conflicting placements can still be excluded
  later by the model.
- Put the compact coverage line and empty/withheld distinctions inside each
  existing native details disclosure. Do not widen the main table or add an alert.
  Missing fields from older servers mean unavailable, not zero.
- Use the existing automatic enrichment/refill queue for missing/expired company
  observations, including its six-hour attempt cooldown and source-identity checks.
  Do not force new classifications or re-route existing media to obtain samples.

## Research and tradeoffs

Official sources were discovered through web search and GitHub MCP and read on
2026-09-23:

| Approach | Benefit | Cost / constraint | Decision |
| --- | --- | --- | --- |
| Existing bounded health report | One place to verify automatic backfill; no new worker | Snapshot scope and byte limits must remain explicit | Use |
| Separate company freshness | Avoids presenting legacy keyword coverage as company readiness | A small additive API field and disclosure | Use |
| Immediate company-assisted routing | Faster visible behavior change | No prospective evidence of benefit yet | Do not enable |
| Rebuild and health-check local container | Actually runs the new code | Brief outage; resumes existing background integrations | Requires local restart approval |
| Bulk/manual metadata refresh | Could finish sooner | Provider load, more operator work and duplicated scheduling | Keep automatic bounded backfill |

[Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
recreates services when images/configuration change and can wait for health;
[restart](https://docs.docker.com/reference/cli/docker/compose/restart/) does not
apply configuration changes. Retain the prior immutable image and preserve data
mounts. Verify pending migrations before treating an image rollback as sufficient.

[TMDB rate-limit guidance](https://developer.themoviedb.org/docs/rate-limiting)
requires clients to respect rate limiting; it does not justify unbounded refresh
concurrency. Reuse existing retries rather than add traffic for this report.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
supports non-focus-stealing status updates and cautions against overly chatty
announcements. Retain the existing load status and keyboard-operable native
disclosures; company counts do not need a new live region or acknowledgement.

[Upstream dotenv changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)
documents 18.0.1's file-URL logging fix. Apply the sole open, unapplied
[PR #546](https://github.com/cloudbyday90/Classifarr/pull/546) locally, not through
a PR merge. Later upstream patches exist; this change deliberately validates the
selected PR's exact lockfile rather than silently expanding the dependency update.

## Final recommendation stack

1. Keep ESM services, current identity guards, authenticated read-only reporting
   and the existing enrichment queue.
2. Validate current company coverage separately from general capture freshness.
3. Deploy the tested build through the normal workflow when restart is approved.
4. Let real traffic create passive paired captures and delayed operator outcomes.
5. Evaluate a fixed window, then a disjoint later cohort, before any reversible
   company-assisted ranking promotion. Do not increase confidence to hide gaps.

Implementation and verification are recorded separately in the outcome document.

## Build failure discovered during deployment

The initial build encountered a GitHub DNS lookup failure. An existing ungrouped
`&& make clean ... || true` then swallowed the upstream error and entered a build
without extracted sources. Group only the tolerated cleanup command; chain
compilation, installation and copies with `&&` in every variant, so a failed stage
cannot fall through to a successful later command. Keep download checksum
verification and bounded retries unchanged; do not bypass integrity to deploy.

This follows the [POSIX shell AND/OR semantics](https://pubs.opengroup.org/onlinepubs/000095399/utilities/xcu_chap02.html)
(equal precedence and left associativity) and
[Docker's build guidance](https://docs.docker.com/build/building/best-practices/)
on preserving failures in multi-command RUN steps. The benefit is reliable error
propagation; the cost is correctly failing builds that formerly continued past an
error. It does not fix DNS itself. Regression tests execute the actual shell
structure with stubbed commands across generic, AVX, AVX2 and multi builds, with
no downloads, file mutations or real compilation. Windows test environments need
POSIX `sh` on PATH, supplied here by the installed Git tooling.
