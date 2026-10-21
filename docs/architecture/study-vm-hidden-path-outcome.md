# Hidden Windows path follow-up outcome

## Cause and correction

The administrator's attempt after the private-directory fix returned `blocked`,
stage `permissions`, `not_found`, `mutationAttempted: false`. No resource write
was attempted. A read-only A/B check using actual Windows PowerShell 5.1 showed
that ordinary `Get-Item` could not observe the existing hidden `ProgramData`
ancestor; the same literal read with `-Force` succeeded and `Get-Acl` was readable.

Implemented the [metadata correction](study-vm-hidden-path-design.md), retaining
all security checks. This changes only item visibility during a read, not folder
attributes, permissions or mutation behavior. Existing native exclusive-directory
creation, protected ACLs, target refusal and no automatic retry remain intact.

## Verification and limits

A new regression extracted the production metadata-read statement and ran it in
a real disposable hidden Windows directory. It failed before the fix and passed
afterward. The ordinary-read control still reported missing, while the fixed
read observed the directory with unchanged hidden attribute and ACL. The fixture
was removed and absence verified. No Windows system directory was modified.

All 15 focused tests passed on Windows, no skips. Synthetic cases also confirmed
hidden junction refusal, missing-folder refusal and denied-read refusal. The
query permits `-Force` only on this exact `Get-Item` read; it remains forbidden on
any other command. The earlier native private-directory/collision tests still pass.

A temporary read-only probe copies only the production preflight functions and
checks, not native compilation or any writer. Actual PowerShell AST parsing and
a read-command allowlist passed, as did bounded-output/projection tests and a
complete fully synthetic preflight. The user's initial probe passed permissions
and capacity, then stopped at `collisions` with `query_failed`. It made no changes.
Instrumentation located the failure in the `Get-VM` inventory read, not either
target-folder check. A separate matched administrator experiment confirmed that
the restricted environment omitted Hyper-V's local hostname input; deriving that
identity from Windows made the inventory succeed with zero VMs. See the separate
[local-identity outcome](study-vm-local-identity-outcome.md). Neither result is a
name reservation or successful VM preparation.

Before the subsequent identity correction, full Windows CI preflight passed
208/210 tests with the two existing symlink-privilege skips. Copyright,
ownership/static inventory, both dependency checks, full lint, type checking,
static ESM imports and Markdown (2,330 documents) passed. The combined follow-up
results are recorded in the identity outcome; do not substitute the earlier run
for that changed source.

The earlier no-cache image evaluates commit `fc47cbbaa76a93135580e84512bd4c236d9ec9c9`,
not this metadata follow-up. Further quality/image results belong to the exact
new source once recorded. No successful VM creation, native production-owner
qualification, study readiness, release or normal-container replacement is claimed.

## Next step

Recheck the complete read-only preflight after the identity correction before
another write attempt. Keep observations separate from authority/reservations. Do not rerun
creation, delete resources, repair shared permissions, restart Hyper-V services
or bypass guards based on an unspecified query failure.
