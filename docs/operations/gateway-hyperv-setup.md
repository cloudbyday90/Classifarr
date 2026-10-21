# Gateway study VM: administrator preparation

This is a setup/handoff guide, **not** authorization to provision or run a study.
Preparation checks remain read-only. The separate, explicit administrator-run
creator below can create a new powered-off VM after target approval. Read the
[design and tradeoffs](../architecture/gateway-hyperv-preparation-design.md) first.
The [handoff-check design](../architecture/vm-handoff-checks-design.md) explains
the version-2 preparation checks and their remaining trust boundaries.
Keep existing applications, Unraid, shared Ollama and Windows security services unchanged.

## 1. Record the target before changing anything

An authorized administrator must select a dedicated VM location and unused name,
check host RAM/free disk space again, and confirm every new target is absent.
Do not overwrite an existing VM/disk/switch or reuse a production resource.
Keep a private handoff record of the VM GUID, owned disk path, Internal switch GUID,
host/guest addresses and SSH host-key fingerprint. Do not commit keys, passwords,
IP inventory or local storage paths. Hyper-V assigns its own resource GUIDs;
these are not new Classifarr database IDs.

Current-user Hyper-V access was denied during planning. This package neither
elevates nor changes group membership. Administrator management remains separate
from routine guest SSH. Stop if resources or ownership are uncertain.

## 2. Create only the reviewed resources (administrator, later)

Use Hyper-V Manager or the one-shot creator below for the dedicated Generation 2 Linux VM with the
[committed profile](../../scripts/fixtures/gateway-hyperv-profile.json):

| Setting | Planned value |
| --- | --- |
| Virtual processors | 4; not exclusive physical cores |
| Memory | 8192 MiB startup; Dynamic Memory off |
| Disk | One new fixed-size 64 GiB VHDX; not dynamic/differencing |
| Measurement network | One adapter on a dedicated Internal switch |
| Access | Host-only SSH, public keys, verified host key |
| Automatic start action | `Nothing`; on demand, no host-boot automatic start |
| Automatic stop action | `ShutDown`; not save state or power-off |
| Shutdown integration | Enabled on the host; guest channel binding observed separately |

### Explicit powered-off creator

Only after the administrator and user agree the exact targets, use
`scripts/create-gateway-study-vm.mjs`. See its separate
[design and tradeoffs](../architecture/study-vm-creation-design.md) and
[verification outcome](../architecture/study-vm-creation-outcome.md).
It creates no switch and leaves the default adapter disconnected; network/guest
installation and final preparation checks are later steps, not relaxed checks.

Supply actual existing, reviewed local parent folders, not these placeholders:

```text
node scripts/create-gateway-study-vm.mjs --plan --vm-parent "C:\Reviewed\VmParent" --disk-parent "D:\Reviewed\DiskParent"
node scripts/create-gateway-study-vm.mjs --create --vm-parent "C:\Reviewed\VmParent" --disk-parent "D:\Reviewed\DiskParent"
```

`--plan` is pure and displays derived paths locally. It does not inspect the
host, authenticate an administrator, reserve names or authorize creation.
`--create` must run in an already-authorized Administrator PowerShell session.
The restricted child process derives its local hostname from Windows instead of
trusting caller `COMPUTERNAME`. Missing identity must block, not imply an empty VM
inventory. See the [identity correction](../architecture/study-vm-local-identity-design.md).
It derives `Classifarr-Study` children and a `Classifarr-Study.vhdx` disk, refuses
existing targets, checks ancestors/ACLs and fresh capacity, restricts only the
new directories and configures only the new VM. It does not alter parent ACLs or
host defaults, start a VM, attach a switch/ISO, elevate or install software.
The [private-directory refinement](../architecture/study-vm-directory-design.md)
recognizes only the reviewed non-inheriting parent create rule for All Virtual
Machines. It does not trust that group generally or grant it child access. New
child permissions are protected at exclusive creation, not repaired afterward;
existing files/folders/junctions still refuse. Never remove a shared Hyper-V
permission to make the creator pass, or add a broader allow rule.
Hidden Windows ancestors are included by the creator's literal metadata read.
Do not unhide system folders or create a replacement for an ancestor reported as
missing. A preflight observation remains separate from successful creation.

Allocation may take several minutes. The single command budget is 15 minutes;
output is bounded to 64 KiB and there are no automatic retries. Exit 0 means
`planned` or verified `created_off`, depending on mode; 1 means invalid arguments;
2 means blocked or `review_required`. After timeout, cancellation, malformed
output or any possible partial creation, stop and inspect the targets. The
Hyper-V/storage service might still be completing a write even after its caller
exits. Never blindly rerun, delete partial resources, or treat a status as
rollback. A blocked permissions result needs review, not a broad permission fix.

`created_off` includes the actual returned Hyper-V VM GUID for private follow-up.
It does not establish guest readiness, SSH authentication, safe runtime shutdown
or study approval. The full `--host` preparation check will not yet match without
the separately reviewed Internal switch and installed guest.

Configure this owned VM not to start automatically when Windows starts. It should
be off between jobs, not a continuously running background service. Verify guest
shutdown integration before using graceful shutdown; do not force power-off or
save state when drain/cleanup is uncertain. The current tooling cannot operate
its running power state. The creator only produces an off VM; see the
[on-demand lifecycle design](../architecture/on-demand-study-vm-design.md).

The full disk is allocated upfront; memory is reserved while running. Keep room
for Windows and normal applications. 64 GiB is an estimate, not a validated build
minimum. Avoid checkpoints/backup jobs during measurement; turn off automatic
checkpoints for this owned VM and retain its disk/results after tests. Do not
delete checkpoints or disks belonging to another workload.

Use a current official Ubuntu Server LTS amd64 installer, verify its published
checksum/signature, and record its exact version and digest privately. See
[Docker's supported Ubuntu versions and installation procedure](https://docs.docker.com/engine/install/ubuntu/?login=from_csdn).
Retain Secure Boot using the appropriate Linux certificate template; consult
[Microsoft's Generation 2 security settings](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/learn-more/Generation-2-virtual-machine-security-settings-for-Hyper-V)
if the guest does not boot. Do not disable host security as a troubleshooting shortcut.

## 3. Separate setup connectivity from measurement

An **Internal** switch permits host/guest access. The Hyper-V switch type named
**Private** does not permit host SSH. Internal alone does not prove isolation:
an administrator must check for NAT, bridging, routing/forwarding and both
IPv4/IPv6 paths. Do not assign an arbitrary subnet or modify the shared Default
Switch, host LAN adapter, VPN or other project switches.

Temporary Internet access may be used to install updates, OpenSSH, Git, the pinned
Node 24.21.x/npm 12.2 toolchain and Docker Engine, and prepare source/images. Use
official package repositories, not an unreviewed script piped into a root shell.
Then detach only the owned setup adapter. Retain exactly the intended Internal
adapter, configure the agreed host-only addresses, and review guest/host firewall
rules to permit SSH only from the host. Verify no LAN/Internet route or reachability
in either address family, not just failure of one public ping. DNS/ICMP failure
alone is not an isolation test. Document the checks and their limits privately.

Never expose a Docker TCP API or publish fixture database/provider ports.
Docker port publication can bypass common guest firewall rules; avoid it rather
than relying on those rules alone. No host/shared media folders, production
credentials, Docker Desktop socket or shared Ollama access belongs in the guest.

## 4. Prepare the native controller

Create the dedicated non-root guest account with UID **and** GID 1000, as required
by existing worker/fixture file ownership. If those IDs are already occupied,
stop and review rather than renumber another account. The guest controller needs
guest Docker access; treat that as root-equivalent authority confined to this VM.
Keep Docker on its local Unix socket, with no TCP listener.

Use a real Git checkout on the guest Linux filesystem, not a Windows share. Pin
the intended committed revision and build/transfer its exact source-bound image
before disconnecting Internet. Record image identity and source revision; labels
alone are not provenance. Later native smoke tests must verify cgroup limits,
memory/disk headroom, image behavior, restore isolation and cleanup. No study is
authorized by this preparation step.

Configure SSH keys and verify the guest host key from its trusted console before
adding it to the host's known-hosts file. Require strict host-key checking, no
password/root login and no agent forwarding; preserve console recovery. Validate
the effective SSH configuration (`sshd -t` and appropriate `sshd -T`/Match review)
before reload and test a second key-based session before closing the first.
Follow [Ubuntu's OpenSSH guide](https://ubuntu.com/server/docs/how-to/security/openssh-server/).
Do not disable unattended security updates permanently; schedule setup/updates
outside a measured window and record unexpected activity as interference.

## 5. Repeatable read-only checks

From this repository, no credentials or environment variables are required:

```text
node scripts/check-gateway-vm-preparation.mjs --profile
node scripts/check-gateway-vm-preparation.mjs --host --vm-id <actual-VM-GUID> --switch-id <actual-Internal-switch-GUID>
```

Run the second command on Windows under an already-authorized account; it does
not request elevation. Substitute actual handoff GUIDs, not the literal angle
brackets. The check queries only that VM/switch and projects sanitized statuses.
Missing/denied/malformed/timeout observations are `unavailable`, not success.
The version-2 profile adds automatic start/stop policy and host shutdown-service
enablement. A localized/unsupported `Shutdown` service query is unavailable;
the checker does not guess another service or change any setting.

Inside the eventual guest checkout:

```text
node scripts/check-gateway-vm-preparation.mjs --guest --revision <exact-40-character-commit-SHA>
```

This always selects `unix:///var/run/docker.sock` explicitly and ignores Docker
environment overrides; it does not switch contexts. Run from the guest, not a
Windows controller pointed at a remote engine. The filesystem-space number is
diagnostic, not a sufficient build/restore capacity check.
The guest also reads the fixed Linux VMBus sysfs interface twice, with at most
128 devices and 40 bytes per class read. It requires one shutdown-class device
bound to `hv_utils`. A missing interface, unreadable observation or changed
inventory is unavailable. A stable absent channel or different driver is a
mismatch. These are separate observations, not an atomic snapshot, a host/guest
identity binding or proof of successful shutdown. No module is loaded and no
shutdown request is sent.

Exit 0 = requested preparation observations matched; 2 = mismatch/unavailable;
1 = invalid invocation/profile. `studyReady`, `liveOperationsEnabled` and
`handoffAuthenticated` are **always false**. Process queries have
10-second/64-KiB limits, no retries and no resource/configuration writes; no imported JSON can override
the missing readiness gates. Output excludes raw names, paths, keys and errors.
Re-run after configuration changes; a previous result is not persistent consent.

## 6. Private handoff record — format checks only

An administrator may prepare one version-1 JSON record after independently
reviewing the real target and console host key. This tooling does not create the
record, generate keys, change known-hosts files or open an SSH connection.

| Required field | Value |
| --- | --- |
| `version` | Integer `1` |
| `handoffId` | New lowercase time-based UUIDv7; a record identifier, not approval |
| `vmId`, `switchId` | Actual nonzero Hyper-V GUIDs |
| `ssh.address` | Literal RFC1918 IPv4 or ULA IPv6 address; not a hostname or scoped address |
| `ssh.port` | Integer 1–65535 |
| `ssh.user` | Non-root lowercase account, at most 32 simple ASCII characters |
| `ssh.hostKey` | One `ssh-ed25519` public key, no comment or options |
| `ssh.hostKeyFingerprint` | That key's `SHA256:` fingerprint, no padding |

Use exactly those fields, with all five SSH fields inside `ssh`. No private key,
password, command, approval flag or free-form note belongs in the file. Serialize
as compact or two-space JSON, optionally one final newline (LF or CRLF). Other
JSON formatting and duplicate keys are rejected. This deliberately narrow format
avoids different parsers silently choosing different values.

Store it outside Git, in an administrator-reviewed private directory on a local
filesystem. Use its absolute canonical path, not a symlink, junction, hard link,
network share or alternate stream. The reader accepts only a regular single-link
file of 1–4096 bytes, checks metadata around a bounded read and rejects invalid
UTF-8 or replacement. It cannot qualify remotely mounted storage or defeat a
privileged attacker changing the filesystem. Keep directory ownership/ACLs safe.

On Unix, require ownership by the current user and no group/other access (normally
mode `0600`). Windows ACL privacy needs separate administrator review;
`unixFileModeChecked: false` is expected on Windows, not an ACL failure or proof
of privacy. The flag only reports the Unix file-mode check, not directory security.

```text
node scripts/check-gateway-vm-preparation.mjs --handoff --file <absolute-local-record-path> --vm-id <independently-selected-VM-GUID> --switch-id <independently-selected-switch-GUID>
```

Supply the expected target IDs separately. A valid record for a different target
is `mismatch`; malformed, unreadable or unsafe input is `unavailable`. Results
exclude the record's values, paths and raw exceptions. Matching the public key
to its hash only checks consistency: anyone can create such a pair. UUIDv7 and
private IPs prove neither authority nor isolation. No result authenticates SSH,
authorizes power control or bypasses the remaining readiness gates.

## 7. Handoff — stop here

Before measurement, the next change must qualify the real guest and implement
bounded Windows **and** guest lifecycle observations before/between arms. Preserve
the first baseline, stop after the current arm and verified cleanup on a changed
or unavailable observation, and never retry automatically. A VM hides Windows
Docker activity from guest-only checks; it does not eliminate physical CPU/I/O
contention. Coordinate a quiet window without stopping normal applications.

No remote study runner, VM lifecycle controller, production deployment or purge
is included. Retain evidence and report missing checks rather than marking ready.

## 8. Lifecycle logic rehearsal (no VM required)

```text
node scripts/check-gateway-vm-job-lifecycle.mjs --simulate
```

This runs fixed fictional scenarios for owned startup, completed/failed/cancelled
work, verified cleanup, refused adoption, reboot and timeout. Exit 0 means those
model expectations matched, not that a VM is ready or was operated. Every result
sets `liveOperationsEnabled: false` and `studyReady: false`. No environment inputs,
credentials, imported receipts, power commands or live adapter are supported.

A future executor must start only its exclusively owned, initially off VM and
shut it down gracefully only after closing admission, draining all work,
verifying cleanup and rechecking identity. Uncertainty leaves power unchanged
with an actionable failure. A job that did not start the VM must not stop it.
