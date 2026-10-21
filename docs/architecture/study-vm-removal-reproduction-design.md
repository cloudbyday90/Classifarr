# Study-fixture removal reproduction plan

## Agreement and current limits

On 21 October 2026 the user approved preparing this separate plan with better
sanitized error capture, without creating resources, running a reproduction or
accessing either existing VM or its receipt. That approval covered planning only.
The user subsequently approved the pure projector/synthetic-test slice below,
not a native runner, provisioning, target inspection or deletion.
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

Recommendation stack: preserve the existing evidence; implement only the pure
capture contract and mocks after scope agreement; resolve the future host/read
scope and quarantine policy; qualify a separate disabled runner; review exact
bindings and obtain explicit execution agreement. No fresh install or normal
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
Unchanged reuse on this host would therefore access the retained VMs, even when
read-only. That is not covered by this plan's no-target-access scope. Before any
native implementation/execution, separately agree either bounded read-only host
inventory including those VMs, or a designated independent host with its own
capacity/administrator review. Do not silently omit foreign-reference checks.
No separate host is designated or provisioned by this plan.

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
The administrator must accept that one new off fixture and its evidence may
remain quarantined on refusal or uncertain effects. No script can guarantee a
successful Remove-VM or safe automatic cleanup afterward.

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

The next gate is host/inventory scope and quarantine acceptance before any native
runner design/implementation; there is no apply command to hand off. Exact new paths,
created-identity durability, native guard/receipt bounds, quarantine acceptance
and execution authority remain later gates, not silently settled decisions.

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

These references guide a future contract. Installed PowerShell/.NET/Hyper-V
behavior still needs scoped qualification; no module/toolchain update is part of
this plan. No authoritative complete provider exception graph was established.
