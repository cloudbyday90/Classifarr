# Controlled library catalog recovery outcome

Date: 2026-09-27. Status: Unreleased. No release or live deployment created.

## Delivered

The existing watchdog now admits due catalog discovery before its existing
ingestion selection. This closes the gap where scheduled library-content sync did
not discover new libraries or recover failed catalog requests. Configured fresh
setups can discover libraries without a manual first scan. Unconfigured and
inactive setups perform no provider work.

Small ESM modules isolate retry policy, session ownership and scheduled execution.
One durable row per source stores a capped burst counter and next eligible time.
Upgrades conservatively adopt old status evidence without an immediate retry
storm; fresh snapshots install the same constraints. No new dependency, timer,
worker or AI call is introduced.

| Situation | Automatic behavior | Operator action |
| --- | --- | --- |
| Healthy catalog | Next eligible scan in six hours | None |
| Timeout, network failure, retryable server error | Five-attempt jittered burst, then one probe per six hours | Restore connectivity if needed |
| Rate limit | Respect server delay, or use bounded backoff | Avoid repeated manual retries |
| Rejected credentials / permissions | Wait for a changed connection revision | Correct access and save, or retry explicitly after fixing it |
| Invalid / oversized catalog or excessive server delay | Pause for review; preserve inventory | Inspect provider/proxy, then Sync Libraries |
| Another catalog owner is running | Defer without recording another attempt | Wait |
| Process stopped mid-scan | Retain charged budget and conservative delay | No unsafe age-based takeover |

The user-visible status gives the next eligible time or required action. It uses
the existing read-only, administrator-only SWR card and polite status region; no
polling was added. Manual Sync Libraries remains an explicit retry override and
keeps its existing content-sync/queue-refill effects.

## Safety and limits

Status admission and merge writes use the same checked-out PostgreSQL connection
that owns the catalog lock. Connection loss cancels provider requests and prevents
later writes through that scope. All three adapters accept cancellation. This is
a cooperative catalog lock, not proof that older/external ingestion writers stopped.

Automatic work requires durable admission; observability failures cannot create
an unbounded fast loop. Manual diagnostic writes remain best-effort. Complete
catalog validation, configuration revision checks, non-deleting merge, music
exclusion and archive preservation are unchanged. Source-library discovery does
not mark content ingestion complete or authorize learning.

The existing watchdog has five-minute granularity and processes ingestion
sequentially, so eligible times are not deadlines. Sparse probes trade recovery
latency for a firm request bound during long outages. Manual retries intentionally
override automatic waits. Only the active source chosen by the existing application
contract is discovered; this does not add simultaneous multi-server support.

## Verification

Tests cover safe Retry-After parsing, jitter and capped bursts, disabled/fresh
setup, access changes, restart persistence, competing manual/automatic runs,
connection loss, invalid data, upgrade adoption and fresh-schema installation.
Real HTTP fixtures exercise Plex, Emby and Jellyfin. A composed PostgreSQL test
proves discovery recovery still leaves learning waiting until both movie and TV
ingestion complete. Existing legacy-owner and ingestion-recovery tests remain
part of regression coverage. All providers and databases used for tests are local
synthetic fixtures or disposable containers.

Final validation:

- Backend unit coverage: 1,506 suites / 45,285 tests passed.
- Full integration: 186 suites / 2,144 tests passed; one existing suite/test skipped.
- Focused final integration: 5 suites / 96 tests passed, including the complete
  recovery-to-ingestion path and both schema installation paths.
- Frontend coverage: 401 files / 5,644 tests passed.
- Playwright: keyboard, read-only refresh, recovery messages and desktop/mobile
  screenshots passed. Production frontend build passed.
- Lint, type checks, ownership/copyright/dependency preflight, policy gates,
  migration/snapshot integrity, ESM checks and Markdown lint passed.

The coverage ratchet passed without changing thresholds. Backend statement/branch
coverage is 90.32% / 84.73%; frontend statement/branch coverage is 85.95% / 78.45%.

GitHub MCP returned no open PRs for this repository. No random PR was available,
no closed/unrelated PR was substituted, and no PR was merged.

## Recommendation stack and follow-up

Keep PostgreSQL for durable admission and session ownership, bounded native HTTP
for provider reads, modular ESM services for policy/orchestration, and Vue/SWR for
read-only status. [Design and official sources](library-catalog-recovery-design.md)
record the alternatives: an in-memory loop loses restart safety; an external
workflow engine adds unnecessary infrastructure at this scope.

Next: assess shared source-outage admission for content-page requests. Catalog
discovery now backs off, but known-library ingestion has its own recovery budget.
Use one bounded source recovery probe to avoid many libraries independently
contacting an offline server, then resume eligible ingestion fairly through its
existing ownership guards. Do not treat a successful catalog probe as proof that
all library permissions or content pages are healthy.
