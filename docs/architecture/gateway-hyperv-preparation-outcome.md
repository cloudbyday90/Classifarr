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
passed 2317 files with zero errors. Image-only no-cache build/native tooling
results will be recorded separately; no application replacement is planned.

No actual guest exists for qualification, and no administrator VM/switch GUID was
provided. The positive Hyper-V path is unit-tested only, not verified against a
provisioned target. Planning observed denied Hyper-V access under the current
account; no escalation or invented target GUID was used for a live check.

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
