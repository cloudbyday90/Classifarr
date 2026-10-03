# Embedded PostgreSQL Lifecycle I/O Outcome

Date: 2026-10-02. See the [design, official sources and tradeoffs](embedded-database-lifecycle-io-design.md).

## Delivered

Three small ESM modules bound complete operations, identity-file reads and
shutdown helpers. The controller commits adoption only after verified success,
serializes calls and refuses reuse after failed adoption or shutdown. The
supervisor forwards host cancellation during adoption and keeps diagnostic
failures from interrupting cleanup. Existing runtime monitoring, application
drain ordering and fast-shutdown semantics remain intact.

Shutdown is confirmed only after clean control data and an absent PID file.
Cancellation or timeout does not prove PostgreSQL stopped: the server can finish
an already-sent request later. There is no automatic second stop command.

No dependency, schema, permission, deployment-template or version change is
required. This does not authorize recovery of unknown library-ingestion owners.

## Validation

Validation uses Node 24.21.0/npm 12.2.0 and a disposable AMD64 image layered on
the previously validated PostgreSQL 18.6 baseline. It is not a release image or
a live deployment.

Final local test image:
`sha256:dad3d9081842bd1e3bf9865f33ad38292e2f1517acc4277fc8a674d9bcec23a1`.
Only the changed lifecycle modules were overlaid; this is not a full cold build
of the entire dependency tree.

The new Linux rehearsal covers:

1. Actual symlink and FIFO identity files rejected without blocking.
2. Host cancellation while adoption awaits a delayed read: no application launch,
   database command or adopted ownership.
3. A shutdown read completing after the 25-second budget and one-second join
   window: no late command or retry, and the database remains usable.
4. A real paused PostgreSQL process and a cancelled `pg_ctl` helper: the helper
   exits, the controller reports cancellation, and PostgreSQL completes the
   original fast stop after resuming. No second command is issued.
5. Normal bounded adoption/shutdown with clean-state confirmation, restart and
   preservation of committed sentinel data with `fsync` enabled.

The harness has no network or host database mount, one CPU, 512 MiB RAM, 128
PIDs, a read-only root and temporary filesystems. It refuses an existing cluster.
Injected delay and SIGSTOP are controlled faults, not a physical slow-disk
benchmark. CI runs this rehearsal against its freshly built image.

All five lifecycle cases passed on that final image. The existing runtime-monitor
and delayed-start/crash-recovery rehearsals also passed, as did all four
entrypoint smokes: missing extension runtime files on fresh/existing clusters,
PG17→18 upgrade/config normalization, and invalid included-config diagnostics.

Completed checks:

- Focused Windows lifecycle/queue/admission tests: 336 passed in 17 suites.
- Focused Linux tests: 194 passed in 14 suites, none skipped, including the
  Linux-only directory-fsync/source-preservation test.
- Final smoke-helper/queue regression check: 124 tests passed in four suites.
- Final backend coverage: 1,631 suites and 49,833 tests passed. The one test
  skipped on Windows is the Linux directory-fsync case verified above. Line
  coverage is 90.05%; branch coverage is 85.45%.
- Frontend coverage: 416 files and 5,912 tests passed, with 88.09% line and
  78.92% branch coverage.
- Repository lint, backend/frontend types, copyright, npm CLI flags, both Knip
  modes, ownership review, ESM import/mock-shape checks and all 28 tooling tests
  passed. Markdown lint checked 1,775 files with zero errors.

An early backend run was stopped after the ownership-record update and test
corrections, also reducing concurrency during host memory pressure. Its partial
results are not release evidence. The final backend run uses two workers and a
256 MiB idle-worker recycling threshold and passed in 866 seconds. Frontend
coverage was also rerun with two workers and passed in 563 seconds. Both final
reports passed the coverage ratchet without lowering any thresholds.

```sh
IMAGE_NAME=classifarr:test npm run docker:smoke:postgres-lifecycle
IMAGE_NAME=classifarr:test npm run docker:smoke:postgres-monitor
IMAGE_NAME=classifarr:test npm run docker:smoke:postgres-startup
IMAGE_NAME=classifarr:test npm run docker:smoke:pgss
```

The broader run exposed an existing queue-worker unit test that depended on
the host's real free-memory telemetry. Under memory pressure, production
admission correctly refused a permit and the classification-dispatch assertion
never ran. That test now supplies an allowed permit and stops on the observed
dequeue rather than assuming one event-loop turn is sufficient. Dedicated
admission and worker-loop tests still cover refusal; production limits are
unchanged. No skip, retry-to-pass policy or lowered assertion was introduced.

The PG17→18 smoke also exposed a pre-existing initialization race: socket
readiness could accept the official image's temporary server immediately before
its planned shutdown. The seed-image readiness probe now targets container-local
TCP, without publishing a host port. The official entrypoint starts its temporary
server with TCP disabled, then starts the final server after initialization.
[Official image entrypoint](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh),
[pg_isready host selection](https://www.postgresql.org/docs/current/app-pg-isready.html).

Source-bound ownership records were refreshed after reviewing the controller
and supervisor. Their static gate does not grant runtime authority or clear
existing unresolved writer/privilege-separation work.

## Delivery and follow-up

GitHub MCP and the saved GitHub CLI login both returned zero open Classifarr
PRs. No random PR could be selected, applied or merged.

Live Classifarr data and deployment settings remain untouched. Disposable test
containers and synthetic volumes are removed by the harness; their data is
discarded and reproducible. No release or version bump is part of this change.

Recommended next: an image-level Docker-stop acceptance rehearsal with real
application and maintenance work in flight. Test the actual PID 1 signal path
and both short legacy host timeouts and the supported 60-second grace period.
Keep committed-data/recovery checks, explicit unconfirmed outcomes and unchanged
Unraid/Synology templates. Component-level deadlines cannot extend the host's
stop deadline. Native ARM64 execution and a same-image loaded release rehearsal
remain separate release acceptance requirements.
