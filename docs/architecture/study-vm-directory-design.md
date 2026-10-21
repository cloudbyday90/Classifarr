# Private study VM directory creation

Approved through the repository's grill-me workflow on 21 October 2026. This
refines the existing powered-off creator; it does not authorize another native
VM attempt, parent permission changes, VM startup or a study.

## Evidence and recommendation

The administrator's latest creator result was `blocked`, at `permissions`, with
`mutationAttempted: false`. A separate read-only diagnostic found the same
explicit All Virtual Machines ACE on each selected parent: SID `S-1-5-83-0`,
rights `0x12008f`, no inheritance/propagation flags, not inherited. The rejected
bits are `0x6`: creating files and subdirectories in that parent, not deleting
children or changing permissions. This is an observation of this host, not a
claim that every Windows installation has the same default ACL.

| Approach | Benefit | Cost or risk |
| --- | --- | --- |
| Trust the entire VM group | Minimal code | Overbroad; rejected |
| Change existing parent ACLs | Existing check passes | Affects shared Hyper-V storage; rejected |
| Require different private parents | Simple creator policy | Additional location approval and secure setup |
| Exact parent exception plus private creation | Retains approved locations and private children | Needs native interop and Windows filesystem qualification |

Recommendation: the last option. Keep orchestration and the fixed Windows query
in small ESM files; no CommonJS, new dependency, database/table or application
admin endpoint. A fixed embedded native declaration is only the Windows API
boundary, not user-supplied code. Hyper-V still assigns its own resource GUIDs.

## Contract

Recognize only the exact observed allow ACE, at depth one on either explicitly
selected parent, with that SID/mask, no inheritance/propagation and
`IsInherited: false`. Do not add this group to trusted principals. All other
entries must independently pass existing checks; a permitted entry cannot hide
a broader one. The exception never applies to the new child directories.

Replace create-then-`Set-Acl` with exclusive `CreateDirectoryW`, supplying a
protected security descriptor with owner Administrators and inheritable full
control for SYSTEM and Administrators only. Protection is required at creation,
so a separate inherit-only ancestor ACE cannot expose a new child before a later
repair. Recheck directory/reparse/ownership/protection and reject untrusted child
allow entries, including read-only or inherit-only grants. Only the newly
returned VM's resolved SID may subsequently join the child allowlist.

The native API creates only the final path component and refuses an existing
file/directory. Do not use a convenience API that returns an existing directory,
repair an existing ACL, create missing parents or fall back to insecure creation.
Capture the native error immediately with `SetLastError`/`GetLastWin32Error` and
release pinned descriptor memory in `finally`. Native declaration/compiler
failure blocks before resource writes; do not bypass Windows language/security
policy. Never load caller-selected libraries, declarations or code.

Keep the existing one-shot 15-minute/64-KiB budget, cancellation and no-retry
contract. A failure after the first directory attempt remains review-required,
including a collision in that phase: the earlier directory may already exist.
Timeout/cancellation/lost output cannot prove service-side rollback. No automatic
cleanup, adoption or replay. Fresh resource/path/capacity checks still apply.

This is not a filesystem transaction or a defense against hostile privileged
administrators. Trusted operators must coordinate changes. A shared principal
can still pre-create a target or consume capacity; collisions must refuse safely.
The parent permissions are never changed.

## Verification and completion

Add a failing regression for the observed parent ACE before implementing its
exception. Exercise wrong SID, inherited/inheriting entries, additional rights,
extra hostile entries, lost child protection and group grants on children.
Synthetic Hyper-V tests must replace every native creation call as well as VM
cmdlets; they cannot provision resources even on an administrator test host.

Separately compile the production native boundary on Windows and exercise it
only inside a new disposable fixture owned by the current test user. Supply a
fixture descriptor owned by that user rather than the production Administrators
descriptor; this tests the real syscall/inheritance/collision behavior without
requiring elevation. Check initial protected ACLs, inherited hostile grants,
existing file/directory and missing-parent refusal, and unchanged existing ACLs.
Verify fixture cleanup. This is not actual Hyper-V creation or qualification of
the production administrator owner/SID binding.

Run focused tests, gateway/preflight gates and scoped lint/document checks.
Build the exact committed source with no cache under the existing protected
Compose workflow, without replacing normal Classifarr. Linux image checks cannot
qualify the Windows native API; disclose platform skips and keep those results
separate. Record results in a separate outcome document, not as study readiness.

Next: one separately reviewed native powered-off creation attempt, then verified
official Ubuntu installation and the agreed private SSH/network preparation.

## Official sources

Located and opened through the search MCP on 21 October 2026:

- [File access rights](https://learn.microsoft.com/en-us/windows/win32/fileio/file-access-rights-constants): distinguishes creation and child deletion.
- [CreateDirectory](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createdirectory): initial security, final component only, existing-target refusal.
- [DACL for a new object](https://learn.microsoft.com/en-us/windows/win32/secauthz/dacl-for-a-new-object): protected descriptors prevent inherited ACE merging.
- [Directory.CreateDirectory](https://learn.microsoft.com/en-us/dotnet/api/system.io.directory.createdirectory?view=netframework-4.8): convenience overload returns existing directories; unsuitable for exclusive creation.
- [Marshal.GetLastWin32Error](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.marshal.getlastwin32error): capture the error from a `SetLastError` native declaration.
