# Compatible on-demand queue maintenance outcome

Date: October 1, 2026. No release or live deployment.

## Delivered behavior

The [design and official-source research](compatible-queue-worker-design.md) now
has a production composition. Normal embedded startup gives its direct application
child an inherited channel. The existing queue recovery scheduler reads demand;
when assessment is needed, the supervisor launches one fixed short-lived worker.
Restore mode has no online maintenance channel. External/non-supervised runtimes
retain their existing direct path; a failed configured channel never falls back
to it.

The launcher, shared lifecycle broker, output observer and worker command are
small ES modules. No database migration, dependency, API, port, container, saved
template setting or additional polling loop was introduced. Existing startup,
restore, inventory and routing behavior is preserved.

Existing supported Compose/Community Apps configurations receive this behavior
when they run an image containing the change; they do not need a template refresh.
An older running image cannot acquire the new implementation from a source push.
Image publication and installation remain separate from this source-only commit.

Physical repair still requires independent sustained-pressure, restore exclusion,
ingestion/backfill readiness, autovacuum, cooldown and attempt checks. The worker
cannot accept SQL, paths, credentials or operation parameters from the channel.
Only the fixed ordinary task-queue VACUUM is delegated; this is not a generic
repair service and does not automatically reconcile legacy ingestion owners.

## Permissions and operational visibility

The worker deliberately uses today's non-root OS user and `classifarr` SQL login.
Logs identify `EmbeddedQueueMaintenance`, `shared_identity`, and assessment,
deferred, completed or unavailable outcomes. The database logger retains bounded
failure diagnoses. Raw child output is drained without being forwarded.

This contains execution lifetime, not administrator authority. The application can
still access PostgreSQL and change the retry ledger using its existing identity.
The separate root/postgres launcher and its protected-ledger assertions were not
relaxed. The security-hardening review directly influenced this explicit boundary
and the decision to reuse lifecycle mechanics without introducing a privilege
fallback.

The worker has one active process, a five-minute request floor, a 512-MiB V8 heap
cap, two connections, a 64-KiB output cap and an 85-second command deadline. The
supervisor independently bounds waiting and TERM/KILL cleanup, confirming exit
and stream closure before database shutdown. SQL keeps its existing sixty-second
budget, 64-MiB maintenance work memory and disabled parallel maintenance. These
are not a whole-container RSS or CPU quota and do not certify production capacity.

## Validation

No live data or external media provider was used in these tests.

- Real embedded-isolation drill: passed, including its existing eight
  separate-identity/restore/crash checks and successful cleanup.
- Real compatible worker: healthy, fresh/no-library, in-flight backfill, eligible
  repair and persisted cooldown scenarios passed for standard UID 1000, custom
  UID 2345 and Community Apps-style UID 99/GID 100. Production startup logged
  shared authority and had no idle maintenance process. These are representative
  Linux profiles, not tests executed on an actual Unraid host.
- All three profiles retained clean stop/restart and committed synthetic data.
  Observed clean stops, including control-state verification, were 2.40–2.55
  seconds with the unchanged ten-second host timeout. Forced unresponsive-process
  termination remained nonzero and recovered committed data; it was not reported
  as a clean stop. This small workload is not a loaded shutdown guarantee.
- Targeted PostgreSQL regression: 26 tests across three suites passed, including
  protected-ledger denials. Focused lifecycle/worker regression: 168 tests passed.
  Final ownership/composition subset: 84 tests passed.
- Frontend: 5,795 tests across 411 suites and production build passed.
- Full backend coverage: 48,520 tests passed, one existing skip, across 1,590
  passing suites in 641.69 seconds. The combined frontend/backend coverage ratchet
  passed without changing its baseline.
- Lint, type checks, Markdown lint, Knip, copyright, ESM and four policy gates
  passed. Ownership drift review passed with 19 owned, 192 separately coordinated
  and 490 unresolved paths; no unresolved path was waived.

All three published-upgrade profiles passed all 12 checks against the
attestation-verified `v0.48.4-beta` baseline, revision
`a0e417fd714919bb4ca30e20f9cd2380136ca74e`. Each receipt confirmed unchanged saved
configuration except for the image, migration from 222 to 309 existing migrations,
fresh startup, interrupted-restore quarantine and explicit retry, and automatic
movie/TV ingestion, backfill and profile progress. Music stayed excluded and
routing tasks remained zero. All owned test resources were cleaned up.

| Profile | Identity | Published upgrade | Compatible worker |
| --- | --- | --- | --- |
| Standard | Forced 1000:1000 | 12/12 passed | All five scenarios passed |
| Community Apps-style | Root startup, then 99:100 | 12/12 passed | All five scenarios passed |
| Custom | Root startup, then 2345:2345 | 12/12 passed | All five scenarios passed |

These drills intentionally keep real scheduler timing; waiting for the next
normal refill cycle is not an error or a bypass of the backfill checks.

The synthetic probe explicitly supplies its own bounded liveness handle because
the handoff client's channel is unreferenced while idle; the real app owns an HTTP
server. Its backfill fixture uses an in-flight task so the real application cannot
consume a pending fixture before admission is checked. Both fixture issues were
found by real-container runs and corrected without relaxing production checks.

## Recommendation stack and next item

1. Keep autovacuum primary and the existing readiness/retry policy authoritative.
2. Use this compatible worker for bounded conditional queue repair. Benefit:
   independent process cleanup without saved-template changes. Cost: an extra
   temporary Node process and unchanged shared administrator authority.
3. Next, connect **deferred image-index maintenance** to an equally fixed
   on-demand worker. Reuse the existing bounded executor, durable queue claim and
   restore exclusion; prove interrupted-build recovery and stale-claim refusal.
   Do not add generic command dispatch or a second scheduler.
4. Complete all privileged-operation adapters and protected persistent layout
   before any production identity cutover. Benefit: genuine authority isolation;
   cost: migration/rollback work and an explicit policy for forced-non-root hosts.

That next item extends an existing, tested executor instead of creating another
diagnostic-only component. Its acceptance boundary is a real queued index job
completed outside the app, with preserved claims, bounded cancellation and
unchanged supported saved deployments.

## Delivery scope and rollback

GitHub MCP and the saved-login CLI returned no open pull requests. There was no
random open PR to implement; none was invented, merged or closed. This round does
not publish an image, create a release or change the live container.

Reverting the supervisor composition restores prior direct execution without a
schema or data-layout rollback. Keep existing persisted recovery state and
cooldown records. Full privilege separation remains separate work.
