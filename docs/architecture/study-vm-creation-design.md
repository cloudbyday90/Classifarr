# Powered-off study VM creation

Agreed 21 October 2026 through the grill-me workflow. This is a one-time,
administrator-invoked local setup step, not a background service, application
admin feature, lifecycle executor or permission to run the study.

## Recommendation and alternatives

Create only a new, powered-off Generation 2 VM named `Classifarr-Study`, using
the existing fixed 4-vCPU/8-GiB/64-GiB profile. Require explicit reviewed local
parent directories; derive dedicated child directories without changing host
defaults. Real local paths stay outside committed documentation/configuration.
Use a separate fixed VHDX, not the dynamic disk created by `New-VM -NewVHD*`.
([New-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vm?view=windowsserver2025-ps),
[New-VHD](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vhd))

| Approach | Benefit | Weakness |
| --- | --- | --- |
| Manual wizard | Familiar, no new helper | Easy to select dynamic memory/disk or an existing switch |
| Explicit one-shot ESM creator | Repeatable checks and narrow write scope | Still requires an administrator and native verification |
| Always-on privileged provisioner | Less manual setup | Unnecessary permanent authority and lifecycle complexity |

Final stack: pure ESM plan, existing bounded private command capture, fixed
PowerShell with data-only arguments, fresh administrator/path/capacity/collision
checks, restricted new directories, fixed disk, new VM identity, configuration,
read-back verification. Do not import a receipt as authority or reuse an existing
resource. No new database or table is needed; Hyper-V assigns its own VM GUID.

## Contract and safeguards

`--plan` validates explicit arguments without running commands or creating files.
Only `--create` performs writes, in an already-authorized Windows session. There
is no elevation, automatic retry, force/overwrite, deletion, adoption or start
operation. The new default network adapter remains disconnected. Creation does
not add a switch, IP, route, firewall rule, installer, credential or shared mount.
The existing complete-preparation checks must still reject this unfinished VM.

Accept canonical drive-rooted local parent paths only: no UNC/device path, ADS,
wildcards, relative segments, control characters, reserved names, overlapping
targets or paths deeper than the inspection bound. Check every existing ancestor
for reparse points and trusted ownership. Conservatively reject effective allow
entries for untrusted destructive access on ancestors and untrusted write access
on final parents; do not try to infer safety by subtracting deny ACEs. Ignore
inherit-only rules when assessing access to the directory itself. Bound ACL
entries and path depth. An unavailable observation blocks writes.

Create absent dedicated directories without force, then set a protected DACL
granting only SYSTEM and local Administrators full control before placing any
disk/configuration. Hyper-V may subsequently grant its new VM principal access:
resolve only that returned VM ID's SID and recognize it only on the two owned
directories, never on their parents or as an all-VMs group. Native SID resolution
still needs administrator qualification, not a mock-only claim.
([Microsoft VM permissions](https://learn.microsoft.com/en-us/troubleshoot/windows-server/virtualization/hyper-v-virtual-machine-not-start-0x80070005))
Never change parent permissions. Recheck directories and
name absence before resource creation. Trusted administrators/Hyper-V operators
must coordinate setup: these checks are not a filesystem transaction or defense
against a hostile privileged writer.

Fresh admission requires at least four logical processors, 16 GiB free RAM and
96 GiB available on each selected local fixed NTFS/ReFS volume. These conservative
setup headroom checks are not a build/restore capacity qualification, reservation,
exclusive CPU allocation or performance guarantee; do not sum shared volumes.
Inventory is bounded at 256 existing VMs. The operation has one 15-minute command
budget and 64-KiB combined output limit, with no budget renewal or retries.
A small fixed PowerShell bootstrap reads the generated script over stdin to
avoid Windows command-line length limits; paths remain base64 JSON data within
that script. No caller-supplied command or script is supported.

Configure only the returned new VM object/ID, rechecking that it is off and its
configuration remains under the dedicated directory. Set fixed memory, four
processors, no host-boot automatic start, graceful host shutdown action and
disabled checkpoints. Keep Secure Boot on with the Linux certificate-authority
template. Verify the exact attached VHDX, fixed size/type, resource settings,
off state, disconnected adapter, firmware and shutdown-service setting afterward.
([VM settings](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vm?view=windowsserver2025-ps),
[firmware settings](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vmfirmware?view=windowsserver2025-ps))

## Failure, cancellation and verification

Before any write, a failure is blocked. From the first directory-creation attempt,
a failure requires review; preserve possible partial resources. A child timeout,
cancellation, launch error, malformed output or lost response cannot establish
whether a service-side operation completed. Killing the PowerShell child does
not undo or necessarily cancel Hyper-V/storage work. Never rerun automatically,
delete leftovers or claim rollback. Inspect the named targets independently.

Output is a strict allowlisted status/stage, a fixed failure reason when known,
and, only after successful read-back, the new VM GUID. Never publish raw PowerShell exceptions, ACL/SID inventories,
local paths or stderr. Only basic Windows process environment variables are
inherited; tokens and Docker overrides are not forwarded to PowerShell.
Planning output deliberately shows selected paths locally
for administrator review; do not commit it. Successful creation is not study
readiness, authenticated SSH, network isolation or successful guest shutdown.

Tests must cover invalid paths before execution, Windows backslash regressions,
strict result types, sanitized/oversized output, one-shot timeout/cancellation,
and blocked/partial/verified behavior. Parse the emitted PowerShell and exercise
its refusal and creation sequence with entirely synthetic cmdlets; never invoke
real Hyper-V mutation from automated tests. Existing gateway and quality gates
remain enabled. Native creation is performed separately by the administrator.

Next: authenticate and verify an official Ubuntu Server LTS amd64 installer,
install the guest, then set up the agreed dedicated Internal network and reviewed
SSH handoff. Verify the signing key and signed checksum before trusting the ISO,
not just an unsigned hash.
([Ubuntu image verification](https://documentation.ubuntu.com/security/software-integrity/image-verification/))

Official sources above were located and opened through the search MCP on
21 October 2026. See the separate outcome document for actual, not planned, checks.
