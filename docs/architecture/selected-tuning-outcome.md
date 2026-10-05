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

Full backend unit run: **1,690 suites, 52,303 tests passed**, one Windows skip,
273.312 seconds. After tightening the pool minimum to match normal admission's
two-connection requirement, final focused boundary/consumer checks passed:
**8 suites, 272 tests**. The skipped Linux directory-fsync behavior will be
exercised against the actual candidate image separately.

Server lint (zero warnings), typecheck, copyright, ownership review, both knip
checks, static ESM imports, mock-shape checks and Markdown passed. The staged
patch secret scan found no leaks. Five individually reviewed ownership entries
cover the validation/probe changes; no bulk baseline refresh. Client code and
dependencies did not change; no fresh client coverage/ratchet claim is made.

Exact-image rehearsal, schema dump and local replacement results will be recorded
after completion. Protected defaults still differ from compatible startup's
resource defaults; production selection remains deferred, not silently activated.

The first no-cache build used `7434fd144347b99ce16f73c59d401452433237c7`.
A separate disposable Linux probe showed that root without `SYS_PTRACE` cannot
read the application user's process environment, while that same user can.
The image-check fixture was corrected to inspect as the application identity;
no capability or production permission was added. The first image was not
deployed or treated as acceptance evidence. A new clean-source build follows.

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
