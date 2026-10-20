# Sustained archiving on/off comparison — preparation outcome

2026-10-20. Implementation and native preparation passed; **the four-arm measured
comparison has not started**. Another project's temporary test containers were
still cycling on this Docker host during preparation. A fresh coordinated quiet
window is pending; no automatic attempt or retry was launched. Do not interpret
the preparation regression as an archiving on/off comparison.

## Subject and implementation

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

## Next step

Coordinate roughly 2½ hours without unrelated builds, tests or deployments while
normal applications keep running, then run all four balanced arms. After a
documentation-only commit, rebuild from the clean current revision before using
the source-bound CLI; do not bypass the clean-checkout/source identity checks or
substitute earlier-image results.

Keep the agreed boundary observations, stop-after-current-arm-cleanup and no
automatic retry policy. Require 7,200 foreground successes, 720 expected busy
responses, matching plans/counts, verified archive progress in both on arms,
positive archive absence in both off arms, unchanged history, settled connection
disappearance and verified cleanup before reporting comparison completion.

Until then there is no on/off latency difference, varied-history co-load result
or basis for reducing repeated archive checks to report. Even a completed study
would remain exploratory synthetic evidence: two repetitions per treatment,
endpoint-only host observations and minute bins do not establish real-LLM
capacity, physical-I/O causality or a production latency guarantee.
