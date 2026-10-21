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

At this capture-fix checkpoint, the fix had not been image-evaluated or deployed;
the earlier creator image evaluation predates it. A build was deferred while the
administrator write attempt remained uncertain. No successful creation, guest
readiness or rollback was claimed. No normal application, Unraid or shared
Ollama was changed.

Subsequent administrator read-only review observed zero named VMs and absent
approved child directories/disk. After review of the completed caller and command
ordering, the user ran one manual attempt with the capture fix. This returned
the actual semantic result: `blocked`, stage `permissions`,
`acl_review_required`, `mutationAttempted: false`. A separate read-only ACL
diagnostic identified the same narrow parent create ACE on both targets. This
does not reconstruct the original lost response, but the latest refusal is
known to precede resource writes. See the separate
[private-directory outcome](study-vm-directory-outcome.md) for the approved
follow-up; do not reinterpret absence alone as permission for arbitrary retries.

## Next step

The directory-policy follow-up must be tested before a new native attempt.
Keep the original no-retry/no-adoption safeguards. Any later uncertain response
again requires independent review before continuing; do not delete partial
resources. Installer/guest preparation remains after verified off-state creation.
