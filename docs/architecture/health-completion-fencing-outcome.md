# Health completion fencing: outcome

Date: 2026-10-12. See the separate
[design, alternatives and official research](health-completion-fencing-design.md).

## Delivered

Cached health checks share one in-flight operation per service and publish only into the
current process generation. Reset fences old results, cleanup and notifications.
The ten configuration-dependent checks re-read their exact configuration before
acceptance. Changed content returns unknown with `configuration_changed`, safe
Refresh guidance and no stale instance/provider details. Validation failures use
existing sanitized diagnostics. Initial failed reads perform no extra read/probe.
Detailed health shares aggregate refresh work, uses latest accepted service values,
and invalidates its cached result when accepted observations change.

Two small ESM services separate coordination from private configuration comparison.
No dependencies, migrations, background recovery writes, retry loops or timers were
added. Memory safeguards, authentication, database readiness and provider timeouts
are unchanged. Overlapping callers now wait for the same result; a changed input
waits for the next normal check or explicit Refresh rather than retrying immediately.

This is content revalidation at a point in time, not a durable revision or lease.
It does not detect A-to-B-to-A changes between reads, prevent writes after the
validation snapshot, or instantly invalidate completed results after settings saves.
Comparison is deliberately conservative over the selected rows, including fields
that may not affect a particular probe. Transport cancellation is not claimed.

## Source and local deployment

- Started on clean `main` at `3bec002e2b1d3144641a9fa1fcdff8073c69a9fa`.
- Clean image source: `326b2634cc0330f50df0b1e855a12fefe48791f5`.
- No-cache Compose build with `--require-provenance`, Linux/amd64 and AVX2.
- Local Docker image `.Id`:
  `sha256:a99cabce4f33d80d05989f65ccae72cca73dde24db734b2b5e5a69aad0e3272c`.
- Previous image retained:
  `sha256:e774bb42042079cba5c23ee630bfeb3ea8728ae71e60d7b4b4ea6c7fb3b68f3b`.
- Fresh 76,003,531-byte database backup: checksum and archive listing verified.
  This was not a full restore rehearsal.
- Local container recreated at 20:08:12 UTC. Healthy; uid/gid 1000, read-only root,
  2 GiB limit, no-new-privileges and PostgreSQL noexec tmpfs retained.

The image identifier is local Docker evidence, not a published registry digest or
signed multi-platform provenance. All eleven checked runtime source files matched
the deployed image byte for byte. Later outcome-document changes do not alter the
runtime. No release, tag, version bump, new branch, Unraid deployment, Plex change
or shared Ollama change was performed. Normal application startup jobs remained on.

## Verification

- Focused backend: 34,748 tests / 12 suites passed, including aggregate status
  combinations, all ten configuration-drift paths, shared admission, independent
  services, reset before/after validation, alert suppression and aggregate races.
- Backend/frontend lint and type checks, full/production dependency analysis,
  static imports, npm CLI policy, copyright and Markdown checks passed.
- Reviewed the ownership gate's changed metadata-health source: literal provider
  choices, fixed read-only query factory and SQL unchanged; guard plumbing only.
  Updated only that file's digest. Ownership checks and 39 gate tests passed;
  no review classification, analysis digest, parser or baseline was relaxed.
- Chromium: two responsive health-summary checks and eight production-route asset
  checks passed. The new message uses the existing safe diagnostic UI; its binding
  is covered by the System component test, not a new browser screenshot assertion.
- Frontend test-runner configuration: 12 passed. Staged secret scan passed.
- Full frontend coverage: 7,179 tests / 468 files passed in 510.89 seconds.
  Statements 87.59%, branches 81.56%, functions 87.26%, lines 89.31%.
- Full backend coverage: 56,735 passed, one skipped / 1,806 suites in 976.616
  seconds. Statements/lines 89.74%, branches 86.23%, functions 91.18%. Both new
  services and the configuration-read boundary have 100% coverage in all four
  metrics. The combined frontend/backend ratchet passed without baseline changes.

### Exact-image and database checks

Packaged code passed six aggregate cases, five synthetic freshness HTTP cases,
one configuration-failure HTTP case and one concurrent configuration-drift HTTP
case. Drift remains unknown through the actual route and excludes the old instance
name and endpoint. Controlled timestamps are fixture time, not elapsed heartbeat
evidence. Actual local health/liveness/readiness returned 200; unauthenticated
detailed health returned 401. The pgvector startup record matched database startup;
a diagnostic process correctly reported the application record as `other_process`.

After the build, ran `dumpSchema` in an owned network-isolated synthetic container
with 1 GiB memory, two CPUs, 256 PIDs and no published ports. No schema diff; all
migrations through `20261010_220000_source_catalog_mappings.sql` and 22 seeds were
included. Five actual PostgreSQL configuration-read checks passed. Three additional
checks used separate database connections and committed endpoint, disable and
deletion changes while a check waited: all rejected the old observation. Only a
synthetic fixture table was written, after the dump. No external provider calls or
application-data writes were made by these probes. Owned container and temporary
data directory were verified removed; these disposable fixtures are reproducible.

Read-only local before/after counts remained 6,837 classifications, ten active and
covered libraries, four unresolved identities (two source review, two retry wait),
zero pending text embeddings and 6,815 pending image embeddings. The pre-rebuild
sample retained a cached-vector warning; the immediate post-start sample had none.
This does not establish that vector recovery or retained-memory issues are fixed.
The post-start container sample was 380.4 MiB / 2 GiB with no OOM termination or
restarts. That short observation is not a memory-leak profile or long-running soak.

## Recommendation stack and next item

1. Shared admission: fewer duplicate probes; concurrent Refresh waits for existing
   work instead of superseding it.
2. Private content revalidation: catches committed drift from another process;
   costs one additional database read and conservatively returns unknown on change.
3. Fenced publication and aggregate coherence: prevents old results becoming the
   accepted current cache; does not cancel transport already in progress.
4. Next: post-commit configuration-cache invalidation, including cross-process
   reconciliation. Inventory every configuration writer and transaction boundary
   before promising immediate visibility after a settings save.

GitHub MCP found zero open PRs at admission and final recheck; no random PR was available and none
was merged. The prior head's seven CI workflows completed successfully; that is
baseline evidence, not verification of this new head. Remote CI is separate from
these local checks and is not claimed passed for this change.
