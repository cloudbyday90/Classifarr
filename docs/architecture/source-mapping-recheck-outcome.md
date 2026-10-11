# Saved mapping recheck outcome

## Implemented — 2026-10-11

The [design](source-mapping-recheck-design.md) is implemented as a small ESM
status module and additive v1 API fields. Saved mappings now show last successful
application and distinguish waiting for current verification from an active
owned library scan that has captured the item. First verification, current
completion, recorded failure and revocation remain separate. Existing clients
can ignore the new fields; new clients accept older responses.

No identity approval, source/provider write, recovery attempt, schema migration,
ownership change or retry reset was added. Counts still depend on actual owned
completion. Read-only probes before replacement and at 10:51:05 UTC afterward
found seven applied mappings and four unresolved items across ten covered active
libraries, with zero probe writes or provider calls. The new historical dates
were present and all seven current mappings correctly had no recheck hint. Normal
startup sync finished across all ten libraries by 10:50:41 UTC; no manual sync or
new approval was submitted. This is local evidence, not a fresh Unraid diagnosis.

The [reconciliation proposal](source-identity-reconciliation-design.md) explains
the existing automatic recovery gate and why these approvals were required.
Extending automatic recovery to provable aliases is the next item; it is not
silently enabled here. Incomplete episode/group evidence still requires repair.

## Verification

- Focused status unit tests: 11 passed; client parser/component tests: 21 passed.
- Isolated PostgreSQL mapping tests: 30 passed. The new test reproduces successful
  apply followed by recapture, missing ledger linkage, active ownership, stale
  generation, wrong capture source/digest, disabled library/server, interrupted
  checks, owner release and successful reapplication. Status reads do not call
  providers or clear the unresolved observation. Initial fixture callback and
  cleanup errors were corrected before the successful run.
  A subsequent negative test reproduced a maintenance lock falsely looking like
  a sync against stale markers. The final predicate also requires an ingestion
  slot on the same session. A slot held by a different session cannot satisfy it.
- Chromium mapping flow: passed, including keyboard refresh, announced status,
  last-success timestamp, unchanged unresolved count, revocation and 320/390 px
  reflow. The mobile capture was visually inspected. Unrelated evaluation/retry
  endpoints use incomplete synthetic responses and log fixture-only unavailable
  messages; this is not live provider testing.
- Both workspace typechecks, lint, both Knip modes, 40 tooling tests, ESM checks,
  copyright and four policy gates passed. The final server-only correction also
  passed backend typechecking, scoped lint and both Knip modes. Markdown checked
  2,098 files with no errors.
- The ownership gate detected the changed list/revoke file. Review confirmed
  identical DML analysis and unchanged revocation fencing; only that file's
  source digest and review explanation were updated. The gate and its 39 focused
  tests then passed. No unrelated review classification was refreshed.
- Full frontend coverage: 454 files and 6,724 tests passed. Statements 87.18%,
  branches 80.80%, functions 86.78%, lines 88.97%.
- The first backend coverage run had 1,786 passing suites / 55,932 passing tests,
  one skipped test and one failed ownership-review test: it started before the
  reviewed fingerprint update. The focused gate passed afterward. The fresh full
  backend run on the final runtime source then passed all 1,787 suites and 55,933
  tests, with one skipped test. Statements/lines 89.70%, branches 86.07%, functions
  91.09%. The combined frontend/backend coverage ratchet passed without changing
  its baseline. The earlier failed run is not counted as a full pass.

## Random open PR trial

Fresh enumeration returned two open PRs (#555 and #556). The random draw selected
#556 at `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Its exact Node-types 26.6.4 /
undici-types 8.9.0 change was applied locally. Script-disabled and normal-policy
clean installs succeeded; the full dependency tree was valid and npm audit
reported zero vulnerabilities, including development dependencies.

The server typecheck failed at `discordDeliveryWriter.mjs:20`: Discord's Undici
FormData/File declarations do not match the Node-26 declarations. Tooling passed
39/40, rejecting the Node-major mismatch. The trial was restored exactly and a
normal clean install, typechecks and all 40 tooling tests passed on Node 24.
The PR was not merged; no dependency diff remains. Audit results describe this
2026-10-11 trial, not a permanent security guarantee.

## Local image, schema and replacement

Before replacing the local container, retained a checksum-verified, readable
57,668,043-byte database archive and an exact rollback image tag. The baseline
local image is `sha256:e2fddaf0190a92eb3e956abd69b0c738837c797cc19c996ac5bbc5a88084e1d5`.
Archive paths stay in ignored diagnostics. Do not modify Unraid, shared Plex or
Ollama, unrelated containers, or data volumes. No release/version bump.

The final no-cache Compose build used clean runtime source
`4d9c9f0f6f2ede73e9b5f6241576efc037391ab5` and produced local image
`sha256:cf90825e0952a7f0178bd53ef5f6bbcf79f0d5f67d25732daf135694f50679e1`.
The OCI revision matches that source. This is a local image identity, not a
published registry digest or a release attestation. The subsequent outcome-only
documentation commit does not change that tested runtime. Only the local Classifarr
service was replaced, with `--no-build --pull never --no-deps --force-recreate`.
It started at 10:47:54 UTC and became healthy, with zero restarts/OOM kills, the
existing read-only root filesystem and unchanged 2 GiB limit. `/health` returned
200 with the database connected; an unknown API path returned generic JSON 404.
`nosniff` and `SAMEORIGIN` headers remained present.

After the rebuild, an isolated fresh container from that exact image ran the
schema dump with networking disabled, 1 GiB memory / two CPU / 256 PID limits and
a uniquely owned empty data directory. The snapshot is unchanged through
`20261010_220000_source_catalog_mappings.sql`, including 22 seed migrations.
Fresh-database checks found no invented pending work, images or unresolved IDs.
The helper confirmed its container and temporary data directory were removed;
no live application data was removed.

A read-only live consumer probe found 6,832 classification rows, zero pending
text embeddings and 6,810 pending optional image embeddings. The existing image
backlog is not a mapping completion failure. At 10:51:57 UTC, one startup warning
from `LibraryComparisonContext` reported `cached_vectors_incomplete` /
`unavailable`; no startup ERROR rows were found. This batch does not claim to fix
that separate comparison warning.
