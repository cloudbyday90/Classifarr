# Native study VM ACL qualification outcome

## Scope and current status

Prepared on 21 October 2026 under the approved
[native qualification design](study-vm-native-acl-qualification-design.md).
The user subsequently executed the private one-shot fixture once as
administrator. Native disk creation, VM creation/attachment and settings
measurement completed, but cleanup is unconfirmed. The result is
review_required, not successful qualification. No native VM or VHD had been
created during preparation.
The real study VM, its disk grant and the production permission guard remain
unchanged. No completion apply, guest boot, switch connection or study ran.

The local invocation of the actual read-only inspection stopped at
administrator_required, before mutation admission. It reported blocked,
mutationAttempted false, envelope not_created and no samples. This demonstrates
the unelevated boundary, not administrator preflight success. The later native
result is recorded separately below; current leftover state needs a read-only
administrator capture.

## First administrator execution

The screenshot reports mutationAttempted true, stage cleanup, cleanupComplete
false, envelopeStatus retained and reasonCode query_failed. Automatic retry is
false, studyReady false and permissionPolicyChanged false. It contains all three
disk ACL measurements:

| Stage | Observed capability grants on the disk | Other observations |
| --- | --- | --- |
| disk_created | None | Trusted owner; unprotected DACL; inherited System/Administrators FullControl |
| vm_attached | Explicit 1180063 and inherited FullControl 2032127 | Trusted owner; unprotected DACL; one fixture-VM explicit 1180063 grant |
| settings_checked | Same capability grants and descriptor fingerprint as vm_attached | No measured disk ACL change across the separate settings step |

Both capability rows have zero inheritance/propagation flags on this file.
The public exactWorkerGrants count of one counts the explicit 1180063 rule;
it does not mean there is only one capability ACE. The inherited FullControl
row is important new evidence beyond the earlier first-refusal diagnostic.
No raw identity, path or descriptor has been copied into this document.

The combined native VM-create/attach sequence reproduced the explicit grant,
and the measured disk descriptor already contained both capability grants before
Set-VM. This narrows the observed stage, not the exact internal API or universal
provenance. It does not identify the inheritance source, establish effective
cross-VM access or authorize accepting either grant. The production guard and
one-target completion remain unchanged and blocked.

The original result does not identify a cleanup substep. Pure in-memory
reproductions yield the same three samples and cleanup/query_failed both when
metadata reading throws before any removal and when a mocked VM removal or file
removal has been attempted. Therefore do not infer that native Remove-VM ran,
succeeded or did not run. Never rerun the fixture, its cleanup, creation or
completion apply to resolve this uncertainty. The runner contains no VM-start
or switch-connection operation; no guest workload or study was run.

## Prepared implementation

The ignored local ESM files separate the frozen plan, parent/VM/disk checks,
native file identity interop, guarded cleanup, query assembly, capture/projection
and tests. The exact random UUIDv7, names and paths stay in ignored preparation
material. Nothing adds a product admin feature, generic resume/adoption mode,
background task, HTTP endpoint, migration or dependency.

The fixture uses a blank 128 MiB logical fixed VHDX and a never-started Gen2 VM
configured with 512 MiB startup memory. The first native run accepted this
profile through the three measurements, not verified cleanup. Admission checks
require the reviewed local parent tree, NTFS,
at least 2 GiB free, at most 128 inventoried VMs and absent fixture targets.
The envelope is exclusively created with protected System/Administrators access.
Its creation is the persistent one-shot claim; after successful payload cleanup,
the small empty envelope intentionally remains to refuse accidental repetition.

The root handle, root descriptor, owned-child native identities, disk native ID
and VHD DiskIdentifier are checked repeatedly. Configured paths must stay below
the new envelope. Disk size/type/format/parent, off state, returned VM identity,
single disk, disconnected adapter and zero checkpoints are independent checks.
The attachment ACL capture precedes the separate fixture-only Set-VM command.
That command disables automatic startup/checkpoints; a third capture follows
its readback. The three observations are diagnostics, not an acceptance gate for
the real grant, and never print raw SIDs, paths, accounts, ACLs or exceptions.

Cleanup is only reachable after successful measurements. It rechecks off state,
identity and no checkpoints immediately before Remove-VM. It confirms absence,
then checks no other VM references the blank disk. Native file identities bind a
bounded before/after tree: at most 256 entries, depth eight and 1 GiB total file
length. Disk length is separately limited to 256 MiB. Only the exact disk and
native VM-ID configuration file names qualify for removal. Reparse points,
hard links, unexpected files and native-identity/root-permission/owner drift
refuse cleanup. Files and empty folders
are removed individually with LiteralPath, never recursive deletion. Final
absence checks retain the envelope. Error/finally paths never delete resources;
finally only closes the root handle.

Execution has one five-minute, 64 KiB restricted capture and no retry. Inspection
has a 15-second bound and physically omits native compilation/resource writers.
Cancellation, timeout or malformed output after execution admission remains
review_required with unknown effects; it does not trigger cleanup or replay.

## Weakness found and corrected before handoff

A real disposable-file test disproved the initial metadata-only root pin:
opening with zero desired access did not block directory rename on this host.
The helper now opens its persistent root handle with GENERIC_READ and without
delete sharing. The same test then blocked rename, compared handle/path native
identities, rejected a hard link and a junction, detected file replacement and
verified handle release and fixture cleanup. This was a small ordinary-file
test, not Hyper-V execution or an existing ACL change.

Microsoft's [CreateFileW contract](https://github.com/MicrosoftDocs/sdk-api/blob/docs/sdk-api-src/content/fileapi/nf-fileapi-createfilew.md)
distinguishes metadata-only opens, access rights and sharing modes. Its
[file identity contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information)
also explains why the chosen 64-bit identity is unsuitable for ReFS and why IDs
are not permanent authentication. These sources were discovered/opened through
the search MCP on 21 October 2026. NTFS restriction, repeated identity checks,
exclusive scope and nonconcurrent administration are all required; none fences
a trusted administrator or proves runtime isolation.

## Preparation verification

Eight preparation tests passed on Windows, with zero failures or skips. They
include actual PowerShell AST parsing/command allowlisting, one complete mocked
success path, read-only admission, five pre-admission refusal cases, nineteen
post-admission unsafe/uncertain cases and four failures after VM removal.
All native VM/disk/resource writers in those flow tests are mocked. They prove
control flow and refusal/cleanup predicates, not installed Hyper-V behavior.
The native ordinary-file identity test is separately real.

Projection tests reject malformed, excessive or inconsistent rows/counts and
strip untrusted extra identity/error fields. Wrapper tests check frozen source,
one shell-free call, filtered environment, limits, pre/during cancellation and
failed/malformed/oversized capture. Expected source hashes are pinned locally;
they detect drift, not administrator identity or operation authorization. No
security or ownership baseline was refreshed.

All 25 existing Windows creator, directory, SID/adapter and disk-permission
regressions also passed without skips. Production VM cmdlets remain mocked in
those tests. Application server/client suites were not rerun: no application or
tracked runtime source changed. Markdown checked 2,338 documents with zero
errors; whitespace and staged secret checks also passed.

The open PR inventory was rechecked through GitHub MCP: PR 568 remains the only
open PR, and its ESLint 10.13.0 change is already present in server/package.json.
No unapplied PR was available; nothing was merged, closed or updated remotely.

No new Compose build was performed for ignored Windows-only preparation files
and Markdown. They are not part of the application image. The earlier exact
runtime-source no-cache build and isolated image test in the
[disk-permission outcome](study-vm-disk-permissions-outcome.md) remain separate
evidence, not a new build of this documentation commit. No running container,
Unraid service or shared Ollama instance was changed. No release was created.

## Read-only follow-up verification

Prepared a separate frozen, exact-plan ESM review and public projector without
changing the original execution query or its source fingerprint. The review
has no VM/ACL writers, deletion, settings, power or networking commands. Its
fixed native metadata reader preserves hardlink/reparse refusal and adds only
safe condition labels and numeric link counts; it omits root pinning entirely.
One restricted ten-second/64 KiB capture has no retry. Observed means read
completion only; it cannot produce a cleanup-success or study-ready receipt.

All 14 diagnostic and original-fixture tests passed on Windows, without skips:
six new review tests and the eight original preparation tests. The new tests
parse/allowlist the actual PowerShell AST, bind both reviewed queries, distinguish
VM-present, VM-absent-with-disk and absent targets, and exercise sharing,
link-count, ACL/enumeration, private-root, reparse, count and size refusals.
Provider/filesystem state in these flow tests is mocked; no Hyper-V resources
are touched. Strict projection strips extra identity/error fields and refuses
malformed/oversized observations. Wrapper tests verify filtered environment,
bounds, failed capture and exactly one attempt.

All 25 existing Windows creator, directory, SID/adapter and disk-permission
regressions were rerun and passed without skips. Markdown again checked 2,338
documents with zero errors; the tracked changes remain documentation only.

A separate real ordinary-file test observes an NTFS hardlink count of two and
the labelled refusal, without changing the original guard. Its temporary files
are removed and absence checked. This proves the diagnostic label, not that a
native VM configuration file caused the actual cleanup failure. Administrator
execution of the review remains pending; this agent cannot access protected
fixture resources or observe their current state from the unelevated process.
The actual unelevated invocation stopped at administrator_required, with unknown
target state, zero identities read, mutationAttempted false and cleanupAttempted
false. No fixture inventory was attempted after that refusal.

## Next decision

Obtain the prepared read-only administrator capture once. Preserve the original
fixture claim and any partial resources; do not rerun the fixture, creator or
completion apply, remove an ACE or start either VM. If leftovers require cleanup,
agree an exact-target, evidence-backed recovery plan separately. Current identity
observations must not be treated as automatic adoption of the prior operation.

Review both the explicit capability rule and inherited FullControl surface
before proposing any narrowly scoped permission exception. Reproduction alone
does not prove effective cross-VM isolation. The production guard remains strict;
real settings completion, guest setup and the on-demand workload study stay blocked.
