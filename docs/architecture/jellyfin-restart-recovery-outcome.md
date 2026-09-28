# Jellyfin restart recovery acceptance outcome

Date: 2026-09-28. See the separate
[design and research](jellyfin-restart-recovery-design.md) and
[PR 551 adoption](pr-551-dev-tooling-local-adoption.md).

## Delivered

Added an integration acceptance suite with small ESM helpers for process isolation,
IPC lifecycle, synthetic Jellyfin HTTP responses and metadata/profile backfill.
It is discovered automatically by the existing integration configuration; no new
CI workflow or production service is required.

The test uses real PostgreSQL and abruptly terminates actual Node ingestion
processes. The production Jellyfin parser, source circuit, ownership, replay,
capture, pruning, queue persistence and profile services are exercised. Local
dotenv loading is suppressed before service imports; child environment variables
are allowlisted. The test refuses normal application database names and non-loopback
provider fixtures, bounds process commands, drains rather than prints raw logs,
and cleans up only its own workers, sockets and suite database/container.

## Observed behavior

| Stage | Expected and observed outcome |
| --- | --- |
| Fresh database / legacy inventory | Learning remains deferred without libraries or completed ingestion |
| Source outage, then new process | One failing HTTP request; the persisted shared wait survives |
| Movie media page / TV collection page interrupted | Partial and legacy records remain; capture/checkpoint stays unfinished |
| Competing live process | Even an expired retry timestamp cannot bypass the live ownership lock |
| Original process killed | Session lock disappears; durable retry timing still prevents early takeover |
| Replay due | Watchdog selects the library; replay starts at page zero despite incremental caller |
| Full enumeration complete | Four items and three collections per library; legacy leftovers pruned only now |
| Music returned in supported libraries | Ignored, not captured or imported; music library insertion also rejected |
| Metadata queued | Eight real metadata tasks keep the learning wrapper deferred until completion |
| Profile refresh | Both four-item profiles reach the source revision with observed keyword evidence |
| Evaluation admission | One synthetic worker invocation; no routing or model evaluation |

No production recovery regression was exposed by these scenarios, so existing
runtime safeguards were retained rather than adding a second recovery mechanism.
The only dependency changes are the selected development-tool PR.

## Run locally

From `server/`, with Docker available:

```powershell
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --testPathPatterns='jellyfin-restart-recovery'
```

This creates disposable PostgreSQL test resources. It does not use the running
Classifarr deployment, existing library data, provider accounts or paid model APIs.
Only synthetic retry timestamps are advanced after assertions prove early retries
are refused. The fixture also extends synthetic deadlines for slow CI runners and
expires a live owner's retry timestamp to prove age cannot grant ownership.
Production delays are unchanged.

## Validation

- Focused acceptance: two tests passed, including the database-isolation guard.
- Clean full backend unit coverage rerun: 1,509 suites / 45,423 tests passed.
- Recovery regression group: three suites / 53 tests passed, covering the new
  process scenario and existing source-circuit/library-ingestion cases.
- Full backend integration: 188 suites / 2,164 tests passed; one existing skipped
  suite/test remains unchanged. This also exercises Supertest 7.3.0 across routes.
- Fresh frontend coverage: 401 files / 5,648 tests passed. No frontend runtime or
  dependency changed.
- Code-health and static-import assessment: two suites / 29,501 checks passed.
- Lint, server/client type checks, CI preflight (including Knip), four policy
  static gates, ESM gates, documentation lint and whitespace checks passed.

The coverage ratchet passed against both fresh reports: backend statements
90.30% / branches 84.74%; frontend statements 85.95% / branches 78.45%.
No coverage threshold or baseline was weakened. Disposable PostgreSQL containers
and ingestion children were removed; the existing healthy Classifarr container
and persistent data were left untouched.

During development the fixture initially attempted to store a music library;
the existing schema correctly rejected it. The test now verifies that rejection
and separately tests stray audio returned by a supported library. A code-health
check also caught an intentionally silent promise handler; explicit rejection
capture/assertion replaced it. Preloading the isolation hook with `--import`
preserves static imports and the existing ESM gate without exemptions.

## Limits and next component

This is a real **ingestion-process** crash/restart, not a complete application
container restart or a real Jellyfin binary compatibility test. Metadata responses
are synthetic, and profile freshness is not classification accuracy. Queue refill
and profile refresh are explicitly driven; production scheduler timing is not
certified. No release or live Compose rebuild was performed.

The highest-value next component is the **durable ingestion-to-backfill handoff**.
Code inspection found that `inventoryBackgroundReadiness.mjs` checks pending/due
and processing queue rows but not enrichment demand before those rows exist.
Investigate and close the potential readiness window between a completed scan and
the next refill. Prefer a revision-scoped handoff/checkpoint using existing queue
boundaries over polling every inventory row or waiting forever for optional
providers. Require a regression that pauses refill after scan completion, restarts
the process, and proves evaluation stays deferred until required work is accounted
for. Preserve explicit terminal/deferred outcomes and music exclusion.

This recommendation follows the atomic-write and idempotent-consumer principles
in [AWS transactional-outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
It is an application design inference, not a recommendation to add AWS or another
broker. Pros: durable demand survives restart and closes an ambiguous empty-queue
window. Cons: generation fencing, bounded enqueue and terminal-state reconciliation
need explicit contracts and tests. Prefer the existing PostgreSQL stack.

Then exercise that scheduler-controlled handoff in the pinned full-image/Jellyfin
acceptance layer. The prior published-upgrade drill still requires local GitHub
CLI reauthentication; this work does not bypass or claim that provenance check.
