# Durable comparison incident recovery outcome

Date: 2026-10-09. No release, production recovery or shared-provider change.
See the [design, tradeoffs and official research](comparison-durable-recovery-design.md).

## Implemented

New version-2 incidents persist exact warning membership and private fingerprints
in one bounded database-local ledger. A subsequent process may resolve them only
after a current, matching, fully verified comparison refresh. Session ownership
encloses refresh and reporting; the same connection owns atomic warning/ledger
and resolution/ledger transactions. Lost ownership cannot commit late success.

The existing logger/UI still show warnings and resolved history. Recovery emits
an episode reference even when this process did not witness the original warning.
Original evidence and manual decisions are preserved. Historical uncorrelated
and version-1 warnings are not silently adopted. Pre-inspection and overflow
failures retain process-local tracking; they are not given guessed durable scope.

The recovery-change skill shaped the explicit completion condition, cancellation
and restart tests, bounded storage and isolated schema work. Memory safeguards,
vector completeness, import completion, ownership protections and routing are
unchanged. No new AI request or retry loop was introduced.

## Verification record

Initial targeted checks passed: 112 unit tests and 27 isolated PostgreSQL tests.
The latter exercised independent schedulers, matching/mismatched configuration
and model, disable/re-enable, stale readiness identity, atomic rollback, bounded
membership, manual resolution and actual lock-connection termination. An actual
child process committed a warning, was killed, and a separate child process
recovered that exact episode. No production data or provider was used.

Early checks caught a missing first-recovery informational receipt, an unnecessary
microtask affecting the existing scheduler test and a fixture listener leak.
Those were corrected. The ownership gate correctly required explicit reviews of
the new migration, shared database capability and generated schema; existing
unresolved writer debt remains unresolved, and no scanner was relaxed.

The first preliminary isolated schema dump refused an unrecorded migration.
The fixture was corrected to apply DDL and its migration record atomically before
dumping. The resulting diff contains only the empty ledger, its constraints and
the new migration entry, plus generation metadata. Both disposable schema
containers and their generated data directories were removed. The final image
must independently reproduce this schema before deployment verification is claimed.

The [repeat PR 556 trial](pr-556-node-types-outcome.md) reproduced its incompatible
Node 26 declaration failures. Restored Node 24 declarations pass typecheck and
all 40 dependency-tooling checks. No PR merge or dependency change was retained.

The final targeted PostgreSQL run passed all 30 tests, adding row-lock timeout
recovery, a storage-outage fallback and invalid metadata-version refusal.
The final full backend unit rerun passed all 1,763 suites: 54,886 tests passed,
one existing Windows platform skip, in 346.76 seconds. The skipped directory
fsync behavior was separately checked with the Linux candidate image below.
Server lint, typecheck, both Knip checks, ownership inventory, strict ESM checks,
Markdown (2,053 files), copyright and staged secret scan passed. The restored
server dependency tree is valid; the full server npm audit reported zero
vulnerabilities. These checks are not a claim that no vulnerability can exist.

## Local image evaluation

The no-cache build used the existing local Compose override, AVX2 selection and
clean source `698b8965b03bf32195e2b920a1c8ab506aaae872`. Image ID:
`sha256:b1847166cd419f19ecb4b1b8498f9d0a5e8a91d0c5617e74ab0cc5f8b71e0915`.
This outcome-only update does not change its runtime source.

Before replacement, the existing helper created and checksum/archive-verified
`.tmp/pre-memory-fingerprint-888fb687-01c3-44f7-8877-004f0d4dbb67.dump`
(76,635,885 bytes). The exact prior image
`sha256:3bdd05d25e3d9402afed7f674c61d2b0ed4aeb7ebbd49a65312a5fed2159ffaa`
is retained as `classifarr:pre-memory-888fb687-01c3-44f7-8877-004f0d4dbb67`.
The backup remains private and is not committed.

Only local `classifarr` was recreated, with existing mounts preserved, at
2026-10-10 00:35:59 UTC (October 9 locally). Container:
`16c23cd231d5dbeb035d5f52e573485229fd217285d56e790420144f73d3372e`.
At 00:36:43 UTC it was healthy, HTTP 200, zero restarts, `OOMKilled=false`.
Read-only SQL confirmed the migration and empty ledger; already healthy work
does not need a new incident. A subsequent query found no new warning/error
rows since startup. The old uncorrelated report remained unresolved with no
invented incident metadata.

One startup sample was 719 MiB of the unchanged 2 GiB limit. It does not prove
steady-state memory use, a leak fix or resource-soak acceptance. The Linux-only
directory-fsync/exclusive-copy check passed using the candidate's actual module
in a network-disabled, resource-bounded disposable container.

After rebuilding, `check-schema-snapshot-container.mjs --dump` independently
initialized the candidate in a disposable database, verified current migrations
and reproduced the committed schema without a diff. The schema container, its
data directory and the fsync fixture container were removed. These are local
checks, not a published-image or Unraid upgrade rehearsal. No production row,
container, provider setting or release was changed.

## Recommendation

Keep the database ledger for new provable incidents; keep older/unproven records
open for review. It trades one held database connection for restart continuity
and atomic ownership, without broad historical cleanup or weaker admission.

Next bounded dependency item: review Node 24 declarations 24.19.2, keeping the
runtime major fixed. Dotenv 18.0.7, Express 5.3.0 and Knip 6.41.0 were also observed
as available but were not adopted or certified by this trial. Keep runtime,
framework and tooling batches separate. Before release, retain the planned
sustained memory observation of the exact frozen image; startup samples are not
leak or capacity evidence.
