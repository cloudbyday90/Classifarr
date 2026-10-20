# Read-only VM handoff checks

Approved scope and research date: 20 October 2026. Extend the existing preparation
checker; do not provision, operate or connect to a VM. No permission, network,
production, database, release or background-service changes are included.

## Problem and recommendation

The existing checker can match the resource profile without checking host-boot
startup or shutdown integration. Its positive result is not study readiness,
but those missing observations make the on-demand preparation report incomplete.
The current account cannot manage Hyper-V; actual target existence and shutdown
behavior remain unverified. No administrator VM/SSH handoff has been supplied.

| Option | Benefit | Weakness |
| --- | --- | --- |
| Keep a manual checklist only | No code to maintain | Easy to miss configuration drift |
| Extend bounded read-only checks | Repeatable failures before automation | Cannot prove identity, isolation or actual shutdown |
| Enable a live executor now | Would advance power automation | Missing trusted handoff, ownership and drain protocol |

Use the second option. Final stack: private handoff record, independent expected
target IDs, fresh host configuration and guest-local observations, then a later
authenticated executor with durable ownership and verified drain. No imported
record, UUIDv7, fingerprint match or positive preparation result grants authority.

## Source-backed boundaries

- Require `AutomaticStartAction: Nothing` and `AutomaticStopAction: ShutDown`.
  The latter is the policy for host shutdown, not a job cleanup mechanism.
  [Microsoft VM settings](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vm?view=windowsserver2025-ps)
- Query the selected VM's documented `Shutdown` integration service and require
  exactly one boolean enabled observation. Missing/localized/unsupported results
  are unavailable, not an arbitrary service fallback. This observes host enablement,
  not guest health or protocol negotiation.
  [Microsoft integration query](https://learn.microsoft.com/en-us/powershell/module/hyper-v/get-vmintegrationservice?view=windowsserver2025-ps)
- Microsoft requires integration support on both host and guest. Add a bounded
  guest-local observation of the shutdown VMBus class bound to `hv_utils`, not
  merely presence of an arbitrary Hyper-V module. Even that does not demonstrate
  successful shutdown.
  [Integration services](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/manage/Manage-Hyper-V-integration-services),
  [Linux driver](https://github.com/torvalds/linux/blob/master/drivers/hv/hv_util.c),
  [Linux class format](https://github.com/torvalds/linux/blob/master/drivers/hv/vmbus_drv.c),
  [Linux VMBus interface](https://github.com/torvalds/linux/blob/master/tools/hv/lsvmbus)
- Record a single Ed25519 public host key and its independently reviewed SHA-256
  fingerprint. Checking their internal consistency is not authenticating a host.
  Future transport must pin the reviewed key and disable interactive fallback.
  [OpenSSH client configuration](https://man.openbsd.org/ssh_config.5)

## Handoff contract and privacy

The version-1 record contains a UUIDv7 handoff ID, VM/switch GUIDs and SSH literal
private address, port, non-root user, Ed25519 public key and fingerprint. It has
no passwords, private keys, approval flags, executable commands or arbitrary
options. Host-assigned GUIDs are not new application database IDs. No table is
created. Separate explicit target arguments prevent accidentally accepting a
record for a different selected VM/switch.

Use an explicitly chosen absolute local file, at most 4 KiB. Accept compact or
two-space JSON (LF/CRLF), rejecting duplicate keys by canonical round-trip rather
than silently choosing the last value. Reject unknown fields, bad types, public
or nonliteral addresses, malformed SSH key wire encoding and inconsistent hashes.
Private addresses do not prove host-only routing or firewall isolation.

Read only a canonical regular, single-link file, without following a final
symlink; reject linked prefixes, directories, special files, changed metadata,
oversize data and invalid UTF-8. Use nonblocking open where supported, a bounded
descriptor read and guaranteed close. On Unix require current ownership and no
group/other access. Windows ACL privacy still requires administrator review; do
not pretend POSIX mode bits verify a Windows ACL. Store real records outside Git
or in ignored local storage. Never print their values, file paths or raw errors.
This is a local-file reader, not a remotely mounted storage qualification tool.

## Versioning, failure and verification

Preparation profile/result version 2 adds the on-demand requirements. Legacy or
incomplete observations fail unavailable. Existing resource checks and explicit
guest-local Docker selection stay intact. All modes retain `studyReady: false`
and `liveOperationsEnabled: false`; handoff authentication remains false.

One explicit invocation performs read-only work: no scheduler, retries, cooldown,
cached approval, remote write or ownership lease. Existing process probes retain
their 10-second/64-KiB bounds. Guest sysfs observations cap device count at 128
and each class read at 40 bytes; changing/missing/unreadable inventories fail
unavailable. Two matching reads are not an atomic snapshot or proof against a
privileged host/guest attacker. No age implies
freshness or permission. Re-run after source, configuration or handoff changes.

Test missing/legacy/forged records, every required field, duplicate keys, unknown
approval fields, target/key mismatch, file replacement/links/permissions/limits,
unavailable observations and sanitized CLI exits. Use synthetic keys/records and
native restricted-container tests. Rebuild the clean committed image without
cache; do not replace the normal application. Keep design and outcome separate.

Next: administrator-reviewed real handoff and native qualification, followed by
authenticated host/guest execution, durable ownership, cancellation/deadlines and
independent drain evidence. No amount of format validation replaces those gates.
