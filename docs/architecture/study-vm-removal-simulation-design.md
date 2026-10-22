# Disabled study-fixture removal runner design

## Approved scope

On 21 October 2026 the user confirmed the preparation-only implementation:
modular ESM runner, identity-persistence and bounded-journal contracts, and
mocked primary/secondary failure tests. The earlier
[reproduction plan](study-vm-removal-reproduction-design.md) remains the native
proposal. No live launcher, inventory query, real target binding, provisioning,
deletion, power action or existing receipt access is included here.

## Boundary and alternatives

Implement a synchronous, data-driven simulation with separate create, inspect
and remove phase calls. Internal mock adapters interpret finite outcome records;
they never accept executable callbacks. Numeric identities are fictional handles,
not GUIDs, paths or native file identities. Only a fixed synthetic fixture/source
revision is supported. Accessors, proxies, inherited fields and sparse arrays
are refused; unknown private extras are neither read nor serialized.

This is stronger separation than an injectable native executor, at the cost of
not qualifying the eventual native integration. Keeping native query builders or
a disabled apply flag in this slice adds dormant capability without resolving
its safety prerequisites, so neither is included. No scheduler, provider import,
filesystem, process, network, timer, environment flag or runtime caller is added.

## State, journal and identity

One environment owns one in-memory journal and all phase claims. Multiple runner
views share that environment; a second claim cannot replay a phase. This models
exclusive admission in one JavaScript instance, not an OS lock or cross-process
transaction. No journal hydration, reset, resume or replacement fixture exists.
Simulated existing/partial journals refuse work instead of adopting records.

Creation records an acknowledged intent before each modeled effect. Persist the
returned disk identity before VM creation, and the returned VM identity before
configuration. A record is committed only after its modeled full write and flush
acknowledgement. Write/short-write/flush failure poisons the journal and halts the
environment; uncertain records are not counted as committed. Returned identities
may remain visible in memory after failure, but never become recorded identity
or admission authority. Creation/settings/capture uncertainty cannot imply off,
disconnected or startup-disabled state.

Inspection and removal require prior committed creation/inspection respectively,
matching source and recorded identities, complete bounded observations and
positive synthetic off/disconnected/startup/checkpoint/disk/tree predicates.
Configured references and unsupported coverage fail closed. A modeled successful
removal still requires an independent absence observation. Payload/root/journal
deletion is not modeled; simulated VM removal is not complete fixture cleanup.

Every terminal failure halts later phases and retains uncertainty. Cancellation,
timeout and capture loss are explicit scripted outcomes, not real cancellation,
provider termination or elapsed-time measurements. There are no retries,
cooldowns, background queues or automatic transitions into the next phase.

## Bounds and failure evidence

The model permits at most six inventory observations and sixteen adapter calls
across all phases. Each inventory has at most 128 VMs including the synthetic
fixture where applicable, 64 configured drives per other VM and 1,024 per pass;
overflow and duplicate/missing identities refuse admission. Thus the simulated
whole-run configured-drive budget is at most 6,144. It is not an exhaustive
snapshot/differencing-parent/alias reference proof or a native provider-I/O bound.

At most sixteen journal records, 64 KiB per record and 512 KiB total are admitted.
The fixed success sequence uses twelve records; one failure record may follow.
Attempted/committed counts and poisoned state are distinct. Model acknowledgements
do not establish actual persistence, protected ACLs or power-loss durability.

Capture the primary finite projected failure before attempting a failure record
or disposal. Reuse the existing error projector's six-node/four-secondary budget,
but report semantic phase/step separately rather than label every failure a VM
removal. Secondary journal/projection/dispose failures cannot overwrite primary
evidence. Invalid projected details become unavailable without exposing raw text.
Public results stay bounded to 64 KiB and always report simulation mode, no live
operations, no native mutation, no retry, no root-cause confirmation and no study
readiness. Successful simulation never changes those policy fields.

## Verification and next boundary

Portable node:test contracts cover phase ordering, competing claims, every write
boundary and fault outcome, identity/source drift, malformed/private inputs,
inventory/reference limits, partial creation, failed absence verification,
primary plus journal/dispose failures and immutable returned snapshots. Static
import checks exclude native/transport capabilities. Wire tests into local
preflight and the real CI workflow; mocks alone do not qualify native behavior.

Recommendation stack: finish this simulation; review its evidence; separately
design native creation-identity persistence, reference coverage, protected journal
and early-failure retention; then review exact sources/targets before any native
execution agreement. Do not replay the consumed old cleanup or inspect either
retained VM as a convenience. No PR/dependency work, Docker replacement or release
is included in this narrowed slice.

## Official reference

Discovered and opened through search MCP on 21 October 2026:
[Node 24 file-system reference](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html)
documents that sync requests depend on the operating system/device and exclusive
file creation is platform-sensitive. Our inference is that a memory acknowledgement
cannot stand in for native persistence/exclusivity qualification. This model does
not call that API, change Node versions or implement a filesystem journal.
