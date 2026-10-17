# Gateway catalog scheduling — outcome

Date: 2026-10-17. See the [design and research](gateway-catalog-scheduling-design.md).

## Delivered behavior

The explicitly optional archive worker can now schedule catalog captures without
an artificial unfinished inference-export job. New jobs use PostgreSQL UUIDv7,
retain the original shared three-attempt budget and persisted cooldowns, and
include a separately verifiable catalog-job table in version-6 archives. Legacy
version-5 archives retain their original interpretation.

The scheduling fingerprint excludes the catalog worker's own bookkeeping, so
successful publication does not trigger an endless backup loop. New catalogs
require the latest two verified inference bundles and all permanently protected
bundles. They retain the full historical SQL records, even when an old bundle is
no longer required. Old catalog roots continue pinning their recorded files until
two verified replacements permit retirement. Valid protection promotion is
monotonic and does not invalidate an older immutable file index.

Source/provider identity and policy are checked before pending-result
acknowledgment or rotation. Restricted roles, fixed-file operations, the combined
1 GiB storage budget and isolated restore verification remain mandatory. Inference
continues; no provider request, application inventory mutation, admin button,
protection expiry or automatic live-history purge was added.

The recovery-change workflow kept capture, verification and acknowledgment as
separate durable stages. The approved planning decisions kept retry exhaustion
visible instead of minting a new budget for maintenance-only changes.

## Verification

- Gateway unit suite: 482 tests across 23 suites passed.
- Final full gateway PostgreSQL suite: 307 tests across 17 suites passed,
  including the source/provider-identity regressions.
- Server/client type checks, backend test/security lint, both backend Knip modes,
  static-import and ESM mock-shape checks, copyright and Markdown checks passed.
- Inventory ownership review passed after reviewing precisely the changed
  verifier/restore sources and new catalog-job repository. Existing unresolved
  ownership debt remains recorded; no gate or budget was relaxed.
- The optional Compose overlay resolves to separate network-none, read-only-root,
  UID-1000 verifiers with dropped capabilities and no source credentials/socket.
- Staged secret scans passed. GitHub MCP returned no open PRs, so there was no
  eligible random PR to implement or merge.

The first clean, no-cache candidate was source
`35450ac11c239c9e8a2d9336440d49c2ab7d14bb`, image
`sha256:117f98185d20e2b8f1008321c85b7e26623457a463b0e9b183d1a93a68689949`.
Both native rehearsals passed against it:

- New scheduling: fresh/empty refusal to do unnecessary work, real packaged
  worker and restricted source/maintenance logins, initial capture plus second
  copy, delayed verification, recovery after registration-before-acknowledgment,
  repeated quiet assessments, exact restores and two-generation dependency
  handoff. Original attempts were `[2,3,2,3]`; inference attempts remained `1` for
  each distinct inference revision. Older files disappeared only after their last
  retained catalog pins were released. Historical rows remained present.
- Existing online archive suite: bounded private restore input, permissions,
  symlink/hardlink and cancellation refusals, low-space refusal, legacy receipt
  rejection, corruption/missing-file refusal, concurrent inference, v3/v4 rolling
  archives, v5 catalog restore and restart-safe catalog retirement. Each runner
  verified cleanup of its exact labeled containers, volumes and scratch data.

The final no-cache image includes the subsequent early identity guard, source
`b377e99bb939996bec986ce952f6c757a8520672`, image
`sha256:b72babb708a200dfe0d409fb7f69d0d7c9dd21a71eb6b6b1db4cdd64b039d4bd`.
The complete new scheduling/handoff rehearsal passed again against this exact
image, including verified cleanup. The ordinary legacy suite above ran on the
first candidate; the intervening runtime change only added the new coordinator's
early identity check. No archive format or legacy restore path changed afterward.

## Local deployment evaluation

Only the normal local Classifarr service was replaced using the no-build/no-pull
Compose path after the no-cache build and rehearsals. Container
`4c76f4ffadea2cda020ac84f142749f33140ad5e757deddddc33a2e1a147ce7e`
started at `2026-10-17T20:33:15.856316887Z` on the final image and became healthy,
without an OOM event. `/health` reported a connected database and the UI returned
HTTP 200. UID 1000, read-only root, no-new-privileges and the 2 GiB limit remain.
PostgreSQL remains 18.6. No optional gateway schema exists
in the normal database. Its capture budget remains revision 2, `when_idle`, zero
daily calls/tokens and reservations, with next check
`2026-10-09T20:50:11.617278Z` unchanged. The optional overlay was validated but not
activated against real gateway data.

The pre-replacement application backup is
`data/backups/catalog-scheduling-before-20261017-2025.dump`: 76,239,970 bytes,
mode 0600, SHA-256
`317581c98aa68c657437e4068f9f41a26415084fe153f5dcff5919d269787610`.
Its `pg_restore --list` check succeeded with 1,933 lines; it was not restored.
The previous image remains protected under the local rollback tag. Harmoniarr's
container ID and start time remained unchanged. No Unraid/Plex/shared-Ollama
configuration or lifecycle change, release, tag or PR merge was performed.

## Evidence limits and weak points

The scheduling rehearsal uses synthetic data and real PostgreSQL/dump/restore
processes. Its source container is limited to 2 GiB; each separate verifier is
limited to 1.5 GiB, one CPU and 64 PIDs with no network. This small fixture does
not establish the worker's maximum-size behavior at its deployed 256 MiB limit.

The test deliberately stops orchestration after registration, then runs a fresh
worker process. That is a durable-boundary cut, not a power-loss or SIGKILL test.
For the later daily-refresh scenario, only the pure scheduling observation is
advanced by one day and two prerequisite inference archives are admitted through
the existing repository. No durable attempt/deadline is reset. This is not proof
that a real daily interval or cooldown elapsed. SQL tests separately verify
cooldowns, reconnects, competing locks and uncertainty preservation.

Two copies in the same local store do not protect against host/disk loss.
Interrupted exports remain blocked rather than guessed safe. Permanently
protected history can eventually fill storage; exhaustion refuses further work.
The full application coverage suite, ARM64, maximum-sized catalogs, off-host
recovery and published-release upgrades were not qualified by these tests.

## Next recommendation

Qualify the automatic catalog flow at the deployed worker limits with large
maintenance histories, concurrent inference, storage pressure and observed
process termination at admission/publication/acknowledgment boundaries. Measure
memory and completion time, verify preserved attempts and exact cleanup, and
address measured bottlenecks before enabling this optional flow on a real gateway.
Do not introduce protection expiry, broader retries or a new purge button as a
substitute for that evidence.
