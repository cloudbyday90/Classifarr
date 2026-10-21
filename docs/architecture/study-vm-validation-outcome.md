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
three AST/projection/synthetic-guard tests passed. The administrator's result
attributed the refusal to the owned disk directory itself (depth 1): explicit
CREATOR OWNER, rights mask 268435456, inheritance flags 3 and propagation flags 2.
The result reported `readOnly: true`, `studyReady: false`; no apply was run.

This is an inheritance-only template, not a direct grant on the containing
directory. It can nevertheless grant full control to owners of descendant
objects. Neither its harmlessness nor which operation installed it has been
established. Protected permissions stop incoming inheritance, not propagation
of the directory's own inheritable rules. See the official sources and
[unapproved follow-up options](study-vm-validation-design.md#unapproved-permission-policy-follow-up).
The permission policy remains unchanged; the approved completion does not
authorize ACL repair or an exception. Actual completion remains blocked.

Full Windows CI preflight passed 212/214 gateway tooling cases with two existing
symlink-privilege skips. Copyright (1,791 files), static inventory ownership
review (no unreviewed drift, not runtime authority), both dependency checks,
full lint, server/client type checks, static ESM imports, Markdown (2,334 files)
and diff whitespace checks passed. Six temporary completion/review tests passed
with no skips. No baseline was refreshed to obtain these results.

No dependency, database/table, API contract, release, Unraid/shared Ollama change,
normal-container replacement or live VM settings operation occurred in these tests.
Temporary files are intentionally ignored and are not a permanent admin tool.

## Exact-source no-cache image evaluation

The protected Compose builder completed a no-cache build from clean committed
source `36c854bdc903fdf76d013ea6f9635a152749338b`, with provenance required and
running-image protection enabled. It built only the local candidate; no Compose
up, container replacement or application deployment was performed.

| Identity | Value |
| --- | --- |
| Local image/index ID | `sha256:f29d95d9fb3a2fdefe552d783966cb476f81ff172da1c6299fbf3ce28c2e354b` |
| Linux amd64 child manifest | `sha256:c6190328a846033cbe3f777ad63d799662a961fd218e2cd2bbd9df2bda884c40` |
| Image configuration | `sha256:b6218c8a41f4ec5200072cad07778e3a66a9bd9149f37a08bc45084bebf285a5` |
| Committed-source archive SHA-256 | `d30de3d2655836ac52788ef713f8e32133f41cc3c7b2811f7bb7902c051b43ff` |

The source archive was 80,855,040 bytes. The isolated driver verified its digest,
Node 24.21.0, and byte-identical packaged/source copies of the creator, creation
query, private-directory query and identity query. It then ran the complete
gateway tooling list sequentially: 214 tests, 205 passed, nine Windows-only
skips, no failures, exit zero. Linux skips are not Windows behavioral evidence;
the 19 native Windows focused tests above provide separate qualification.

The candidate ran as UID/GID 1000, network none, read-only root, all capabilities
dropped, no-new-privileges, 512 MiB memory with no extra swap, one CPU and 64 PIDs.
Source and driver mounts were read-only; work and temporary storage were bounded
tmpfs. There were no live application data, credentials, VM folders or Docker
socket mounts. The application entrypoint was not started. The exact disposable
test container was absent before and after evaluation, confirming cleanup.

During build-dependency removal, Alpine's index refresh emitted one TLS warning;
that phase and the build still exited zero. No certificate verification,
dependency pinning or permission control was relaxed to obtain success.
This is local image evidence, not signed published provenance, a Windows image
test, a VM settings operation or release readiness.

The normal Classifarr container retained its original image, start time and zero
restarts; it remained healthy and `/health`, `/ready` and `/` returned HTTP 200.
Its protected rollback image remained available. No normal application was
restarted or replaced.

At recording time, the exact source's remote secret, copyright, OSV, Trivy and
resource-capacity workflows passed. The
[CI/CD workflow](https://github.com/cloudbyday90/Classifarr/actions/runs/39600667078)
and CodeQL were still running; full remote success is not claimed. The only open
PR, #568 (ESLint 10.13.0), was already represented on main, so there was no
eligible unapplied PR to implement and no PR was merged or closed.

## Next

Agree whether to qualify narrowly scoped recognition of the observed inheritance
template, with trusted owner, protected directory and expected disk/descendant
checks, without changing filesystem permissions. The grill-me workflow pauses
that policy change pending shared scope confirmation. Keep the VM off and do
not run completion apply, recreate resources or repair permissions meanwhile.
If approved, prove the exact rule and rejection boundaries in disposable native
filesystem fixtures before changing validation or requesting fresh inspection.
Only a successful inspection can precede an explicit administrator-run apply.
Verified off configuration still requires installer authenticity and later
guest/network setup; it is not study readiness.
