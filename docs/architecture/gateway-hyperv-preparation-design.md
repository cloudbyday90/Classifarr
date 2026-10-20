# Gateway Hyper-V preparation design

## Agreed scope

Confirmed on 2026-10-20: prepare a local Linux Hyper-V environment, not provision
or use it. Deliver a fixed profile, administrator guide and read-only ESM checks.
Do not create/start a VM, grant permissions, configure networking, run inference
or an archive study, or touch Unraid/shared Ollama. No application behavior,
database, retry budget, container limit or release changes are included.

The last shared-engine comparison stopped correctly after its first arm because
an unrelated container changed. Separate Docker contexts were not separate engines.
A dedicated guest can separate deployment lifecycles, but still shares physical
CPU/storage with Windows. It cannot by itself make timing uncontaminated.

## Contract

The versioned profile specifies Generation 2, four virtual CPUs, static 8 GiB
memory, one fixed 64 GiB VHDX and one measurement adapter on an explicitly selected
Internal switch. Access is host-only public-key SSH. Setup Internet access is
temporary and must be removed and verified before measurement. Fixed allocation
is a starting envelope, not a measured build-capacity guarantee.

The CLI has three explicit, non-mutating modes:

- `--profile`: validate the committed plan; no system probes.
- `--host --vm-id GUID --switch-id GUID`: query only the selected local Hyper-V
  VM and switch. Check configuration, disk allocation, network attachment and no
  checkpoints. Never enumerate a target by a guessed name or elevate on failure.
- `--guest --revision SHA`: run inside the eventual Linux checkout. Check native
  UID/GID 1000, Node 24.21+ within major 24, exact clean Git revision, and a local
  Linux/x64 Docker engine with four CPUs, cgroup v2 and required controllers.
  Report checkout filesystem free space diagnostically; it is not build proof.

Each result distinguishes `matched`, `mismatch`, and `unavailable`. Missing,
malformed, denied, oversized and timed-out observations are unavailable, not zero
or successful. Invalid CLI inputs fail before probing. Exit 0 means only that the
requested preparation checks matched; exit 2 means incomplete/mismatched checks,
and exit 1 means invalid invocation/plan. Every result has `studyReady: false`.
No JSON receipt can grant readiness, and there is no imported-evidence CLI mode.

Commands are fixed read-only queries, use no shell for guest commands and a
constant encoded PowerShell query with validated GUID literals on Windows.
PowerShell strict mode refuses missing properties before boolean/numeric casts
can turn unknown values into plausible defaults.
Capture is bounded to 64 KiB and ten seconds per command; a guest check uses
three commands (30 seconds total command time). Git fsmonitor and optional index
refreshes are disabled for these reads. No retries, saved scheduling
state, provider calls or persistent identifiers/tables are added. Repeating a
check is safe; interrupted checks do not need recovery or reset attempt limits.
Only allowlisted statuses and filesystem free bytes are printed, not raw command
errors, VM names, addresses, paths, keys, environment, Git file lists or Docker
metadata. A trusted administrator still controls the host and local executables.

## Deliberately incomplete readiness

Matching an Internal switch does **not** prove absence of NAT, bridging,
forwarding or Internet/LAN reachability. A local Unix socket does not establish
VM ownership or guest/host identity. Administrator review must bind the VM GUID,
disk, switch, guest SSH host key and checkout/image to the intended environment.
The setup guide requires IPv4/IPv6 isolation and effective SSH configuration review.

Before any study, a separate implementation must preserve the existing guest
engine guard **and** observe Windows interference before/between arms. No such
cross-boundary controller is added here. Queries are not an atomic configuration
snapshot; checks are point-in-time, not continuous monitoring or durable
authorization. Do not weaken the existing stop-after-current-
arm, verified-cleanup, nonzero-exit and no-auto-retry behavior.

## Official research and tradeoffs

Sources identified through MCP search/navigation and opened on 2026-10-20:

- [Microsoft Hyper-V terminology](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/features-terminology):
  an Internal switch includes the host; a Private switch excludes it. Use Internal
  for host-only SSH, subject to routing review, not the technically different Private type.
- [Microsoft fixed-disk performance guidance](https://learn.microsoft.com/th-th/windows-server/administration/performance-tuning/role/hyper-v-server/storage-io-performance)
  and [static memory configuration](https://learn.microsoft.com/en-us/powershell/module/hyper-v/set-vmmemory?view=windowsserver2025-ps):
  preallocation avoids growth-related variability; fixed memory avoids resizing.
  These consume resources upfront and do not reserve exclusive physical cores.
- [Microsoft Get-VHD](https://learn.microsoft.com/en-us/powershell/module/hyper-v/get-vhd?view=windowsserver2025-ps):
  read the actual attached disk rather than infer allocation from its filename.
- [Docker daemon protection](https://docs.docker.com/engine/security/protect-access/)
  and [contexts](https://docs.docker.com/engine/manage-resources/contexts):
  use the guest-local Unix socket, not an exposed TCP daemon or a Windows controller
  pointing to a remote engine with incompatible bind paths.
- [Ubuntu SSH guidance](https://ubuntu.com/server/docs/how-to/security/openssh-server/):
  validate effective configuration before reload and keep a working recovery console.
- [Microsoft Hyper-V performance scope](https://learn.microsoft.com/en-us/windows-server/administration/performance-tuning/role/hyper-v-server/):
  guests still share host hardware. Our conclusion is to retain a coordinated quiet
  window and outer-host checks, not claim a VM eliminates measurement noise.

| Choice | Benefit | Cost / remaining risk |
| --- | --- | --- |
| Dedicated local Hyper-V guest (selected) | Separate Docker lifecycle and filesystem | Shares physical host; setup and administration needed |
| Another Docker context on this PC | Little setup | Same engine; does not solve observed interference |
| Separate physical Linux host | Stronger resource separation | No designated host; higher setup cost |
| Static RAM / fixed VHDX (selected) | Avoid resizing/allocation during measurement | 8 GiB reserved while running; full disk allocated upfront |
| Read-only preparation first (selected) | Repeatable checks without infrastructure side effects | Cannot yet authorize or execute a study |

Final recommendation stack: administrator-owned Generation 2 Linux VM → fixed
4 CPU/8 GiB/64 GiB profile → Internal-switch key-only SSH → guest-local checkout
and Docker → native image qualification → Windows plus guest interference guards
→ separately approved four-arm study. This change implements only preparation.

## Verification

Test exact profile shape, positive and negative configuration observations,
wrong identities, missing/extra devices, denied/malformed/oversized/timed-out
responses, command/argument boundaries and raw-output redaction. Run real CLI
profile checks locally; report Hyper-V permission denial without escalation.
Synthetic Linux observations and native unit tests are not guest qualification.
Keep the [setup guide](../operations/gateway-hyperv-setup.md) and separate
[outcome](gateway-hyperv-preparation-outcome.md) current. Update Unreleased and
commit/push main; do not release or provision anything.
