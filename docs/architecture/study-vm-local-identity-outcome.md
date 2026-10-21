# Study VM local-identity correction outcome

## Cause and correction

On 21 October 2026 the administrator's read-only precreation check reached
`collisions`, then failed at the `Get-VM` inventory call. No writer was included
in that probe. A matched experiment using fresh Windows PowerShell children,
fixed read-only queries, built-in module lookup and restricted environments found:

| Child | Administrator | Result |
| --- | --- | --- |
| Original filtered environment | Yes | Inventory failed; inner `ArgumentNullException`, HRESULT -2147467261 |
| Same environment plus OS-derived process-local hostname | Yes | Inventory succeeded, zero VMs |

The non-administrator control similarly changed from the null-argument failure
to the expected permissions refusal. This establishes a process-environment bug,
not a VM collision or evidence requiring Hyper-V service/ACL repair. Raw errors,
hostnames, VM names and identities were not emitted by the diagnostic.

Implemented the [local-identity design](study-vm-local-identity-design.md):
derive the child hostname from Windows, retain environment filtering and stop on
identity errors before reading/executing input. The same change set includes the
separately documented [hidden-metadata correction](study-vm-hidden-path-outcome.md).
No administrator operation, VM creation, restart, shared permission change,
Unraid/shared Ollama change, study or release was performed by these tests.

## Verification

The new Windows bootstrap regression failed before the fix: its nonempty/native
identity observations were both false. It passed afterward, with caller-provided
identity ignored, private variables absent and the parent environment unchanged.
A synthetic native-identity failure prevented the input marker from executing.
The test replaces the entire input, so cannot execute the production writer.

All 16 committed creator/directory tests passed on Windows with no skips, along
with six temporary read-only diagnostic/preflight tests. Full CI preflight passed
209/211 tooling tests; the two existing Windows symlink-privilege cases remain
skipped. Copyright (1,789 files), static ownership inventory (no unreviewed drift,
not runtime authorization), both dependency checks, full lint, server/client type
checks, static ESM imports and Markdown (2,332 documents) passed. No dependency,
schema, application HTTP contract or security baseline was changed.

Image results will be recorded against the exact committed source after the
no-cache build. The administrator experiment verifies inventory only; a complete
read-only preflight and actual production-owner/native VM configuration remain
separate checks. A successful observation never grants study readiness.

## Next step

Repeat the complete read-only precreation check with the fixed bootstrap. Only
after every check passes should the administrator consider one reviewed creation
attempt; the creator must repeat fresh checks itself. Preserve uncertain results
for independent review, with no automatic retry, adoption or deletion. Following
verified powered-off creation, authenticate the official guest installer before
adding a guest or networking.
