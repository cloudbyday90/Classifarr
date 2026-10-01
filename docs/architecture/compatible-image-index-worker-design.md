# Compatible image-index worker design

Date: October 1, 2026. Baseline: `8b88e6a1`. Source-only; no release.

## Decision and alternatives

Move existing deferred image-index jobs into a bounded child of the embedded
supervisor. Reuse the current executor, queue claims and restore checks. This
extends the user-selected compatible maintenance pattern, not its permissions.
These are PostgreSQL search indexes for image embeddings, not Docker images.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Keep in-app execution | No additional process | App owns a stuck executor; retained for standalone deployments |
| Compatible on-demand worker | Independent deadline and cleanup; unchanged templates | Temporary Node process, unchanged shared authority; selected |
| Full privilege separation | Limits compromised-app maintenance authority | Needs protected storage and complete operation adapters; separate work |

The security-hardening design review influenced the fixed claim-only boundary,
preserved SQL checks and explicit distinction between lifetime containment and
privilege separation. No vulnerability closure or complete isolation is claimed.

## Execution contract

The existing queue dispatches a `rebuild_hnsw_index` job. Its application process
sends only a 56-byte ASCII frame: operation marker, padded positive bigint job ID
and UUIDv4 claim token. No payload, SQL, executable path, identity, credentials or
provider data crosses the channel. The worker rechecks the actual database row;
knowing an ID is not sufficient ownership.

This adapter consumes existing jobs; it does not discover new index damage or
enqueue repairs. Fresh schemas obtain their indexes through existing migrations.
A separate criteria-based reconciliation component is needed to turn future
missing/invalid-index observations into deduplicated automatic work.

Normal embedded composition supplies FD4 to its direct child alongside the
existing FD3 vacuum channel. These are internal capabilities, not settings to add
to Compose or Community Apps. Restore mode supplies neither. One module owns the
application's index descriptor, so multiple queue processors cannot independently
open it. A broken configured channel never falls back to direct execution.

The supervisor accepts fragmented frames within the fixed bound, rejects excess
input and concurrent requests, and starts only the packaged index command. The
child receives a constructed local-database environment with no inherited preload
hooks or credentials. It has the same non-root OS user and `classifarr` SQL login
as today. It is not a separate administrator authority.

The unchanged executor uses a pinned disposable connection, shared runtime/restore
admission, restore gate and exclusive index lock. It accepts only three code-owned
index definitions, preserves unexpected same-name objects, and checks the live
claim before each DDL statement and transactional acknowledgement. Concurrent DDL
stays outside that short acknowledgement transaction.

## Resources, recovery and outcomes

No job means no index child. Each channel is single-flight: at most one queue
recovery child and one index child can coexist. No new scheduler or listener is
introduced. Limits are:

- One index request per minute; distinct concurrent claims are not coalesced.
- 512-MiB V8 heap, two pool connections, 64-KiB drained/discarded child output.
- Existing 120-second SQL execution budget, 64-MiB maintenance work memory,
  no parallel maintenance workers and two-second lock timeout.
- 130-second whole-command deadline; independent 135-second supervisor wait,
  then bounded TERM/KILL joins; 140-second client response deadline.

These are not total RSS or CPU quotas. PostgreSQL also consumes resources, and
large builds may not fit the existing budget. We do not silently raise limits.

Completion means all expected indexes were verified and the owned queue row was
acknowledged. Actual worker failure uses the application's existing claim-fenced
attempt policy. Busy/throttled requests and restore deferrals leave normal lease
recovery available without spending an attempt. Index-lock contention retains the
executor's existing one-minute requeue policy.

The normal queue visibility window defaults to ten minutes and is configurable;
a locally throttled claim can therefore wait that long before redispatch. We do
not introduce an unguarded queue write just to shorten that wait.

Supervisor logs identify `image_indexes`, `shared_identity`, start and outcome.
Raw child output and claim tokens are not forwarded. There is no new UI or claim
of additional WCAG conformance.

Cancellation joins the Node child and its streams. PostgreSQL can observe a socket
disconnect later; its statement timeout and session lock remain essential. A SQL
statement already in flight can finish after claim revocation, but the old worker
cannot acknowledge a replacement claim. A later owned job reinspects the catalog
and repairs only matching invalid indexes. No inventory or media is deleted.

## Official research

URLs were discovered with web MCP and reviewed October 1 against the September
2026 PostgreSQL 18 / Node 24 baseline. Live pages are not archived September copies.

- [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html):
  concurrent builds have additional work/waits, can leave invalid indexes, and
  cannot run within a transaction block. Name existence alone is not validation.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  drain bounded pipes, execute without a shell and distinguish signal delivery,
  process exit and stream closure.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  preserve meaningful textual outcomes; future UI status announcements should
  avoid unnecessary interruption and expose state to assistive technology.

## Acceptance and rollback

Validate malformed/fragmented input, flooding, stale claims, restore quarantine,
interrupted builds, mismatched catalogs and cancellation. Exercise actual queued
completion under unchanged standard, custom-ID and Community Apps-style profiles.
Retain isolated-role denials and existing vacuum tests.

No schema, dependency, API or saved-template migration is required. Source rollback
restores the direct adapter; durable queue state is retained. Running old images
do not gain this behavior from a Git push. Image publication/installation remains
separate from this commit.
