# Native study VM disk ACL qualification

Approved through grill-me on 21 October 2026: prepare a one-shot disposable
native test to identify when Windows adds the observed vmWorkerProcess file
grant. This is not approval to accept that grant, complete the real study VM,
start a guest, connect networking, repair permissions or create an admin feature.

## Contract

Use ignored, modular ESM preparation files and the existing restricted Windows
PowerShell bootstrap, bounded capture, exclusive protected-directory primitive
and identity validators. Keep the exact random fixture identity and local paths
out of tracked documentation. No caller-supplied paths, names, commands or
remote host options are accepted. The private source is pinned before handoff.

Use one Gen2 VM configured with 512 MiB startup memory and one blank 128 MiB
logical fixed VHDX, with no parent/source disk. Never start it, mount/format its
disk, attach installation media, connect a switch, access production data or
call the real study VM completion. Native acceptance of this small disk remains
part of qualification, not an assumed result.

Before admission require administrator context, the reviewed local parent tree,
sufficient local fixed-volume free space, bounded inventory and no matching
fixture VM or directory. Create an exclusive protected envelope as the durable
one-shot claim. Retain that small empty envelope after successful cleanup, so
the same invocation cannot silently repeat. Existing resources are never adopted.
Use an open root handle that denies deletion, native file identities and fresh
path/owner/permission checks to detect replacement; do not claim atomic fencing
against a trusted concurrent administrator. No concurrent VM administration.
Require NTFS and at least 2 GiB free on the fixture volume: the chosen native
64-bit file identity is not a sufficient unique identity on ReFS.

Create private vm/disk children, then the disk. Capture the disk ACL before any
VM exists. Bind its native file identity and VHD DiskIdentifier, logical size,
format/type and absent parent. Create the VM with VHDPath and no SwitchName;
re-read its returned GUID, expected configuration path, generation, off state,
single expected disk, disconnected adapter and zero checkpoints. Capture the
file ACL immediately after this create/attach operation, before any Set-VM.
Then set automatic startup to Nothing and disable automatic checkpoints on that
verified fixture only. This separate settings step must not be conflated with
the attachment observation. Re-read settings and ACLs before cleanup.

Report only fixed stage/status codes and bounded rule categories, rights/flags,
counts and descriptor fingerprints. Identify the exact known capability and
resolved fixture VM SID without outputting raw SIDs, ACLs, account names, paths
or errors. Unexpected grants are observations, never additions to trusted lists.
The fixture's small fixed disk and off VM do not reproduce the real 64 GiB disk,
guest runtime, cross-VM access or resource-study workload.

## Cleanup and failure semantics

No finally-block removal. Cleanup begins only after complete, successful
measurements and fresh exact identity/path/off-state, disk and no-checkpoint
checks. Microsoft documents that Remove-VM retains VHD files and can merge
checkpoints; therefore it must never run with an unknown checkpoint state.
Remove only the returned/re-read fixture object, never a name pattern or broad
pipeline. Confirm absence before touching the separately owned blank disk.

Inventory only the bounded owned tree. Reject reparse points, hard links,
identity/root-permission/owner drift, unexpected files, excessive depth/count/size and
references to the fixture disk by another VM. Remove validated exact files and
then empty directories individually, without recursive deletion. Check absence
and preserve the exclusive envelope. Do not delete a broad parent or workspace.

Maximum one job/attempt; no background jobs, polling retries, force shutdown,
automatic resume, recovery or deletion after uncertainty. A failure after any
attempted mutation is review-required, retaining partial resources and the
one-shot claim. Cancellation, timeout and malformed capture can leave provider
work in flight: report uncertainty and do not retry or clean automatically.
Use a five-minute overall native deadline and 64 KiB output capture.

## Verification and decision boundary

Before native execution, qualify the real PowerShell AST, native disposable-file
identity/root-lock behavior, strict public projection and the full flow with
all VM/native resource writers mocked. Exercise collisions, unreadable checks,
partial native acceptance, wrong identity/path, running/connected VM, snapshots,
disk replacement, extra files, cleanup drift, cancellation and failed capture.
Simulated success does not establish native Hyper-V behavior.

The recommendation stack is: preserve the real grant and refusal; qualify the
native sequence in bounded exclusive resources; review actual results; only
then propose an exact file-only predicate if justified. Reproduction establishes
local behavior, not universal provenance or effective runtime isolation. Any
policy expansion needs separate agreement and regression evidence.

Official sources discovered/opened via the search MCP on 21 October 2026:

- [New-VHD](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vhd?view=windowsserver2025-ps)
  distinguishes blank fixed creation from source/differencing variants.
- [New-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vm?view=windowsserver2025-ps)
  supports VHDPath, returns the new object and makes switch connection optional.
- [Remove-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/remove-vm?view=windowsserver2025-ps)
  documents retained disks and checkpoint deletion/merging.
- [CreateVirtualDisk](https://learn.microsoft.com/en-us/windows/win32/api/virtdisk/nf-virtdisk-createvirtualdisk)
  documents native disk size constraints; installed-provider acceptance still
  requires measurement.

Record preparation and native results separately in an outcome document. No
release, production deployment, Unraid or shared Ollama operation is implied.

## Read-only review after uncertain cleanup

The first administrator run reached all three measurements but returned
cleanup/query_failed. That broad stage cannot establish whether Remove-VM or a
file removal was attempted. Preserve the original frozen runner; do not fix its
source, refresh its integrity baseline or rerun it to obtain a clearer error.

Prepare a separate, physically read-only query against the same pinned private
plan. Inventory the exact-name VM once and report only state, identity validity,
path containment, expected disk, adapter and checkpoint/settings booleans. A
fresh GUID or filesystem ID is a current observation, not proof of original
ownership and never authority to adopt or delete a leftover resource.

Require the private root descriptor before descending into the bounded tree.
Report existing disk profile and capability rules on encountered descendants,
including inheritance, protection and numeric rights. Keep fixed depth/count,
size and output limits. Stop on reparse points, unreadable metadata or excessive
inventory; partial observations must stay explicitly partial. Root descriptor
and native identity readback detect within-probe drift, not concurrent-admin
fencing. Absence at one instant is not a historical cleanup receipt.

Use the original metadata reader's refusal semantics, adding fixed labels for
reparse/link-count conditions and a numeric link count only. The separate reader
omits the root-pinning method; opens use metadata access, OPEN_EXISTING and full
sharing. Report the failing read step, target category/depth, bounded numeric
Win32/HRESULT/category and strict-property/variable classifications. Never emit
raw names, paths, SIDs, native file IDs or exception text. A hardlink is a possible
refusal cause, not a conclusion about the native VM configuration file.

One restricted ten-second/64 KiB capture, no automatic retries. This query has no
VM/ACL writers, networking changes, settings, power or payload-removal commands.
Fixed native metadata interop compilation is a diagnostic dependency, not VM provisioning.
Failure, cancellation or malformed capture yields unavailable evidence; success
means reads completed, not cleanup, permission acceptance or study readiness.

| Option | Benefit | Cost or risk |
| --- | --- | --- |
| Read-only state and predicate review | Preserves evidence; narrows the uncertain failure | Requires administrator capture; does not complete cleanup; recommended |
| Retry the fixture or its cleanup now | Might clear leftovers | Could replay an uncertain effect without original identity evidence; rejected |
| Accept the earlier explicit capability rule | Could advance settings | Ignores the newly observed inherited FullControl rule and effective-access uncertainty; deferred |

Recommendation stack: preserve both VMs and the existing policy; capture bounded
read-only state; explain the native refusal; then agree a separate exact-target
cleanup plan if needed. Review the complete observed ACL surface before any
file-only policy proposal. No repeated native test or permission exception is
authorized by this diagnostic work.

The official [file-information contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information)
defines the reported link count and the non-permanent identity limitations.
[Remove-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/remove-vm?view=windowsserver2025-ps)
separates configuration deletion from retained VHDs and checkpoint merging.
Both were rediscovered/opened through the search MCP on 21 October 2026. These
contracts justify independent read predicates, not a claim that a particular
cleanup substep failed or that absence authorizes deleting remaining files.
