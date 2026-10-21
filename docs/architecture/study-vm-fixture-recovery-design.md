# Retained study-VM fixture recovery preparation

Approved on 21 October 2026 through the repository's grill-me workflow:
prepare/test a separate one-target cleanup, not execute it. The original
qualification runner and its frozen source remain unchanged. The real study
VM, ACL policy, networking and power state are out of scope.

## Identity and admission

Use ignored modular ESM files and the existing fixed local PowerShell 5.1
bootstrap. Accept no CLI paths, hostnames, VM names, GUIDs or commands. Reuse the
private fixture plan; do not recreate anything or infer historical identity.
The original run did not persist its returned VM GUID. A fresh inspection is
therefore a proposed current target, requiring explicit review before deletion.

Inspection physically excludes receipt writers and removal commands. Require
administrator context, reviewed local parent permissions, NTFS with at least
2 MiB free for a bounded receipt, the private
protected root, exactly one matching off Gen2 VM, expected memory/disk/settings,
one disconnected adapter, no checkpoints, and no other VM referencing the disk.
Use at most 128 VMs, 64 drives per other VM/1,024 total, 256 tree entries, depth
eight, four expected payload files and 1 GiB total length. Reject reparse points,
hardlinks, unexpected basenames, untrusted owners and failed/contradictory reads.
Hidden/read-only payload attributes require review, not automatic force removal.

Bind the current VM GUID, configuration paths, root identity/descriptor, disk
native and VHD identities, profile, and sorted relative tree identities, owners,
ACL fingerprints, types, attributes and lengths into a versioned SHA-256 target
fingerprint. Repeat the complete snapshot and require equality. Public output
contains the fingerprint and fixed counts/checks, never raw identities or paths.
This is current-state integrity, not historical provenance, content attestation,
administrator authentication or fencing against a concurrent trusted admin.
Require no concurrent VM administration.

The prepared CLI keeps execution disabled before launching PowerShell. No input
flag or inspection automatically enables it. Enabling later would require a
separate reviewed change pinning the accepted fingerprint and exact apply-query
source, followed by explicit execution agreement. No approval is inferred from
preparation or a successful inspection.

## One-shot receipt and removal contract

The prepared apply query is exercised only with mocked VM/resource effects.
After all fresh admission checks and fingerprint comparison, pin the private
root with the qualified native handle. Exclusively create one fixed protected
receipt file inside that root. Existing receipt, malformed claim or uncertain
creation refuses replay; never overwrite, truncate, resume or reset it.

Use FileMode.CreateNew with security applied at creation, not Set-Acl afterward.
Bound UTF-8 JSONL records to 256 KiB each, 520 records and 512 KiB total. The
first protected claim record preserves the complete private identity snapshot,
including the newly reviewed VM GUID and exact tree; a hash alone would repeat
the original missing-identity weakness. Never copy that private record into
public output or tracked files. Each removal needs an intent record flushed
with Flush(true) before the call; confirmed absence gets a subsequent record.
Later records contain sequence, fixed action/step, row ordinal and fingerprint,
not raw identities, paths or exceptions. A flush failure stops the sequence.
Each intent/confirmation also contains a subject fingerprint identifying the
exact inspected tree row or VM; ordinals alone cannot identify a leaf when
native VM removal leaves a different subset. Stopped records retain fixed
reason/error categories and numeric diagnostic codes if their flush succeeds.
Storage/controller failure can still defeat durability; this is not a promise
of transactional VM deletion or atomic operation-plus-receipt completion.

Remove the exact freshly validated VM object first. Confirm name/GUID absence,
then recheck the retained disk and all other-VM references. Validate the remaining
tree as a subset of the inspected tree; never accept new/replaced objects or
permission/owner drift as a new baseline. Before each later step require exact
remaining inventory, root/receipt identity, VM absence and disk safety. Remove
expected files individually, then empty directories deepest first, with literal
paths and no recursive/force deletion. Retain the private root and receipt.

Maximum one attempt, one job and no automatic retry, background job or polling
resume. Bound inspection to 30 seconds and hypothetical execution to five
minutes, with 64 KiB public capture. Inspection failure is blocked/unavailable.
Any uncertain receipt/resource effect is review-required and preserves remaining
resources. Crash, cancellation, timeout or failed/malformed capture cannot prove
whether provider work completed; the persistent claim prevents replay. No
finally-block removal: close handles only. Cleanup completion requires verified
payload/VM absence and a flushed completion record, not command success alone.
Invalidate absence/count observations before each recheck/effect so a later
failure cannot report an earlier successful check as current state.

## Alternatives and recommendation

| Approach | Benefit | Cost or risk |
| --- | --- | --- |
| Retain off fixture | No destructive effect | Leaves small disk/configuration allocation; safe stopping point |
| Rerun original fixture/cleanup | No new recovery preparation | Replays an uncertain operation without the original identity receipt; rejected |
| Separate reviewed one-target recovery | Fresh identity review, bounded scope and step receipts | More checks; native removal remains unqualified and can stop partially; recommended preparation only |

Recommendation stack: preserve the original evidence; qualify inspection and
receipts locally; obtain one fresh administrator inspection; review its target
and any refusals; only then consider enabling/executing the pinned one-shot
recovery. Permission exceptions, completing the real study VM, guest networking,
on-demand runtime operation and workload measurement remain separate work.

## Verification

Exercise the real PowerShell AST, original source fingerprints, strict output
projection and disabled CLI execution. Mock every VM, VHD and fixture-resource
effect in flow tests. Cover exact-ID inventory, other-drive failures, snapshot
drift, owners/permissions, missing/wrong files, running/connected VM, checkpoints,
receipt collisions/flush failures, partial removal, VM absence uncertainty,
foreign attachments, tree drift, file failures and no finally cleanup/retry.
Separately use ordinary temporary Windows files to qualify exclusive protected
receipt creation, concurrent claim refusal, append/flush, native root pinning
and handle release. Simulated deletion is not native Hyper-V qualification.

Record exact tests, limitations and administrator results in a separate outcome.
No release, application deployment, Compose replacement, Unraid or shared Ollama.

## Official sources and limits

Discovered/opened through the search MCP on 21 October 2026:

- [FileStream constructor](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.-ctor?view=netframework-4.8.1)
  applies file security during creation; this overload requires .NET Framework,
  hence the fixed Windows PowerShell 5.1 executable rather than a caller shell.
- [FileMode](https://learn.microsoft.com/en-us/dotnet/api/system.io.filemode?view=netframework-4.8)
  distinguishes exclusive CreateNew from overwrite/open-or-create variants.
- [Flush](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.flush?view=netframework-4.8.1)
  describes flushing intermediate buffers; direct UTF-8 bytes avoid a separate
  StreamWriter encoder buffer. This is not a transaction or power-loss proof.
- [Remove-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/remove-vm?view=windowsserver2025-ps)
  retains virtual disks and can merge checkpoints; independent disk and
  zero-checkpoint gates remain necessary.
- [Remove-Item](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/remove-item?view=powershell-5.1)
  requires force for hidden/read-only files, without overriding security. This
  preparation refuses those attributes instead of expanding deletion behavior.

Read-only means no fixture/VM mutations: fixed metadata Add-Type compilation can
use ordinary compiler temporary files. Native VM-removal side effects, privileged
System/Administrators receipt creation on this fixture and physical power-loss
behavior remain unqualified. Repeated literal-path checks are not atomic handle-
bound deletion or protection against a concurrent trusted administrator.
