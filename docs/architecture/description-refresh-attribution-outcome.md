# Description-refresh attribution outcome

Date: October 11, 2026 (America/New_York). Scope: main, no release.
See the separate [design and research](description-refresh-attribution-design.md).

## What changed

Description refresh now records fixed operation stages, bounded elapsed durations,
allowlisted PostgreSQL categories and a process-local incident reference. The
reference survives the handoff from recovery warning to the scheduler's persisted
error and the later caught-up message. Database failures no longer automatically
look like embedding-provider failures. Persistent unknown cases request a GitHub
issue with sanitized context.

The generic error remains `inventory_description_refresh_unavailable`. No raw
cause, SQL, parameter, description, provider payload or credential is added. The
new reference is separate from each error-log row ID. Existing retry, ownership,
memory, transaction deadlines and cache checkpoints are unchanged. No schema,
identity approval, routing, API or UI change is included.

This addresses the missing explanation in the reported scheduler error. It does
not establish why the earlier corpus query exceeded 15 seconds under load or claim
that query latency is fixed. Unraid and the shared Plex/Ollama services are unchanged.

## Local random-PR trial

Fresh open-PR enumeration found #556 and #558; random selection chose
[#558](https://github.com/cloudbyday90/Classifarr/pull/558), exact head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`.

Applied its two-file client diff locally: `@types/node` 24.19.2 to 26.6.4 and
`undici-types` 7.24.6 to 8.9.0. Registry metadata and the lockfile showed no new
lifecycle scripts. Strict install, dependency-tree validation, zero-advisory npm
audit and both client typechecks passed. The tooling suite passed 40 of 41 checks;
the runtime-major contract correctly rejected Node 26 declarations for Node 24.

The exact trial was restored, dependencies reinstalled and tooling passed 41/41.
No final client manifest/lockfile diff remains. The remote PR was not merged,
closed or edited. This is a tested, rejected candidate, not an accepted update.

## Verification before image rehearsal

- Focused description/scheduler suite: 33 suites, 495 tests passed.
- Real PostgreSQL integration: two tests passed through repository, worker,
  recovery, scheduler, logger and persisted `error_log`. An actual unchanged
  15-second statement deadline and an explicit cancellation both produced
  `database_query_cancelled`/`57014`, with matching incident references and healthy
  subsequent queries. No provider was called. The isolated database was removed.
- Adversarial tests cover misleading provider SQL codes, primitive exceptions,
  hostile getters/clocks, duration bounds, invalid fields, nested stages, reused
  error objects, incident deduplication, recovery completion and cancellation.
- Backend typecheck, test/security lint, normal and production dependency analysis,
  static imports and ESM mock-shape checks passed.
- The first real-database assertion was too broad: it rejected the safe explanatory
  phrase "statement timeout". It now rejects actual raw PostgreSQL messages and SQL
  details; both cases pass without changing deadlines or runtime behavior.
- Full coverage initially caught the repository's changed ownership-review source
  fingerprint. Reviewed only that wrapper and its observation helper, retained
  unresolved analysis-debt status and updated its explicit review. No gate or
  policy was weakened.

Full backend coverage completed in 897.62 seconds: 1,793 suites passed, one failed;
56,180 tests passed, one skipped, one failed. The sole failure was the ownership
fingerprint above. Its entire test file subsequently passed 39/39 after the review
update; the standalone gate also passed with zero writes/connections and
`productionCompatible: false`. The full run was not repeated after this JSON-only
review correction; its coverage report covers the final runtime source.

Backend coverage: 89.71% lines/statements, 91.12% functions and 86.12% branches.
Fresh frontend coverage passed 457 files / 6,881 tests in 230.13 seconds:
87.25% statements, 89.02% lines, 86.88% functions and 81.01% branches. The combined
coverage ratchet passed against these current reports. No threshold or baseline
was lowered. Markdown lint checked 2,117 files with zero errors; the staged diff
passed secret scanning and whitespace checks. Copyright compliance passed.

## Local image rehearsal

Before replacement, retained the exact running image
`sha256:4284bf2291088d4d8932b209b962fdc4318b5763c07988e20fd75e04e5886e6c`
under local rollback tag `classifarr:pre-memory-f0eb62aa-6f89-4c2f-abde-1fc20d7a29ef`.
The private 75,615,824-byte PostgreSQL archive
`.tmp/pre-memory-fingerprint-f0eb62aa-6f89-4c2f-abde-1fc20d7a29ef.dump` passed checksum
comparison and `pg_restore --list`. This is archive-readability evidence, not a
completed restore drill. Neither it nor application data is committed.

The no-cache exact-source image, startup and schema-dump results will be appended
after the implementation commit is built. No release or tag is being created.

## Read-only pre-build reference

At 00:38 UTC on October 12 (October 11 locally), the test installation had 10 active
and covered libraries, 6,835 classified records, four unresolved identities (two
source-review and two retry-wait), zero pending text embeddings and 6,813 pending
image embeddings. No identity was approved or source metadata changed.

One comparison warning at 00:20:46 UTC reported eight missing vectors. Existing
automatic refresh logged eight embeddings committed and `up_to_date` at 00:21:06,
then 6,521 cache hits and zero remaining at 00:39:01. These events predate this
change's rebuilt image: they demonstrate existing recovery, not a new-fix result.
The diagnostic queries made zero writes/provider calls; the normal scheduler
continued its already-configured work.

## Next recommendation

Profile the corpus read on a disposable restored fixture under controlled load,
including database waits and concurrent worker/cache activity, before selecting a
query or memory fix. Keep all safeguards unchanged. The new stage, duration and
incident reference provide a useful comparison point, not proof of contention.
