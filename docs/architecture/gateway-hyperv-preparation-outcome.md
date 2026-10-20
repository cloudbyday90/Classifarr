# Gateway Hyper-V preparation outcome

## Delivery

Preparation-only implementation on main, based on `99e9a33bdf5dffd9f21d24142794b803609d5ef1`.
No VM was provisioned or started. No permission, networking, normal application,
Unraid or shared Ollama changes were made. No study or release was run.

Delivered the [fixed profile](../../scripts/fixtures/gateway-hyperv-profile.json),
[administrator guide](../operations/gateway-hyperv-setup.md) and modular read-only
[CLI](../../scripts/check-gateway-vm-preparation.mjs). The
[design](gateway-hyperv-preparation-design.md) records official October 2026
research, alternatives, limitations and the recommended stack.

The grill-me workflow established the preparation-only boundary before coding.
Recovery/evidence guidance kept matching prerequisites distinct from actual
qualification: every output retains `studyReady: false`. Queries do not request
elevation, retry, provision infrastructure, import a passed receipt or start work.
Review also disabled Git filesystem-monitor hooks and optional index refreshes,
and removed case-insensitive Docker environment overrides for local-only probes.
PowerShell strict mode prevents absent properties from becoming false/zero defaults.

## Verification

Focused tests passed all 14 cases, including real oversized-output rejection and
termination of a stalled child at the ten-second command deadline. Synthetic
PowerShell/Linux results cover matching and wrong allocations/identities/devices, malformed/missing/extra
observations, injection attempts, privacy, explicit local socket selection and
unavailable states. Real CLI profile mode matched and retained `studyReady: false`.
Real guest mode on Windows returned unavailable/nonzero rather than pretending
Windows is the requested Linux guest.

Windows preflight passed copyright, unchanged ownership review and both dependency
checks. Its gateway suite passed 163 of 164 tests with one disclosed Windows
symlink-permission skip (before the additional real timeout case). Full lint,
server/client type checks and static-import checks passed. Markdown validation
passed 2317 files with zero errors.

No actual guest was available for qualification, and no administrator VM/switch GUID was
provided. The positive Hyper-V path is unit-tested only, not verified against a
provisioned target. Planning observed denied Hyper-V access under the current
account; no escalation or invented target GUID was used for a live check.

### No-cache image-only evaluation

Previously evaluated code/test subject: `5ad7ca4b08656a70e237d8296486da2947db550a`, clean checkout.
The protected Compose build completed with `--no-cache --require-provenance`;
the normal container was **not** replaced. Local `classifarr:archive-binding`:

| Identity | Value |
| --- | --- |
| Local image/index ID | `sha256:a95648409ebc83e486a8a2b84547a7e63444d537a2c18293b9f6fbc459ea955f` |
| Exported image manifest | `sha256:8abd07bbc2b8f23c77bc9920950a9e618217a0c8801b1859bfc6a3fbf1cde2d0` |
| Exported config | `sha256:7d3983f4e24320f53ec0e54a684bfb61169655e6911f9f1e709ff12c5f4abb37` |
| Committed tooling bundle SHA-256 | `b92ccc70aef97eeb7e66e702b830509b5ab721c7c29e13e55afe644f08bfb7d7` |

These are local build identities, not published registry verification or signed
source attestation. A final documentation-only follow-up records this evidence.

All **165 gateway tooling tests passed**, zero skips, in that exact Linux/amd64
image using the matching committed tooling bundle in a separate `/work` tmpfs.
The bundle was not mounted over application source/dependencies. The native test
container had no network or Docker socket, read-only root, UID/GID 1000, all
capabilities dropped, no-new-privileges, 512 MiB with no extra swap, one CPU and
64 PIDs. Its exact name `classifarr-hyperv-tooling-5ad7ca4b0` was absent before
creation and after `--rm` cleanup. No archive workload, real inference, database
fixture or sustained study was started; native unit tests are not VM qualification.

Normal Classifarr retained container
`560a828dc2123f066acfee0d309731b9a405a7a086065ddf7310a49ca6830a2e`,
start `2026-10-20T15:56:46.339240429Z`, and image
`sha256:82a6025389df3ebfddb4ff47f4ee7f375cd7281e0d66b8b903c0acd733154baa`.
After evaluation it remained healthy, zero restarts/OOM kills, and `/health`,
`/ready`, `/` each returned HTTP 200. No new deployment or upgrade claim is made.

## Open PR

MCP re-enumeration on 2026-10-20 returned only
[PR #568](https://github.com/cloudbyday90/Classifarr/pull/568).
Its ESLint 10.13.0 update is already present in both server manifest and lockfile.
It was not reapplied, merged, closed or presented as a new implementation here.

## Next item

Have an authorized administrator prepare and hand off the reviewed guest, then
qualify its actual image/resources and design bounded Windows **and** guest
interference checks. Do not resume the four-arm comparison until those gates and
a new quiet window are verified. A separate Docker engine removes the observed
container-lifecycle coupling, not shared physical CPU/storage contention.
