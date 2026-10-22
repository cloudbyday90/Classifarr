# Study-fixture native creation journal proposal

## Scope and status

Prepared on 21 October 2026 for the next item after the completed
[disabled simulation](study-vm-removal-simulation-outcome.md). This document is a
source-only design, not an implemented journal or native execution agreement.
The repository's grill-me workflow still requires confirmation of the proposed
file-only implementation and isolated Docker evaluation boundaries below.

Reuse the settled local Hyper-V host, future bounded inventory/configured-drive
scope and intended one-fixture retention policy. Do not repeat those decisions
or treat them as permission to inspect either retained VM/receipt now. The old
attempt stays consumed, sources/bindings frozen and original cause unknown.
No VM creation, settings, power, networking, removal, permission repair or general
resume/adoption feature is included in the proposed first implementation slice.

## Findings

The tracked creator creates protected directories, then a fixed VHDX, then a VM.
It retains the returned VM GUID in memory, performs Off/SID/ACL checks, disables
automatic startup/checkpoints, applies other settings, verifies and only then
prints successful identity. Failures can precede both durable identity and safe
settings. The old private qualification has the same identity gap and continues
into cleanup; it cannot be invoked as a fresh creation-only tool.

The old native removal receipt uses protected CreateNew, write access,
FileShare.Read, WriteThrough and Flush(true), but describes already-existing
resources. It does not reopen a journal and has different bounds (256 KiB per
record, 512 KiB total, 520 appends) from the pure model (64 KiB, 512 KiB, sixteen
records). Neither is a qualified creation-identity protocol or a drop-in writer.

## Options and recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Retain source/model-only preparation | No new file/native effects | Does not test real exclusive creation, flush or close behavior |
| Qualify file-only journal primitives first | Tests actual Windows file mechanics without Hyper-V | Creates disposable test files; still not provider/production-ACL or power-loss proof |
| Integrate a creator immediately | Closer to the eventual reproduction | Unqualified persistence, partial settings and reference scope remain; not recommended |

Recommend file-only qualification, then a separately reviewed creator integration,
independent admission review and finally a separately approved one-shot removal.
Keep the future writer in the creator's PowerShell process: waiting for child
stdout to reach Node repeats the known capture-loss gap. ESM should organize
small contract/source/qualification modules, not a large singleton or CommonJS
wrapper. This is our architectural recommendation, not a Microsoft transaction
guarantee.

## Proposed file-only implementation boundary

Implement small ESM journal contracts and Windows PowerShell 5.1/.NET Framework
file-writer function source, with a test-only bounded harness. Real file tests use
new, uniquely owned temporary directories and fabricated identity records only.
No provider import, VM/VHD query or operation, real target binding, existing
receipt read, elevated handoff or production integration is added. Imports have
no side effects; no live CLI/environment flag enables a creator or remover.

Qualify exclusive file creation with permissions supplied at creation, bounded
record framing/full-write/flush acknowledgement, close and bounded readback.
Do not append to, truncate, reset, repair or adopt an existing journal. Faults
cover refused creation, write/flush/close errors, deliberately truncated fixture
records, interrupted child output, competing creation and identity/source drift.
Tests under the current user may qualify a protected test-owner descriptor only;
they must not certify the future administrator-owned envelope or parent chain.

Keep the proposed 64 KiB record/512 KiB total ceilings. Select and test a finite
file-format record limit; derive the future creator's exact append/call budget
from its operation list instead of copying the mock or old removal limit.
Validate exact owned scope, non-null protected DACL, handle/file identity and
expected contents before accepting records. Reject links, path aliases, streams,
devices and unsupported layouts rather than widening path/permission policy.
Only exact verified test artifacts may be cleaned; uncertainty retains evidence
for review, never authorizes recursive/forced cleanup of caller-supplied paths.

Keep private identity records separate from bounded public counts, finite codes
and primary/secondary error projections. Record attempted versus acknowledged
writes honestly. A checksum detects corruption, not authorization or ownership.
No raw errors, credentials, account/SID names, GUIDs or paths belong in public
diagnostics. Preserve primary evidence if journaling, projection or close fails.

## Future native integration requirements, not this slice

Flush a creation intent before each external effect. Capture valid returned
identity in the same process and acknowledge its record before later resource
effects; do not insert unrelated provider/SID/ACL work before that recording.
Native file/disk identity acquisition, exact source/plan bindings and private
envelope placement outside VM-managed descendants still need qualification.
Keep separate CreateNew phase receipts rather than silently introducing journal
reopening or restart/resume authority.

No filesystem write is atomic with New-VM. Failure after provider creation but
before identity acknowledgement can still leave an unidentified partial resource.
A valid intent/prefix is incomplete evidence, not permission to adopt by name,
retry creation, infer ownership or clean up. A recorded GUID also does not prove
settings succeeded. New-VM and Set-VM remain separate operations; no Start-VM in
the source is weaker than verified Off/disconnected/startup-disabled state.
The early-failure retention/default-settings case must be agreed before any live
creation. No power action is authorized to enforce the intended quarantine.

Configured-path comparisons are not exhaustive snapshot, differencing-parent or
alias-reference proof. That coverage and any broader reads need separate review;
file-only tests cannot satisfy them or establish study readiness.

## Proposed Docker evaluation boundary

The default installation Compose file mounts ./data and writable media. Do not
recreate that service or use those mounts for qualification. Recommend the
existing frozen candidate rehearsal with no cache: a clean stable source commit,
one immutable local image ID, disposable synthetic projects/volumes, a 30-minute
soak plus settled idle, three saved installation profiles and verified owned
cleanup. The saved Unraid profile is only a local container fixture, not access
to a real Unraid host. No shared Ollama, production credentials or media mounts.

This costs substantially more time than a health check and uses the shared Docker
engine. It is image/runtime evidence on one local platform, not Windows journal
qualification, isolation from physical host load or a new archiving timing study.
Read all selected producers/validators before execution; preserve their gates.
No global prune, unrelated container stop, image publication, release or merge.
This target choice still needs confirmation; no Docker command ran for this plan.

## Official sources

Discovered and opened through MCP on 21 October 2026:

- [FileStream constructor](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.-ctor?view=netframework-4.8.1)
  documents creation-time access rights and existing-file refusal with CreateNew.
- [FileStream.Flush](https://learn.microsoft.com/en-us/dotnet/api/system.io.filestream.flush?view=net-10.0)
  documents flushing intermediate buffers with Flush(true); this design does not
  infer an atomic provider/filesystem transaction or hardware power-loss proof.
- [Null and empty DACLs](https://learn.microsoft.com/en-us/windows/win32/secauthz/null-dacls-and-empty-dacls)
  distinguishes unrestricted null DACLs from empty DACLs. Explicit fail-closed
  validation is required; no current host ACL safety is asserted by source review.
- [New-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vm?view=windowsserver2025-ps)
  documents creation/output and optional switch connection.
- [Set-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vm?view=windowsserver2025-ps)
  documents startup/checkpoint configuration as another cmdlet.
- [Compose build](https://docs.docker.com/reference/cli/docker/compose/build/)
  documents no-cache rebuilding, not application correctness.
- [Compose project selection](https://docs.docker.com/reference/cli/docker/compose/)
  documents explicit file/project selection; those flags alone do not make live
  bind mounts safe or substitute for the repository's owned-resource guards.
