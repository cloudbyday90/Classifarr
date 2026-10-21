# Hidden Windows directory inspection

This is a correction to the already-approved creator's metadata inspection,
not a new VM operation or a change to its permission policy.

## Cause and chosen correction

After the parent-ACE fix, the next administrator attempt stopped at `permissions`
with `not_found` and `mutationAttempted: false`. A read-only reproduction using
actual Windows PowerShell 5.1 found that ordinary `Get-Item -LiteralPath` reports
the existing hidden `ProgramData` ancestor as missing. Adding `-Force` to that
metadata read observes it; `Get-Acl` can independently read its descriptor.

Use `-Force` **only** on the exact literal `Get-Item` metadata read. In this
cmdlet it includes hidden items; it does not overwrite a target, change attributes
or bypass Windows permissions. Retain every ownership, protected-DACL, depth,
reparse, capacity, collision and administrator check. Missing/denied observations
still block before writes. Do not unhide Windows folders, create a replacement
`ProgramData`, change ACLs or add a general force option.

The existing one-shot timeout/output bounds, cancellation, no automatic retry,
exclusive private-directory creation and unknown-side-effect rules are unchanged.
There is no application/API/database change and no new admin feature.

## Verification

First run a failing regression against the production metadata-read statement in
a disposable real hidden Windows directory. Then require successful observation
with unchanged hidden attribute and ACL, plus synthetic hidden/reparse/missing/
denied cases. Restrict the query's only `-Force` occurrence to this exact read;
keep force/overwrite mutation forbidden. Preserve separate native API tests.

Before another user-run write attempt, prepare a temporary bounded read-only
probe from the production preflight functions/checks. Inspect its PowerShell AST
to allow only the required read commands and reject mutation/native compilation
or invocation. The probe's result is a point-in-time observation, not a name
reservation, authorization or VM/study readiness. Repeat fresh checks at creation.

Record actual results separately, including Windows versus Linux skips. Any
image evaluation must use the exact new clean source without replacing normal
Classifarr. No VM, network or shared permission changes occur during testing.

## Official source

[Windows PowerShell 5.1 Get-Item](https://learn.microsoft.com/en-us/powershell/module/Microsoft.PowerShell.Management/Get-Item?view=powershell-5.1),
located through the search MCP on 21 October 2026, documents hidden-item access
and states that `-Force` cannot override security restrictions.
