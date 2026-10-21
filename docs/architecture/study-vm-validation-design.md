# Native study VM validation and one-time completion

Approved through grill-me on 21 October 2026. Correct the SID and disconnected
adapter validators, then prepare one temporary administrator-run completion for
the exact independently observed partial VM. This is not a general resume mode,
application admin feature, automatic adoption or permission to run a study.

## Evidence and recommendation

The creator returned `review_required/settings/vm_sid_unavailable` after the
fixed disk and VM were created, before any requested settings were written.
Administrator read-only review found that VM off with the approved paths, fixed
64-GiB disk, valid translated per-VM SID, and exactly one adapter with
`Connected: false`, null `SwitchId` and empty switch name. Its CPU, memory mode,
startup/shutdown and checkpoint settings were still defaults, not the profile.

Two incorrect assumptions caused or would cause refusal: per-VM SIDs use the
`S-1-5-83-1-` namespace, not `83-0-`; an unconnected adapter may return a nullable
switch ID, not `Guid.Empty`. Local Microsoft assembly metadata/getter inspection
confirmed nullable `Guid` and a null result when no switch is connected. No
getter, provider call or VM mutation was invoked during that inspection.

| Option | Benefit | Weakness |
| --- | --- | --- |
| Delete and recreate | Restarts the original flow | Unnecessary destructive operation and another disk allocation; rejected |
| General resume/adoption feature | Reusable recovery | Broader permanent authority and state-management surface; rejected |
| Correct validators; leave partial VM untouched | Smallest code change | Does not finish the approved setup |
| Correct validators plus reviewed one-target completion | Preserves existing resources and completes setup | Requires fresh independent target checks and administrator invocation |

Choose the last option. Keep shared fixed validation functions in a small ESM
module; retain GUID-bound Windows account translation, rather than calculating
or guessing a SID. The VM group remains untrusted on child directories. Require
exactly one adapter, Boolean false connection state, empty switch name and a
null or typed empty-GUID switch ID. Missing, connected, named, multiple, string-ID
and inconsistent observations cannot pass. No network mutation is introduced.

## Completion contract

Keep the actual GUID and approved absolute paths only in ignored temporary
material. Generate the temporary query from the production checks/settings and
verification blocks with strict source-bound extraction. It accepts no target
override or arbitrary script. There is no creator CLI change or resume option.

Before writes, require an administrator, one exact GUID/name/path-bound VM in off
state, the existing protected private child directories and safe ancestors,
GUID-resolved SID, generation 2, one exact fixed 64-GiB VHDX without a parent,
one unconnected adapter and no checkpoints. Recheck identity/off state and
unchanged disk/adapter/path safety before every settings command. Only the
existing settings block is allowed: automatic start Nothing, stop ShutDown,
checkpoints disabled, four CPUs, fixed 8-GiB startup memory, Linux CA Secure Boot
and Shutdown integration. No creation, deletion, ACL repair, switch operation,
power operation, installer or guest action is permitted.

Use the existing restricted native-identity bootstrap and bounded private
capture: one invocation, at most 15 minutes/64 KiB, cancellation, no automatic
retry. A failed precheck blocks without mutation. From the first settings attempt,
errors, timeout, cancellation, partial or malformed output require review; killing
the caller does not prove a service-side operation stopped. Preserve resources
and independently inspect again. Do not infer ownership or authority from age,
a receipt, a name alone or this document.

Read back the complete profile and off state after settings, with the corrected
SID/adapter checks and private-directory policy unchanged. A verified off VM is
not a working guest, authenticated handoff, shutdown qualification or study-ready
environment. Nothing touches Unraid, shared Ollama or normal Classifarr.

## Verification

First reproduce the wrong SID rejection and nullable-switch mismatch. Exercise
the actual production SID validator while substituting only native translation;
do not replace the whole resolver. Cover group/old-prefix/malformed SID rejection
and translation failure before settings. Exercise typed null/empty adapter
representations, connected/named/multiple/missing/inconsistent states and missing
or wrong property types. Keep native creation and every VM writer mocked during
automated tests, including tests run by an administrator.

The temporary completion requires an actual PowerShell AST command allowlist,
strict frozen source bindings, synthetic success/refusal/partial/cancellation
tests, and proof that no create/delete/network/power/ACL writer can run. Test its
real checks with all infrastructure mocked; do not use a live VM as a test fixture.
Run focused, gateway/preflight and relevant quality gates; no-cache build and
isolated image evaluation must match the exact committed source. Report native,
synthetic and Linux evidence separately.

## Permission-policy follow-up

The user subsequently approved the exact-template correction with independent
disk checks. The separate [disk permission design](study-vm-disk-permissions-design.md)
now defines its scope; the following records the original decision and rationale.

The administrator's read-only completion inspection now stops on an explicit
CREATOR OWNER inheritance-only rule on the owned disk directory: SID `S-1-3-0`,
GENERIC_ALL mask 268435456, object/container inheritance flags 3, propagation
flags 2, not inherited. This is evidence of a particular rule, not evidence of
its provenance or authorization to accept or remove it.

Microsoft documents that an inheritance-only rule does not control access to
the object carrying it. When inherited as an effective rule, generic rights are
mapped and CREATOR OWNER becomes the owner of the resulting child security
descriptor. That owner is not necessarily the parent directory's owner. A
protected parent DACL prevents incoming inheritance; it does not disable the
parent's own rules from propagating to descendants. These facts make a blanket
inheritance-only exception unsafe.

| Option | Benefit | Weakness |
| --- | --- | --- |
| Retain the current refusal | No permission-policy expansion | The partial VM cannot be completed |
| Remove or rewrite the rule | Could restore the original expected ACL shape | Adds unauthorized ACL mutation and risks changing native behavior |
| Qualify exact-template recognition with descendant checks | Can preserve existing permissions and resources | Requires new native tests and evidence that child ownership/access remain restricted |

The user selected the last option through grill-me on 21 October 2026.
Any proposed recognition must be confined to the owned, protected disk directory,
not parents, the VM configuration directory or a general trusted-principal list.
Require the exact SID, allow type, mask, flags and explicit status, plus the
existing trusted owner and protected-DACL checks. Check the expected VHD's owner
and access rules and use bounded inventory to reject unexpected children or
reparse points. Retain every other refusal and repeated identity/off/disk checks.
No permission edits, broad group trust, automatic retries or VM power/network
operations are proposed.

Qualification would use disposable native Windows filesystem fixtures to
demonstrate actual parent/child inheritance and protected-child behavior, with
negative cases for every altered rule field, wrong target, untrusted child owner
or grant, unexpected child and loss of protection. Synthetic tests alone cannot
establish Windows inheritance semantics. See the separate
[disk permission outcome](study-vm-disk-permissions-outcome.md) for implementation
and verification; historical results here do not prove the follow-up's behavior.

## Official sources

Located and opened through the search MCP on 21 October 2026:

- [Microsoft SID structures](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/81d92bba-d22b-4a8c-908a-554ab29148ab):
  distinguishes the VM group from the per-VM SID namespace.
- [New-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vm?view=windowsserver2025-ps):
  a VM gets an adapter automatically; connecting it to a switch is optional.
- [ACE_HEADER flags](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-ace_header):
  inheritance-only entries do not grant access to the object carrying them.
- [ACE inheritance rules](https://learn.microsoft.com/en-us/windows/win32/secauthz/ace-inheritance-rules):
  effective child entries map generic rights and creator identities.
- [CreatePrivateObjectSecurityEx](https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-createprivateobjectsecurityex):
  creator-owner substitution uses the resulting child's owner, not necessarily
  the parent's owner.
- [Security descriptor control](https://learn.microsoft.com/en-us/windows/win32/secauthz/security-descriptor-control):
  protected DACLs prevent modification by incoming inherited entries.

The precise null-ID representation is independently observed on this Windows
installation and corroborated by its installed Microsoft implementation, not
claimed as an undocumented universal behavior across every Hyper-V version.
