# On-demand study VM outcome

Date: 20 October 2026. Code/test subject:
`d190b5d79f1a84088e6228f73c3bf8bb8e258015` on main.
See the [design, alternatives and safeguards](on-demand-study-vm-design.md).

## Delivered boundary

Added separate ESM contract, lifecycle and simulation modules with a thin
`check-gateway-vm-job-lifecycle.mjs --simulate` entry point. The model binds a
UUIDv7 job/owner to an exact VM/configuration and boot observation, refuses
adoption, preserves job outcomes, requires verified drain/cleanup and a final
identity check, and models graceful shutdown followed by confirmed off.

Cancellation does not establish quiescence. Repeated cancellation cannot renew
deadlines. Foreign/replayed observations, ownership loss, unexpected power/boot
changes, unavailable clocks, timeouts and incomplete cleanup fail closed without
forced shutdown or automatic retry. Outputs omit private binding identifiers.

This is **simulation-only**. No real power adapter, SSH connection, interprocess
ownership lock, guest admission fence or autonomous watchdog was added. Every
result retains `liveOperationsEnabled: false` and `studyReady: false`. Real VM
creation, host-boot settings and shutdown integration remain administrator
handoff prerequisites, not work performed by this change. No new database/table
was created. Fixed UUIDv7 values are explicitly fictional simulation identities.

## Verification and exact local image

All 14 focused lifecycle tests passed. Native Node coverage reported 100% lines,
branches and functions for both the contract and lifecycle modules. The fixed
six-scenario CLI rehearsal matched. Its live/proof/power options are rejected.

Final Windows `npm run test:ci:preflight` passed copyright, unchanged inventory
ownership review and both dependency checks. Gateway tooling passed 178 of 179
tests, with the existing Windows symlink-permission skip; that case passed in
the native Linux run below. Full lint, server/client types, static-import,
migration naming and schema snapshot integrity checks also passed.

From the clean subject checkout, the protected Compose build completed with
`--no-cache --require-provenance --protect-running-image classifarr`, using the
local image override. It did not replace the normal container.

| Local artifact | Identity |
| --- | --- |
| Image/index | `sha256:3e2ebf5fda5bfda3d13ad5a00399a6dd2d72304793526dab33870bba99ee5bc6` |
| Exported manifest | `sha256:668a3cbf74b2b765125f69f6c6e43886458135d8896d2986ee697a9f23f60dc5` |
| Exported config | `sha256:9fc68dab7dcb638dc7901d9b14414178956e3aa07ac75bca8fb87621769dbf5e` |
| Committed tooling tar SHA-256 | `54e6b72397329e9b8972b5e8a493b087ea04bd6d1ac651f19a4f6bd77eb82989` |

All **179 gateway tooling tests passed with zero skips** in that Linux/amd64
image. The runner verified the input tar digest before extraction into `/work`,
not over application source or dependencies. It had no network, Docker socket,
credentials or host data, a read-only root, UID/GID 1000, all capabilities dropped,
no-new-privileges, 512 MiB/no extra swap, one CPU, 64 PIDs and bounded tmpfs mounts.
The exact owned container `classifarr-on-demand-vm-d190b5d79` was absent before
creation and after automatic cleanup. No database fixture, inference workload,
archive job or sustained comparison ran. These are native unit tests, not guest
qualification, application-upgrade proof or published registry verification.

Normal Classifarr retained container
`560a828dc2123f066acfee0d309731b9a405a7a086065ddf7310a49ca6830a2e`,
start `2026-10-20T15:56:46.339240429Z` and image
`sha256:82a6025389df3ebfddb4ff47f4ee7f375cd7281e0d66b8b903c0acd733154baa`.
After evaluation it was healthy with zero restarts/OOM kills; `/health`, `/ready`
and `/` each returned HTTP 200. Unraid and shared Ollama were untouched.

## Next item

Obtain the administrator-reviewed VM/switch and SSH host-key handoff. Then
integrate trusted, job-owned host/guest execution with durable ownership,
admission fencing, independently verified drain and deadline enforcement. Verify
no host-boot auto-start and guest shutdown integration. Bind guest jobs to their
local Docker daemon and qualify actual resources/image before dual Windows/guest
interference checks or another measured comparison. The VM should be off between
jobs; uncertainty must be reported instead of forcing it off to reclaim memory.

The final follow-up changes documentation only; the evaluated code and local
image remain bound to the subject revision above. No release was created.
