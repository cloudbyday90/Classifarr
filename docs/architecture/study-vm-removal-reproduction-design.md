# Study-fixture removal reproduction plan

## Agreement and current limits

On 21 October 2026 the user approved preparing this separate plan with better
sanitized error capture, without creating resources, running a reproduction or
accessing either existing VM or its receipt. That approval covered planning only.
The user subsequently approved the pure projector/synthetic-test slice below,
not a native runner, provisioning, target inspection or deletion.
The later host/retention agreement selects this local Hyper-V host and bounded
read-only inventory/configured-drive checks, including the retained VMs, for a
future separately approved run. It accepts retention of at most one new fixture
and its private evidence if cleanup is uncertain. This settles planning choices,
not implementation or execution authority; no inventory check is authorized now.
The user subsequently approved and received the separate
[mock-only runner preparation](study-vm-removal-simulation-design.md). That
implementation models ordering and failure evidence in memory; it adds no native
runner, persisted receipt, provider query or execution authority.
The existing removal attempt stays consumed and its sources/bindings stay frozen.
No permission exception, service/logging change, network/power operation,
Unraid/shared Ollama access, application change or release is included.

The [completed diagnostic](study-vm-fixture-execution-outcome.md#completed-administrator-receipt-and-vmms-capture)
verified saved/current identity and an off VM but found zero candidates in its
bounded channel/provider/time query. Richer original errors were not persisted.
Changing GUID matching, repeating that query or checking another session's error
history cannot recover the missing child-runspace ErrorRecord. Cause remains
unknown; a future failure with similar numbers would not by itself prove it.

## Options and recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Retain evidence and stop | No additional host/VM effects | Cause and study prerequisites remain unresolved |
| Pure capture contract and mocked tests first | Qualifies privacy, failure preservation and bounds without VM access | Implemented slice; cannot reproduce Hyper-V behavior |
| Separately approved fresh disposable reproduction | Can capture evidence at the actual future failure | New resources and destructive effects; may not reproduce and may leave an off fixture |
| Replay retained cleanup or relax protections | No new fixture needed | Consumed authority and uncertain effects; rejected |

Recommendation stack: preserve the existing evidence and qualified pure capture;
record the selected host/read scope and retention policy; agree the next disabled
preparation slice; qualify it without native execution; review exact bindings and
obtain separate execution agreement. No fresh install or normal
application operation schedules this work. There is no retry/backoff/cooldown
queue: a consumed native attempt cannot be restarted or automatically replaced.

## First implementation slice: no native capability

Small ESM files implemented after separate confirmation of this slice:

- `scripts/lib/vmRemovalErrorContract.mjs`: strict, bounded public DTO validation
  and projection; no process, filesystem, network or target access.
- `scripts/lib/vmRemovalErrorQuery.mjs`: pure PowerShell 5.1 catch-projection
  function source, not a command launcher or VM operation query.
- `scripts/__tests__/vm-removal-error-contract.test.mjs`: JavaScript adversarial
  contracts and isolated in-memory PowerShell ErrorRecord/exception fixtures.

Check existing execution/maintenance helpers before implementation. Reuse the
existing bounded capture transport only for benign pure-function test children;
no Hyper-V/Storage import, native metadata helper or existing target binding is
needed. Do not add an apply CLI, environment enablement, automatic script action,
new dependency, public endpoint or large singleton service.

### Primary error and privacy contract

At the future operation's catch boundary, save the original ErrorRecord before
projection, journaling or disposal can fail. Keep its semantic operation/stage
and source-query hash. A new script line number is not the old query's line 364.
Primary operation evidence and secondary projection/journal/dispose failures
must occupy separate fields; a finally failure cannot overwrite the primary.

The pure JavaScript functions project one detail, construct a report and append
secondary failures immutably. They accept only bounded own-data fields on plain
JSON-like objects; accessors, proxies, inherited fields, sparse arrays and invalid
relationships are rejected with an opaque error. Unknown extras are not read or
serialized. An invalid secondary detail becomes unavailable/projectionFailed
without replacing the validated primary. The operation label is not evidence
that an operation ran; no ownership, absence, mutation or cleanup claim exists.

Allow only finite classifications, booleans and validated numeric codes in public
output or the sanitized diagnostic record. Proposed fields are schema version,
operation/stage enums, numeric ErrorCategory, finite error-ID classification,
bounded exception nodes, completeness flags and separately bounded secondary
failures. Each node retains its own signed 32-bit HRESULT and a finite type label.
Normalize unsigned display only as a separate explicit representation. Read
NativeErrorCode only from an actual Win32Exception; neither a generic HRESULT
nor its low bits establish a Win32 cause. Unknown types/IDs map to other, not a
raw string. Missing fields remain unavailable, not zero/none assertions.

Use at most six unique exception nodes across the entire traversal, not six per
branch, with reference-identity cycle detection. Embedded ErrorRecords and
ParentContainsErrorRecordException placeholders need explicit handling and
tests; follow only reviewed concrete types/properties. Unsupported wrappers,
getter failures, cycles and exhaustion report partial/unavailable detail.
Arbitrary provider interfaces or script properties must not be invoked through
generic reflection or object expansion. A complete bounded projection is not a
complete provider diagnosis.

Implemented extraction uses cached fixed CLR members, not ETS/PowerShell adapter
properties. Only an exact RuntimeException may supply its overridable embedded
ErrorRecord getter; unreviewed IContainsErrorRecord implementations remain
unsupported. Exact ErrorRecord inputs are required; remoting/unknown subclasses
are not silently treated as qualified inputs. No Message/Data getter is read.

Each extraction admits at most six exception objects and six ErrorRecords.
Private reference edges are retained even for visited objects, then a bounded
reachability closure detects cycles among at most twelve admitted vertices.
First-path ancestry alone was insufficient for cycles behind shared shortcuts.
Repeated acyclic sharing is not labeled a cycle. Refused over-budget traversal
is partial even when a hidden cycle cannot be inspected.

The JavaScript report additionally caps all emitted nodes across primary and up
to four secondary entries at six, preserving primary priority and marking
secondary truncation. Independent extractor calls do not share a traversal
context: the global six-node output cap is not a claim of six total getter reads
across future multiple calls. No native caller/composition is implemented.

Never serialize or print the ErrorRecord/exception graph. Do not emit messages,
ErrorDetails text, unknown FullyQualifiedErrorId/type names, TargetObject,
InvocationInfo source/definition, stack traces, arbitrary Exception.Data, paths,
GUIDs, SIDs, accounts or hostnames. Length limits alone do not sanitize strings.
Exact reviewed ID comparisons may examine at most 2,048 characters; oversize or
unknown values remain unclassified. Presence flags may describe known typed
fields without traversing their contents. Do not hash arbitrary private text or
dump raw errors to another file as a diagnostic fallback. This deliberately
trades some explanatory detail for privacy; generic-only results remain possible.

Pure tests must cover valid/no-error input, invalid DTOs, private extras, nested
Win32 codes, each-node HRESULT preservation, placeholders/embedded records,
cycles, over-depth/oversize input, unsupported values, secondary failures and
simultaneous primary plus journal/disposal failures. Real PowerShell test inputs
must be synthetic in-memory objects. AST inspection must exclude target/provider
commands; no existing VM/receipt access is allowed as a test convenience.

## Future reproduction: proposal, not an execution agreement

### Environment and identity gates

An isolated namespace is not an isolated Hyper-V engine. Existing foreign-disk
guards enumerate bounded VM inventory and read other VMs' configured drives.
On 21 October 2026 the user selected this existing local Windows Hyper-V host,
including bounded read-only inventory and configured-drive checks of both
retained VMs in a future run. Keep names, GUIDs and configured paths private;
publish only bounded counts and finite outcomes. This is not permission to read
their receipts, inspect their disk contents, change them, or run those checks now.
Remote hosts, credentials and cluster discovery are outside this selection.

Same-host preparation avoids designating another machine and retains comparable
host conditions; its cost is shared provider state and limited isolation. An
independent host remains an alternative requiring a new agreement, not a hidden
fallback. Do not silently omit foreign-reference checks or skip inaccessible VMs.
No separate host is designated or provisioned by this plan.

Source review of the old recovery guards found 128 accepted VMs with a 129th
sentinel, unique nonempty GUID checks, at most 64 configured drives per other VM
with a 65th sentinel, and at most 1,024 drives combined per pass. These are
existing source bounds, not newly executed observations or a whole-run budget.
The path comparison is ordinal case-insensitive equality only. It does not prove
absence of snapshot, differencing-parent or alias references. Future preparation
must document this limitation, qualify finite pass/phase budgets and refuse
unsupported cases rather than claim exhaustive physical-file non-use. Broader
snapshot/other-disk inspection is not implicitly selected by this agreement.

If a live experiment is later agreed, propose one new UUIDv7 fixture with a new
private envelope, exact reviewed local paths and source/target bindings. Never
reuse either existing name, GUID, path, fingerprint or receipt. The old fixture
and recovery modules embed that old identity and cannot be invoked unchanged as
a fresh-target tool. Record the returned created GUID durably before later VM
work. A failed/uncertain creation or identity-record write stops; it does not
authorize adoption by name, inferred ownership or deletion.

Proposed matching resource profile is one Gen2 VM with 512 MiB startup memory,
one fixed 128 MiB blank VHDX, no OS/ISO/checkpoints, an unconnected adapter,
automatic startup disabled and shutdown configured as the stop action. It never
boots or connects. These are fixture resources, not the real study VM's
4-vCPU/8-GiB/64-GiB profile. Validate storage/capacity, protected ownership, exact
reviewed ACL policy and unexpected native-created grants before admitting work;
do not repair parents, weaken permissions or infer a global capability exception.

### Preserve experimental conditions

The original qualification created/attached/configured and attempted cleanup in
one child. The later observed removal failure occurred in a fresh recovery child
with a root pin and an open protected receipt after flushed claim/intent records.
A fresh same-process create/remove test is a different experiment.

Propose separate creation, read-only admission review and one later removal
process for a new fixture. Match the observed root-pin mode (GENERIC_READ,
read/write sharing, no delete sharing) and receipt mode (CreateNew, write access,
FileShare.Read, WriteThrough plus explicit flush). Preserve the guarded fresh
snapshot and exact-VM-object removal sequence. Do not release a guard, change
sharing, add Force/AsJob or switch to a raw provider deletion method to obtain a
different outcome. File sharing rules do not establish that either handle caused
the old failure. Hold host/module/toolchain/ACL choices fixed and record reviewed
version/profile information; any future changed factor needs its own agreement.

Before a live run, its separate design must qualify durable created identity,
source bindings, current off/disconnected/checkpoint-free state, native file/disk
identities, bounded tree, foreign references and collision/one-shot admission.
The user accepted the policy of retaining at most one new off, disconnected
fixture and its private evidence on refusal or uncertain cleanup, with no retry,
replacement fixture, permission repair or forced deletion. This is not approval
to create that fixture or to enforce quarantine through power operations.

Quarantine is a stop-for-review policy, not proof that all desired settings were
established. Both existing creation flows can fail after New-VM but before
verifying identity/adapter state or disabling automatic startup/checkpoints;
neither durably records the returned GUID at that boundary. A failed or ambiguous
creation must report identity/configuration/state as unconfirmed where evidence
is missing, never infer a fully configured off fixture from the absence of a
Start-VM command. Preserve uncertainty and stop without another creation or
cleanup attempt. This early-failure case needs explicit review before any live
creation agreement. No script can guarantee successful removal or safe cleanup.

### Approved disabled preparation slice

After confirmation of shared implementation scope, implemented a separate
disabled ESM runner in small modules, with synthetic plans and data-only mock
adapters. See its separate [design](study-vm-removal-simulation-design.md) and
[outcome](study-vm-removal-simulation-outcome.md) for exact evidence and limits.
There is no live CLI, environment-variable enablement, administrator command or
native transport connection in this slice. Importing it or running its tests
must not import providers, query inventory or access existing targets/receipts.
Do not generate a real target binding or change the frozen old modules.

Keep creation, read-only admission and later one-shot removal as distinct phases.
Model creation intent, returned synthetic identity recording and bounded
journal transitions before permitting later mocked resource effects. Creation,
short-write/flush, settings or capture uncertainty stops the sequence; no adoption
by name, replay, automatic cleanup or replacement fixture follows. Preserve
primary/secondary errors using the implemented projector. Exact future native
paths, supported reference checks, phase budgets and execution bindings still
need review; mock success cannot satisfy a native admission predicate.

Tests cover collisions, malformed/duplicate identities, inventory limits,
foreign configured paths and failed observations, partial creation/settings,
identity-write failure, prior/partial journal records, concurrent claims, source
drift, cancellation/timeout, simultaneous primary/secondary failures and retained
unknown state. Use only synthetic objects and owned temporary test files where
needed; any PowerShell test is AST/in-memory only, never a provider rehearsal.
This preparation cannot establish the old cause or qualify live cleanup.

### Proposed execution and evidence limits

| Boundary | Proposed contract to qualify before any live execution |
| --- | --- |
| Concurrency and retry | One fixture, one command launch per phase, one removal call; no replay/restart/resume or automatic replacement fixture |
| Capture | Fixed hidden shell-free local PowerShell 5.1; filtered environment; five-minute child timeout; 64 KiB aggregate captured output |
| Error detail | Six unique exception nodes, bounded classifications, at most four secondary error entries; truncation explicit |
| Diagnostic record | At most 32 KiB sanitized JSON; size refusal preserves uncertainty rather than dropping primary error silently |
| Private journal | CreateNew, protected exact scope; at most 512 KiB total and 64 KiB per record; bounded record count to be derived from the reviewed operation list |
| Resource cleanup | Only exact fresh-fixture subjects with flushed intents, verified identities and confirmed absence; never recursive/force or finally-block removal |

Flush an intent before each external effect. Capture primary error immediately
and append its sanitized projection before ordinary handle disposal. Preserve
separate UTC correlation timestamps and monotonic elapsed duration; timestamps
are not historical authentication. Keep private identity bindings out of public
diagnostics and outside VM-managed configuration descendants. Record every
attempt and uncertain result without claiming that a journal append succeeded
when it failed. A short write, process exit or timeout may still lose detail.
Do not promise rollback, provider cancellation or power-loss durability.

On an operation error, capture failure or drift, stop without later payload
deletion. After a successful call, independently confirm VM absence and all
remaining-file/disk/reference predicates before any separately scoped exact
payload cleanup; retain the root and journal. Missing evidence cannot become
absence, zero attempts or cleanupComplete. Disposal is not rollback. A process
restart with a prior claim/unknown effect stops for review, never reacquires
authority. No second removal call is an error-capture fallback.

Success claims must distinguish capture qualification, native result, verified
cleanup and causation. A failed removal with preserved bounded evidence is not
cleanup success; a successful new removal is not remediation of the retained
fixture; neither outcome proves the old cause or real study readiness. WhatIf
does not execute Remove-VM and cannot reproduce its provider-side failure.

## Verification and next gate

The planning deliverables and the subsequently approved pure implementation are
recorded separately in the outcome. Run `npm run test:tooling:vm-errors`; it is
also wired into local preflight and the actual CI workflow. Portable contracts
run everywhere; installed PowerShell 5.1 synthetic/AST cases run only on Windows
and are explicitly skipped elsewhere. These do not qualify native Hyper-V.

Host/inventory scope and the intended retention policy are settled for planning,
and the separately approved mock-only preparation is implemented. Its in-memory
acknowledgements do not qualify native identity persistence or journal durability.
The next gate is a separately scoped native-integration design, following the
repository's grill-me workflow. No native runner has been implemented and
there is no apply command to hand off. Exact new paths, created-identity
durability, reference-check coverage, native guard/receipt bounds, early-failure
retention and execution authority remain later review gates. No host/VM readiness,
current off state or permission safety is newly asserted by this agreement.

## Official sources and limits

Discovered/opened through search MCP on 21 October 2026:

- [PowerShell 5.1 try/catch/finally](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_try_catch_finally?view=powershell-5.1)
  supports catch-boundary error handling; finally may run after an error and
  cannot substitute for durable evidence before abrupt termination.
- [ErrorRecord contract](https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.errorrecord?view=powershellsdk-1.1.0)
  documents richer fields and embedded/placeholder behavior. It is not a license
  to expose those fields or a promise of complete Hyper-V error detail.
- [Win32Exception.NativeErrorCode](https://learn.microsoft.com/en-us/dotnet/api/system.componentmodel.win32exception.nativeerrorcode?view=netframework-4.8.1)
  defines the typed numeric code; do not infer it from unrelated HRESULTs.
- [Exception.Data](https://learn.microsoft.com/en-us/dotnet/api/system.exception.data?view=netframework-4.8.1)
  permits user-defined entries, supporting exclusion of arbitrary data graphs
  from the bounded public projection.
- [Remove-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/remove-vm?view=windowsserver2025-ps)
  separates configuration removal from virtual disks and states that WhatIf
  does not execute the cmdlet. Require no checkpoints; do not rely on merging.
- [CreateFileW sharing](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew)
  explains compatibility of access/sharing on an opened object, not the provider's
  undocumented descendant operations or the cause of this failure.
- [Get-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/get-vm?view=windowsserver2022-ps)
  documents local inventory and ID selection, not an atomic name reservation.
- [Get-VMHardDiskDrive](https://learn.microsoft.com/en-us/powershell/module/hyper-v/get-vmharddiskdrive?view=windowsserver2025-ps)
  documents attached-drive retrieval for VM objects; it does not establish
  exhaustive physical-file non-use from configured-path comparisons.
- [New-VM](https://learn.microsoft.com/en-us/powershell/module/hyper-v/new-vm?view=windowsserver2025-ps)
  returns a VirtualMachine object and permits omitting a switch connection.
  Persisting returned identity before later work is this design's requirement,
  not a transactional durability guarantee supplied by that cmdlet.

These references guide a future contract. Installed PowerShell/.NET/Hyper-V
behavior still needs scoped qualification; no module/toolchain update is part of
this plan. No authoritative complete provider exception graph was established.
