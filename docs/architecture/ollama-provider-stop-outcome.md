# Offline provider stop: verification outcome

Date: 2026-10-15. Implementation, image validation and local restart checks
complete. No release, Unraid/shared Ollama change or live recovery was performed.

## Implemented boundary

Separate modular ESM contract, bounded Docker client, boundary projection,
repository, controller and private CLI. Standalone schema v4 adds timestamped,
native UUIDv7 intent/observation tables. A committed intent precedes the sole
stop request; repeat stops are refused even after interruption. Original admission
state is never changed. Offline recovery inspection includes historical stop
references but still requires independent administrator verification.

No HTTP administration endpoint, automatic stop/restart, application migration,
default-routing change or Docker socket mount was added. Real GPU/model-volume
profiles are outside this deliberately narrow first implementation.

## Review and research

Official sources, alternatives and the recommendation stack are in the separate
[design](ollama-provider-stop-design.md); operator instructions are in the
[procedure](../operations/ollama-provider-stop.md).

GitHub MCP returned zero open Classifarr PRs on 2026-10-15. No PR could be randomly
selected or implemented; none was merged or created.

The ledger ownership review changes only its required standalone schema version
from 3 to 4. Its owner/provider/request fences and dedicated-session behavior
remain intact. New stop writes target only the standalone journal and require the
same cooperative advisory lock. This does not authorize concurrent application
ingestion or prove host-level lifecycle exclusivity.

## Verification record

Focused unit tests passed (120 tests), including
explicit non-root UID:GID checks and oversized identity rejection.
The initial integration run passed 148/149 tests; an existing recovery permission
test received ECONNRESET instead of its expected SQL permission error. The new
stop tests passed. An unchanged repeat passed all 149 tests across six suites;
the connection-reset cause was not established and is not claimed fixed.

After explicit rejection of non-RFC UUID variants was added, all **151 integration
tests across six suites** passed, including fresh/upgrade constraint parity.
All **1,849 backend suites passed: 58,842 tests passed, one existing skip**.
The first full-suite launch omitted the required local `OPENSSL_BIN` path and
failed 17 TLS-fixture setup tests; the corrected full rerun passed. No production
code was changed to hide either test-environment failure.

Typecheck, test/security lint, dependency checks (normal and production), ESM
import/mock-shape checks, migration naming/snapshot integrity, reviewed ownership
gate, Markdown and copyright checks passed. A bounded identity validator replaced
the new regex flagged by lint; its focused lint/tests passed. Ownership remains
`productionCompatible: false` because existing unresolved writer paths are not
authorized by this change. Secret scans passed. Frontend source/API is unchanged;
the production frontend build passed within Docker; frontend unit tests were not
rerun. This is scoped behavioral verification, not a repository-wide security audit.

The real Docker rehearsal passed a fixed stop against an owned idle container on
an internal isolated bridge, unchanged configuration/start pins, repeat refusal
and verified resource cleanup. It made no inference calls. Packaged CLI plus
PostgreSQL and synthetic Docker HTTP is a separate layer, not an actual daemon
and database end-to-end deployment claim.

## Final image and rehearsals

Clean-source no-cache Compose build:

- Source: `e6e36a2f7e8f6b949ecba7faac2556a62f369a86`.
- Image: `sha256:d58468e5327def5618d8bbdadd99aea4ad8d3aaa55160dca014e1a3423a7ab1f`.
- Windows host, Docker Desktop Linux Engine 29.8.2; pinned Node 24.21.0/npm 12.2.0.
- The earlier candidate was superseded by strict UUID constraints and rebuilt
  without cache; it was not deployed to local Compose.

The three existing runners passed against this exact image/source:

1. `run-ollama-gateway-rehearsal.mjs`: real isolated PostgreSQL, packaged CLI,
   private files, restricted grants, UUIDv7, successful one-shot stop and SIGKILL
   after dispatch with retained intent/attempts and repeat refusal. Existing
   gateway/recovery regression fixtures made 4 + 19 synthetic inference calls;
   provider-stop fixtures made zero inference calls.
2. `run-ollama-docker-boundary-rehearsal.mjs`: packaged read-only observer plus
   real owned daemon/container/network checks, stopped state and restart-pin
   refusal, and the new fixed stop with stable configuration/epoch and repeat
   refusal. No real model was loaded and no provider inference occurred.
3. `run-ollama-gateway-network-rehearsal.mjs`: verified TLS startup, one synthetic
   compute call, direct-provider access blocked from the application network,
   exact declared request binding and native UUIDv7.

All owned rehearsal containers, networks and temporary data were removed, and
the runners verified cleanup. Rehearsal compute was synthetic; no rehearsal
contacted shared Ollama or Unraid. Neither service was reconfigured or restarted.
These are local development-image exercises, not a published-release
upgrade drill, production GPU/storage validation or full lifecycle attestation.

## Local Compose and recovery point

Before local replacement, `data/backups/gateway-stop-before-20261015.dump` was
created and its 1,933-line `pg_restore --list` read successfully. SHA-256:
`C40AE506740E4D027CB43E569D9B7B4FBAA94D70729780CE208277BAECFCB708`.
This checks archive readability, not a restore drill. Existing backups and
rollback images are retained. Baseline local AI budget was `when_idle`, zero
daily calls/tokens/reservations, revision 2; no gateway schema was present in the
application database. The saved next-check timestamp was
`2026-10-09 16:50:11.617278-04`.

The prior local image is retained as
`classifarr-local-rollback:b34ba1ae1326534e32dd8a16364c48f70b32d724ecf802a527c3ff167dd3a21e`
pointing to `sha256:2b163ae65240da990e4534ad37e6079190db713e50c84d2a03e99322ae6d2954`.
Local replacement used the tested image with no build/pull or dependency restart.
Compose reported healthy, with zero restarts and no OOM. Health and UI returned
HTTP 200; unauthenticated `/api/libraries` returned 401. UID:GID remains 1000:1000,
root filesystem read-only, no-new-privileges enabled and memory capped at 2 GiB.
There are no gateway/routing environment variables or Docker socket mounts.
The AI budget values and next-check timestamp exactly match the baseline above,
and the application database still has no gateway schema. This is a startup and
configuration check, not a long-running resource/performance benchmark.

The final documentation commit follows the image's source commit; no packaged
runtime source changed after the final image was built and tested.

## Next opportunity

Design enforced dedicated-provider provisioning and actual transport identity
binding before enabling machine-authorized recovery. The current administrator
attestation cannot exclude competing host/root/Docker controllers or prove which
provider accepted historical inference. Keep shared Ollama and Unraid unchanged
until that deployment boundary and a suitable GPU/storage profile are reviewed.
