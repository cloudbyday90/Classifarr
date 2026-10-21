# Study VM capture follow-up

## Failure and cause

On 21 October 2026, the administrator's first creator invocation returned
`review_required`, stage `capture`, with `mutationAttempted: true`. That flag
means writes cannot be excluded, not that a VM/disk definitely exists. No retry,
resource deletion, adoption or power operation was performed afterward.

A strictly read-only reproduction imported the actual Windows Hyper-V and
Storage modules through the production bootstrap/environment. PowerShell exited
successfully with valid JSON, but also emitted 392 bytes of CLIXML **progress**
on stderr. The creator intentionally rejects nonempty stderr, so ordinary module
loading hid the probe's semantic result. This reproduces a capture defect; it
does not recover or prove the lost result of the administrator's write attempt.

The inner script's local progress preference was too late/narrow for outer
session module auto-loading. Setting `-OutputFormat Text` did not fix it. Setting
only the child bootstrap's global progress preference before input parsing
removed progress: the same read-only probe returned valid JSON and zero stderr
bytes. An alternative string `-Command` bootstrap also avoided this output, but
was not selected: retaining the existing encoded transport is the smaller fix.

The [design](study-vm-creation-design.md) records the chosen contract and official
sources, retrieved through the search MCP. No general stderr/CLIXML stripping,
XML deserialization, error suppression or parent session preference change was
introduced. Native warnings/errors still produce an uncertain result.

## Verification and limitations

A new real-module regression failed before the fix (392 stderr bytes rather
than zero), then passed with the bootstrap change. It launches the production
bootstrap with production environment filtering, but replaces the **entire**
input with a read-only module probe; no provisioning script is sent or executed.
This closes the earlier mock-only module-import gap. Another native test checks
that real warning/error streams still refuse success-shaped JSON.

All 11 creator tests passed on Windows, with no skips. The full gateway preflight
passed 204 of 206 tests with the two existing Windows symlink privilege skips;
copyright, both dependency checks and inventory ownership review passed without
unreviewed static drift. Static-import and Markdown checks passed (2326 documents,
zero errors). The temporary read-only review query also passed actual PowerShell
syntax parsing and a no-mutation-command check, without executing a host query.

The fix has not been image-evaluated or deployed. A further image build is
deferred while the administrator write attempt remains uncertain; the earlier
creator image evaluation predates this fix. The state left by that invocation
remains unverified pending the administrator's separate bounded read-only
VM/folder observation. No successful creation, safe rerun, guest readiness or
rollback is claimed. No normal application, Unraid or shared Ollama was changed.

## Next step

Inspect the exact named VM and approved child paths without modifying anything.
Retain partial resources and review their provenance/configuration if present.
An absence observation alone is not proof that an uncertain service-side writer
has stopped; do not automatically rerun creation. Resolve that uncertainty before
continuing with the already-planned installer and guest preparation.
