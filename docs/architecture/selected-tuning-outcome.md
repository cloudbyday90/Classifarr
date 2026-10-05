# Protected operator tuning outcome

Date: 2026-10-05. See [design, alternatives and official sources](selected-tuning-design.md).

## Implemented

The protected application profile now preserves bounded retention, Ollama/OMDb
recovery timing, pgvector recall, and database-pool/query tuning. Explicit zero
queue retention and disabled refresh-token cleanup survive unchanged. Existing
DB/JSON/environment precedence remains with the original consumers. Small ESM
validation and image-probe modules keep this out of the startup singleton.

Database identity and privileged maintenance configuration stay fixed. Invalid
or unsupported input refuses startup before imports, without raw values in errors.
A regression test accounts for every documented `.env.example` setting, including
sixteen deployment/privileged settings that cannot enter the application profile.
It does not claim to inventory every internal environment read.

Compatible Compose/Unraid startup is unchanged. No unattended legacy takeover,
key reset, live Unraid action, version bump or release is included. The recovery
skill kept configuration preservation separate from permission to recover data.

## Validation

Final repeated backend unit run: **1,690 suites, 52,303 tests passed**, one
Windows skip, 272.254 seconds. Final focused boundary/consumer checks passed:
**8 suites, 272 tests**, including the pool minimum matching normal admission's
two-connection requirement. The Linux directory-fsync copy, source preservation
and overwrite-refusal assertions passed separately inside the actual candidate
image; this does not mean the skipped Windows Jest case itself ran.

Server lint (zero warnings), typecheck, copyright, ownership review, both knip
checks, static ESM imports, mock-shape checks and Markdown passed. The staged
patch secret scan found no leaks. Five individually reviewed ownership entries
cover the validation/probe changes; no bulk baseline refresh. The gate reports
19 owned, 285 separately coordinated and 502 unresolved paths; passing the gate
does not make those unresolved writers production-compatible. Client code and
dependencies did not change; no fresh client coverage/ratchet claim is made.

Protected defaults still differ from compatible startup's resource defaults;
production selection remains deferred, not silently activated.

The first no-cache build used `7434fd144347b99ce16f73c59d401452433237c7`.
A separate disposable Linux probe showed that root without `SYS_PTRACE` cannot
read the application user's process environment, while that same user can.
The image-check fixture was corrected to inspect as the application identity;
no capability or production permission was added. The first image was not
deployed or treated as acceptance evidence.

## Image and schema evidence

Final clean-source no-cache build: `1f81f96ff07a0048bc181a81fd2a4f1bfc13eedf`.
Local image ID:
`sha256:41e34bb732e2e4ebac2e96be30f85ea674b838cf8d10faece57c7973786e60b0`.
The OCI revision matches. This is local linux/amd64 AVX2 evidence, not a published
registry digest or multi-platform release attestation.

All **12 core image scenarios passed** in 178.968 seconds. The real application
child retained all thirty synthetic tuning settings, including zero/false and an
empty optional vector cap; its observed pool stayed within the configured four
connections. Privileged maintenance remained excluded during normal runtime.
Existing authenticated key decryption, runtime JSON precedence, unchanged file
bytes, invalid-file refusals, restore quarantine, interruption/restart and source
database preservation checks passed. These are isolated same-image synthetic
fixtures, not a published-old-image upgrade or a real provider/retention workload.

After rebuilding, the existing schema dump implementation ran against isolated,
network-disabled PostgreSQL 18 from this image. Fresh load/dump/load/dump had
zero drift; `database/schema/current.sql` is unchanged and there is no migration.
The exact owned schema container and Linux fsync container were removed.

Saved-profile rehearsals passed for non-root 1000:1000, custom 2345:2345 and
Unraid-style 99:100. Image immutability, on-demand queue/image workers and clean
stop/restart with preserved data passed. Stops under the unchanged ten-second
host timeout took 2.963, 2.804 and 2.875 seconds respectively (including
verification). The standard profile also passed application exit, database loss
and forced-host-kill recovery; forced kill is not a clean shutdown.

Cleanup passed. A separate inventory confirmed no containers, volumes or networks
remain for `classifarr-isolation-drill-4da8aeb12cc90f96468da39cf549373d`. Only
the randomly owned synthetic test resources were removed; installation volumes
and the caller's image were preserved.

## Local replacement

Recreated only the existing `classifarr` service in local Docker Desktop with the
tested image (`up --no-build --force-recreate --wait`), preserving volumes. Image
identity matches, health is healthy, restart count is zero and no OOM occurred.
Live Unraid was not accessed. At 33 seconds after PostgreSQL startup, the scoped
database log query found no WARN/ERROR records; memory was 330.9 MiB of 2 GiB,
CPU 0.51%, and 48 PIDs. At 146 seconds, memory was 410.9 MiB, CPU 2.84% and
41 PIDs; health remained healthy with no restart/OOM. There were zero ERROR
records and one expected `mediaSync` warning, `legacy_owner_unknown` for Movies
(5). The rebuild did not resolve that separate ownership condition.

The process sample found one application, one supervisor and zero active
compatible/selected maintenance workers. HTTP health returned 200. Read-only
database checks found Family (4) complete at 866/866 with no ownerless running
records, and Movies (5) still with six. No records were reset or rewritten by
the diagnostic checks.

The saved local profile remains UID/GID 1000:1000 and read-only, with its existing
2 GiB memory limit and no CPU quota/PID ceiling. No resource limits were silently
changed. These short samples do not establish sustained-load or leak behavior.

[PR 556](node-types-pr-556-outcome.md) was selected randomly from current open
PRs 555/556, applied locally and rejected by the Node-major policy (7/8 candidate
versus 8/8 baseline). Removed only the trial change; all 30 tooling checks passed.
No candidate install or PR merge occurred; Node 24 declarations remain unchanged.

## Next recommendation

Add the restricted restore HTTP handoff and validate deployment-owned inputs
before selecting protected production startup. Then prove published-image upgrade
compatibility and database-enforced ingestion isolation before unattended recovery.
Preserving settings is necessary preparation, not evidence that Movies ownership
has been repaired or that all saved deployment templates can be converted today.
