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
