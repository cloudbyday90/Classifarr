# Native VM validation correction outcome

## Observed failure

On 21 October 2026, the administrator's complete read-only precreation check
passed after the hidden-path/local-identity fixes. The separately approved
creator then returned `review_required`, stage `settings`, `vm_sid_unavailable`,
`mutationAttempted: true`. The creation command was not repeated.

Independent administrator read-only review found one stable Generation 2 VM off,
with the approved configuration/disk paths and a fixed 64-GiB VHDX. Windows
successfully resolved its specific VM SID, but the old validator rejected that
SID. The VM still had one CPU, dynamic memory enabled, StartIfRunning/Save
actions and automatic Standard checkpoints. No requested settings could be
assumed complete. The real GUID and selected paths remain outside committed
configuration/documentation.

The first adapter check also returned false. Detailed read-only review showed
one adapter with Boolean `Connected: false`, null `SwitchId` and empty switch
name. This was an incorrect empty-GUID-only comparison, not evidence of a live
network connection. Installed Microsoft assembly metadata/getter inspection
corroborated nullable switch IDs; it performed no provider operation or getter
invocation. The administrator explicitly approved the
[narrow completion design](study-vm-validation-design.md).

## Delivered code correction

A small ESM module now owns the fixed local SID and adapter validation functions.
The SID remains resolved through Windows for the exact returned VM GUID, but
accepts the documented per-VM `83-1` namespace. It rejects the VM group, the old
erroneous expanded `83-0` shape, malformed identities, empty GUID and translation
failure. No SID is guessed or derived by application code; the broad group is
not trusted on owned directories.

Adapter verification requires exactly one object, Boolean false connection
state, empty switch name, and null or typed `Guid.Empty` switch ID. Connected,
assigned/named, multiple, missing, wrong-type and inconsistent observations
cannot pass. No network action was added. The creator still refuses existing
targets; no resume/adoption option or application admin feature was introduced.

The original test gap was replacing the entire SID resolver with an inaccurate
SID literal. Complete creator tests now replace only the native translation
expression, preserving the real production SID validator and realistic `83-1`
own/foreign ACL fixtures. Infrastructure and all native/VM writers remain mocked
in automated creator tests, including when run by an administrator.

## Verification so far

The SID regression failed before the fix in both portable pattern evaluation
and actual Windows PowerShell execution of the production resolver. All 19
focused creator/directory/identity tests then passed on Windows, no skips. The
identity cases include native translation refusal and the group/old namespace;
the adapter predicate covers 13 typed and contradictory representations.

A private temporary completion is source-hash bound to the corrected production
query, exact independently observed GUID and approved paths. It reuses the
production path/identity validators, settings block and complete read-back checks.
Its read-only inspection physically omits every settings command. The apply
query permits exactly one instance of each of the five existing settings
commands and forbids creator, ACL, network, power and native compilation writers.

The completion's three temporary tests passed: actual PowerShell AST allowlists,
bounded filtered capture/unknown-output handling, and complete synthetic
success/refusal/partial sequences. Baseline, running/wrong/duplicate target,
missing/path/disk/network/checkpoint/SID failures stopped before writes. A changed
disk identity after the first settings write stopped immediately for review.
Tests did not operate the real VM. The administrator's actual completion
inspection stopped at `prechecks/acl_review_required`, with
`mutationAttempted: false`. No apply was run. A tested temporary read-only
attribution probe was prepared to identify the exact target/principal category
and numeric rule flags without emitting raw ACLs, account names or SIDs. Its
three AST/projection/synthetic-guard tests passed. The permission policy was not
weakened and no repair is authorized by the completion agreement. Actual
completion remains blocked until that refusal is understood and resolved within
explicit scope. Later image results must match the new source, not an earlier build.

Full Windows CI preflight passed 212/214 gateway tooling cases with two existing
symlink-privilege skips. Copyright (1,791 files), static inventory ownership
review (no unreviewed drift, not runtime authority), both dependency checks,
full lint, server/client type checks, static ESM imports, Markdown (2,334 files)
and diff whitespace checks passed. Six temporary completion/review tests passed
with no skips. No baseline was refreshed to obtain these results.

No dependency, database/table, API contract, release, Unraid/shared Ollama change,
normal-container replacement or live VM settings operation occurred in these tests.
Temporary files are intentionally ignored and are not a permanent admin tool.

## Next

Review the completion's fresh read-only inspection, then hand off one explicit
administrator-run apply only if its checks pass. Preserve partial resources and
review every failure; never recreate/delete or rerun automatically. Verified off
configuration is followed by installer authenticity and guest/network setup,
not a claim of study readiness.
