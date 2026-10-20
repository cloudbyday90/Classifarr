# Sustained archiving on/off comparison — outcome

2026-10-20. Implementation and native preparation passed. A subsequently
coordinated four-arm attempt **stopped after the first off arm** because the host
lifecycle fingerprint changed. Baseline correctness and cleanup passed; timing
is inconclusive. Arms 2–4 were not started, and no automatic retry was launched.
Neither the preparation regression nor this partial attempt is a completed
archiving on/off comparison.

## Initial subject and implementation

Source: `45c30285f8d46731fa923ada9179eae64268fe32`, clean main checkout for build
and rehearsals. No-cache smart Compose build with required local provenance:

- Local image ID: `sha256:82a6025389df3ebfddb4ff47f4ee7f375cd7281e0d66b8b903c0acd733154baa`.
- Image config digest: `sha256:c8f97db751f6f7d524e638b7d4daf876daddf6257c31073ac7645079ebe92fec`.
- These are local Docker identities, not published registry acceptance or signed
  provenance claims. Later documentation commits are not the image source.

Added fixed off/on/on/off orchestration with identical 30-minute arrival plans
and 60-second idle observations, positive baseline absence checks, bounded
minute/overall tail summaries, independently validated arm projections and
cleanup-before-result ordering. Shared orchestration and host-boundary observation
are small ESM modules; existing regression entry points remain available.
Unexpected input profiles, arguments, evidence and overrides fail closed.

The [design](gateway-sustained-comparison-design.md) records official sources,
alternatives, tradeoffs and the recommended stack. No production algorithm,
scheduler, retention policy, retry budget, resource limit, database schema or
admin control changed. Existing UUIDv7 checks remain mandatory.

## Completed verification

- CI preflight passed: copyright, inventory ownership, development/production
  dependency analysis and gateway tooling. No ownership baseline was refreshed.
- Full server/client lint, types, static-import and Markdown checks passed.
- Final Windows gateway tooling: 151 tests, 150 passed, one platform symlink skip.
- Exact-image Linux tooling: all 151 passed, zero skips, including native symlink
  and full-size bootstrap argument rejection checks.
- Exact-image default archive regression passed real restricted restores,
  candidate-page coverage, tamper/corruption refusal, legacy receipt rejection,
  mixed-format rotation, crash/resume and unchanged history/attempt checks.
  Owned cleanup passed; zero provider calls in that regression.
- Exact-image legacy eight-minute inference regression passed: 480 foreground
  successes, 48 expected busy responses, one upstream request at a time, 480
  unique fingerprints and UUIDv7 bindings, two verified catalogs at attempt one,
  real dump/restore overlap and zero cleanup operations. Owned cleanup passed.

The inference regression ran 15:46:48.980–15:54:48.283 UTC (11:46–11:54 Eastern).
Its archive-phase p95 was 1,266.916 ms and max 1,283.859 ms. This is preparation
under the older, compressible-history regression profile, not the varied-history
comparison, not a quiet-window timing result, and not a production latency gate.

Observed lifetime memory charges in this regression:

| Process/container | Peak bytes | Limit bytes |
| --- | ---: | ---: |
| Source | 375,857,152 | 2,147,483,648 |
| Scheduled archiver | 268,435,456 | 268,435,456 |
| Scheduled catalog verifier | 694,034,432 | 1,610,612,736 |

Recorded memory/PID events were zero. The archiver peak at its limit does **not**
establish comfortable headroom or demonstrate that fewer checks are safe.
No caches were flushed, limits raised or clocks changed.

All generated study containers, volumes and disposable source data were verified
removed. Native tooling's `--rm` container was absent afterward. Only exact owned
fixture resources were removed; ignored logs/bundles, backups, rollback images
and unrelated containers were retained.

## Local Compose evaluation

Before replacement, created private mode-0600 backup
`data/backups/gateway-sustained-20261020-45c30285.dump`: 76,210,569 bytes, SHA-256
`281a1901c7f3d398994ef7aa990db3b96bc6aad2820113860f904dfe6e0cdc30`.
`pg_restore --list` passed; a full application-backup restore is not claimed.

Recreated only local Classifarr with the tested image, without another build or
pull. Container `560a828dc2123f066acfee0d309731b9a405a7a086065ddf7310a49ca6830a2e`
started at 15:56:46.339 UTC; healthy, read-only root, 2 GiB limit, zero restarts
and no OOM. `/health`, `/ready` and `/` returned HTTP 200. Node 24.21.0,
PostgreSQL 18.6 and pgvector 0.8.7 remained unchanged.

Normal appdata had zero gateway schemas before and after replacement. Capture
budget revision 2, zero daily/reserved calls and tokens, and the existing
`next_check_at` remained unchanged. Gateway services were not enabled. No Unraid,
Plex or shared Ollama changes were made.

Rollback retained:
`classifarr-local-rollback:3d79a440d0103d6f66cd5d5840b232b5e59e515d45330b1cde7a6ef02bc164d3`
→ `sha256:b4fe24676e4b60ac75bf7042e4ac28a684393297f1c0eec3997666d1b5b4092a`.

## PR and delivery boundaries

MCP enumerated current open PRs and still returned only
[PR #568](https://github.com/cloudbyday90/Classifarr/pull/568). Its ESLint 10.13.0
update was already adopted on main with reviewed parser metadata. There was no
new eligible PR delta to implement; no PR was merged or otherwise changed.
No version bump, tag or release was created.

## Coordinated measured attempt

After explicit quiet-window coordination, rebuilt without cache from clean main
revision `7ee7a546ee242336dd44816637a0054b2355a66f`. This differs from the initial
source only by the preparation-outcome document. Exact measured subject:

- Local image ID: `sha256:c34366f1e2e67efc4fa2cdf95f8a7362f6a4e6209c45779f01f127ee534af5c5`.
- Image config digest: `sha256:66f4815f1c2d52a6065b2009acf744e51f0b91417b48c1e2446b773c7be6a90a`.
- All 151 Linux tooling tests passed again, with zero skips. The real default
  archive/restore regression and its owned cleanup also passed on this image.
- All seven GitHub workflows for this source revision subsequently passed.

The quiet window began around 16:21 UTC (12:21 Eastern). Arm 1's 30-minute traffic
plus 60-second idle observations ran 16:23:27.656–16:54:27.784 UTC. The runner
validated its result and exact-owned cleanup before taking the next host snapshot.

Baseline correctness passed:

- 1,980 offered arrivals: 1,800 foreground successes, 180 expected busy responses,
  no failed/dropped/unexpected responses, and provider concurrency one.
- 1,800 distinct fingerprints and UUIDv7 bindings; 1,801 total admission attempts
  and bindings including the prerequisite; no active request remained.
- All 3,000 failed historical rows preserved: 233,849,332 bytes, SHA-256
  `6d33dca8af135d7b81f7c256ea71185c627e7be2d4e20b9f4d599b2079216f41`.
- Zero measured archive workers, catalog jobs/roots, dump windows and cleanup
  operations. All managed archive connection/transaction observations were zero.
- 1,860 resource/database samples, zero failed samples, mandatory coverage 100%,
  maximum sample gap 1,110.728 ms; all 60 idle samples showed zero managed/catalog
  connections. Optional device-I/O and PSI fields were unavailable, not zero.
- Source lifetime peak 612,450,304 bytes within 2 GiB; sampled current-memory peak
  439,390,208 bytes. Recorded memory/PID events were zero. These are different
  observation populations, not interchangeable memory measurements.

Retained latency observations below are **contaminated diagnostic observations**,
not a quiet baseline, on/off difference or production acceptance result:

| Population | p50 ms | p95 ms | p99 ms | Max ms |
| --- | ---: | ---: | ---: | ---: |
| Foreground, 1,800 requests | 769.632 | 1,267.110 | 1,279.959 | 1,377.082 |
| Expected busy, 180 requests | 1.340 | 2.303 | 3.634 | 4.775 |
| Generator lateness, 1,980 arrivals | 0 | 0.657 | 0.931 | 1.037 |
| Pre-claim, 1,800 admissions | 3.257 | 608.591 | 617.583 | 717.074 |
| SQL claim, 1,800 admissions | 1.908 | 3.697 | 9.891 | 90.535 |

All thirty minute bins had exactly 60 foreground and six busy observations.
Minute foreground p95 ranged 1,262.063–1,305.601 ms. The worst foreground request
was synthetic request 2, second installation, offered at 50 ms in minute zero;
its latency was 1,377.082 ms, pre-claim 717.074 ms, SQL claim 1.969 ms and generator
lateness zero. Overall quantiles were not calculated by averaging minute quantiles.

### Why the runner stopped

Both endpoint snapshots counted 18 containers, but their lifecycle fingerprints
changed from `99fbf553a0c4e45012ca2220aa5e059be62f786d508ab7b86908d6334b45d641`
to `5c5fa5760e57388a668d7ce96c30fa5912cbb64b6454ceb04bc347b9ad160b3a`.
Container count alone would have missed this interference.

Read-only inspection afterward found `harmoniarr-walkthrough-harmoniarr-1` was
created at 16:31:40.416 UTC and started at 16:31:42.127 UTC (12:31 Eastern), during
measurement. Its current ID was
`5aeb070e74925c614f56ad2c604293535e38223ccb08868a9f594089d5a31088`.
The same named application was already running before the window; this is direct
evidence of container replacement during the run, not proof of which command or
operator caused it. The bounded event-history query returned no matching records,
so attribution beyond observed lifecycle state is unavailable.

The CLI exited 1 with `gateway_host_state_changed`, retained the completed arm,
marked timing inconclusive and did not start an on arm or reset the baseline.
No retries, foreign cleanup, broad exclusions or relaxed assertions were used.
Study-owned containers, volumes and disposable database files were verified gone;
only synthetic fixture resources were removed. Logs and ignored bundles remain.
The full local log `.tmp/sustained-comparison-7ee7a546.log` has SHA-256
`9773bbaf61ae5f6168343dd802d7dcfe7cd3262081fdc14deeb6d93eea945293`.

Local Classifarr remained on the previously evaluated image/container: no restart,
replacement, OOM or gateway activation during this attempt. Post-attempt health,
readiness and UI responses were HTTP 200; normal-appdata capture budget and zero gateway
schemas were unchanged. The newly built image was used only in disposable tests.
Unraid, Plex and shared Ollama remained untouched. The quiet window ended after
the failed boundary check; this attempt is not still running.

## Next step

Coordinate a new roughly 2½-hour window that also prevents unrelated application
container replacements, or select a separate test host, then run all four arms
from the beginning. Do not splice this contaminated off arm into a later run.
Normal applications may keep running without deployments. After a
documentation-only commit, rebuild from the clean current revision before using
the source-bound CLI; do not bypass the clean-checkout/source identity checks or
substitute earlier-image results.

Keep the agreed boundary observations, stop-after-current-arm-cleanup and no
automatic retry policy. Require 7,200 foreground successes, 720 expected busy
responses, matching plans/counts, verified archive progress in both on arms,
positive archive absence in both off arms, unchanged history, settled connection
disappearance and verified cleanup before reporting comparison completion.

Until then there is no on/off latency difference or varied-history co-load result
or basis for reducing repeated archive checks to report. Even a completed study
would remain exploratory synthetic evidence: two repetitions per treatment,
endpoint-only host observations and minute bins do not establish real-LLM
capacity, physical-I/O causality or a production latency guarantee.
