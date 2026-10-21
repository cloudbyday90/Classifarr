# Native study VM ACL qualification preparation outcome

## Scope and current status

Prepared on 21 October 2026 under the approved
[native qualification design](study-vm-native-acl-qualification-design.md).
The private one-shot fixture is ready for administrator execution. No native VM
or VHD was created during preparation, and no qualification result is claimed.
The real study VM, its disk grant and the production permission guard remain
unchanged. No completion apply, guest boot, switch connection or study ran.

The local invocation of the actual read-only inspection stopped at
administrator_required, before mutation admission. It reported blocked,
mutationAttempted false, envelope not_created and no samples. This demonstrates
the unelevated boundary, not administrator preflight success. Administrator
capture and actual native cleanup verification remain pending.

## Prepared implementation

The ignored local ESM files separate the frozen plan, parent/VM/disk checks,
native file identity interop, guarded cleanup, query assembly, capture/projection
and tests. The exact random UUIDv7, names and paths stay in ignored preparation
material. Nothing adds a product admin feature, generic resume/adoption mode,
background task, HTTP endpoint, migration or dependency.

The fixture uses a blank 128 MiB logical fixed VHDX and a never-started Gen2 VM
configured with 512 MiB startup memory. Native provider acceptance remains to
be measured. Admission checks require the reviewed local parent tree, NTFS,
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

## Verification

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

## Next decision

Run the prepared administrator fixture once, retain its sanitized capture and
verify its native cleanup outcome. A partial/uncertain result requires review,
not rerunning the creator or the fixture. If the exact grant is reproduced,
review the observed stage and risks before proposing any narrowly scoped
permission exception. Even successful reproduction does not prove cross-VM
access isolation or authorize real VM settings/power operations.
