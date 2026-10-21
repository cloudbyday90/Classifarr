# One-target study-fixture execution outcome

## Result and authority

Prepared on 21 October 2026 under the approved
[execution-wrapper design](study-vm-fixture-execution-design.md). A separate
private local entry point is execution-capable for the single reviewed current
fixture. Preparation approval did not authorize running it. During preparation,
the agent performed no live apply, elevation, VM/VHD/provider operation or
protected fixture write. The user subsequently gave separate approval for one
administrator execution and supplied its review-required result below. The
existing inspector still refuses apply before launching PowerShell.

The accepted binding is the current-target fingerprint from the successful
[administrator inspection](study-vm-fixture-recovery-outcome.md#limitations-and-handoff),
not a newly observed replacement or historical creator identity. Exact target
values, fixture names/paths and private identities remain in ignored local
material only. The original cleanup failure is still unexplained. The real
study VM, permissions policy, networking and both VMs' power state were not
changed by this work.

## Prepared implementation

Three small ESM modules separate literal target/source binding, public outcome
projection and the single-launch CLI. They reuse the existing capture transport
and unchanged generated apply query. The source-only check validates exact
apply/inspect query hashes, fixed local-machine PowerShell bootstrap and command
transport file bytes; it performs no fixture access or PowerShell invocation.
There is no target/path/host/query argument, environment enablement or rebaseline.

The only live mode requires explicit apply. Its fixed hidden, shell-free,
noninteractive Windows PowerShell 5.1 child receives the reviewed stdin query,
filtered environment, five-minute timeout and 64 KiB output bound. An instance
admits at most one launch, including synchronous capture failures. This is not
a host-wide process lock: separate instances/processes can launch, while native
payload effects require winning the exclusive protected receipt. Pre-claim
failure does not durably consume launch authority; no retry is nevertheless
authorized automatically or by the output.

All existing native admission, fresh target equality, claim/intent flushes,
exact-subject checks, drift refusal and retained root/receipt behavior remain
unchanged. Inspection success does not bypass current off/disconnected state,
disk checks, foreign-VM references, file owners/identities, no-checkpoint or
protected-permission predicates. No force/recursive removal, permission repair,
VM power/network command, general resume or finally-block cleanup was added.

## Truthful partial and unknown results

Validated provider output is separately checked against the reviewed fingerprint
and five-directory/four-file baseline. Unbound writes/completion are rejected;
an observed mismatched target is accepted only as a no-write snapshot refusal,
never as a new binding. Known partial output preserves nullable absence/count
observations and actual recorded attempts without claiming cleanup completion.

No-attempt output uses unobserved receipt state, not filesystem absence. A prior
claim reports existing/unreviewed. After any launch attempt, exception, timeout,
cancellation, stderr, malformed/oversized output or inconsistent completion
reports review-required with unknown effects and receipt state. Raw capture and
exceptions never enter public JSON. Missing evidence cannot become false
mutation flags or zero attempt counts. Repeat/concurrent calls to the same
wrapper instance do not launch again or reset previous uncertainty.

Successful output must establish the bound target, completion step, clean error
fields, verified VM/payload absence and complete receipt. Receipt records equal
two per resource action plus the claim and completion. For this nine-entry tree,
actions must be between three and ten. Success exit status is reserved for the
source-only check or validated cleanup; every refusal/partial/unknown result is
nonzero with no retry allowed.

## Verification

The final diagnostic/recovery run passed 38 Windows tests with zero failures or
skips: ten new wrapper tests, eleven recovery-flow tests, seven read-only review
tests and ten original fixture tests. The extra recovery-flow case executes the
actual fixed-fingerprint admission against a fully mocked different target and
proves refusal before receipt creation or removal, without the synthetic-flow
convenience that accepts a mock's own fingerprint.

Wrapper tests cover all four source pins, drift/missing sources, preserved
inspector disablement, invalid mode/platform, pre-launch cancellation, exact
capture settings/environment, known refusal/partial/completion, wrong target,
impossible counts, failed/oversized/malformed capture, during-capture cancellation
and single-instance concurrency/repeat refusal. Native flow suites exercise real
PowerShell parsing and refusal logic with every VM/VHD and fixture effect mocked.

Real transport tests used only benign local Node processes for successful JSON,
timeout, cancellation and output-limit termination. Existing ordinary-file tests
exercise their own private temporary files for metadata, exclusive receipts,
flush bounds, root pinning and release, then verify their cleanup. None used the
retained fixture or called the execution-capable entry point's apply mode.

The actual source-only CLI returned source_bound, commandLaunchAttempted false,
readOnly true, unobserved receipt state and no receipt/payload attempts. This
proves source agreement, not target readiness or privileged deletion behavior.
Syntax, Markdown, whitespace and staged secret checks passed.

Review caught early no-attempt output preserving an unobserved absent receipt
default and completion accepting impossible receipt/action counts. Both were
corrected in the new projection and covered by regressions. An initial invalid-
path test accidentally selected a normal constructor default; its input was
corrected. None of these preparation findings diagnoses the original native
cleanup failure or changes the frozen native operation sources.

## Limits and next step

The unchanged apply/inspect queries, bootstrap and transport are pinned, not the
wrapper/projector files or installed PowerShell/Hyper-V binaries. Hash equality
is not administrator authentication, historical provenance, file-content
attestation or protection against a concurrent trusted administrator. Keep both
VMs off and prohibit concurrent VM administration during eventual execution.

The five-minute capture timeout attempts abrupt child termination; it does not
guarantee Hyper-V service cancellation, descendant termination, rollback or
physical power-loss durability. Successful native removal and actual post-removal
ACL/tree behavior remain unqualified. Privileged receipt admission and three
flushes were reported by the first native attempt, but its current bytes and
metadata have not been independently reviewed. Unexpected changes may stop
recovery after VM removal, leaving payload that requires a separate review.
Do not delete/replace the receipt or
root, rerun the original fixture, retry apply, or adopt new identities to bypass
a refusal.

The first separately approved execution has now occurred. No further attempt is
approved. Preserve all remaining resources and the receipt; do not reset the
claim, refresh the target fingerprint or retry the original or prepared runner.

No application/image source changed, so application suites and Docker no-cache
build/replacement were not repeated for this ignored Windows-only preparation
and Markdown update. Prior runtime image evidence remains separate. No branch,
merge, release, production change, Unraid or shared Ollama operation occurred.

## First administrator execution

The user ran the handed-off absolute-path command once and supplied a screenshot
on 21 October 2026. It reports review_required at remove_vm, query_failed,
category 7, HRESULT -2146233088, errorKind other, queryLine 364 and no captured
native error code/condition. Capture validation and targetMatchesApproved are
true. The five-directory/four-file summary is the admitted baseline, not a
fresh observation of what remains after the attempted removal.

The exact bound apply query still matches its frozen hash. Line 364 is
Remove-VM with the freshly validated VM object, confirmation disabled and
terminating errors enabled. The preceding line sets the attempt flag, increments
resourceActions and invalidates absence/remaining observations. Therefore this
result attributes failure to that cmdlet call, unlike the older undifferentiated
qualification cleanup error. It does not prove whether Hyper-V performed part
or all of the removal before reporting failure.

Both receiptWriteAttempted and payloadMutationAttempted are true. Receipt state
is claimed with three records and one resource action; vmAbsent and remaining
are null, cleanupComplete false, retryAllowed false. In the frozen control flow,
the reported successful flushes correspond to claim, remove_vm intent and stopped
failure. No removal confirmation or later scripted file/directory removal was
reached. These are source-correlated reports, not an independent readback of the
protected receipt. Native configuration-file effects remain possible.

Category 7 is PowerShell InvalidOperation, while the signed HRESULT is
0x80131500, the generic COR_E_EXCEPTION rather than the separate invalid-operation
exception constant. Neither establishes an ACL or sharing cause.
The [category definitions](https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.errorcategory?view=powershellsdk-7.4.0)
and [Framework constants](https://raw.githubusercontent.com/microsoft/referencesource/main/mscorlib/system/__hresults.cs)
were opened through search MCP on 21 October 2026. Root pinning and receipt
handles can constrain operations on those particular objects under the
[Windows sharing rules](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew), but
that does not establish interference with descendant configuration removal.
No close failure was reported; disposal does not imply rollback. Do not release
protections, accept a capability exception, change deletion flags or rerun as a
diagnostic experiment.
The capture preserves an outer HRESULT and selected native codes, not the full
provider error or extended payload. A stopped-record read cannot recover details
that were never serialized; state observation alone also cannot establish cause.

The next requested capture used the unchanged metadata-only cleanup review,
tested with the additional receipt and with VM present/absent. It reports current state
without opening receipt contents or modifying resources. It does not validate
saved GUID equality, receipt integrity or foreign references, identify the root
cause, or grant further cleanup authority. The earlier pre-write inspection is
not current post-attempt evidence.

Focused post-attempt verification passed eighteen tests without failures/skips:
eight read-only review tests and ten wrapper tests. The new mocked receipt cases
cover five payload-plus-receipt files with the VM present and a possible missing
configuration file with the VM absent. The screenshot-shaped projection preserves
three records, one attempt and unknown current absence instead of completion.
No native operation source or permission policy was changed; all actual fixture
observations still require the administrator capture.
The full four-suite regression run subsequently passed 39 Windows tests without
failures/skips. Mocked failures both before and after the native removal effect
preserve the same three-record claim/intent/stopped pattern and unknown public
absence; only the mock's private state distinguishes whether its VM remained.
Both operation and read-only query hashes still match their frozen bindings.

## Completed post-attempt administrator review

The user supplied that read-only screenshot on 21 October 2026. It reports
observed, one name-selected VM off, syntax-valid identity, configuration paths
within the fixture, zero checkpoints, expected drive, disconnected networking,
and automatic startup/checkpoints disabled. The root exists and is private;
the expected fixed disk exists, matches the profile and reports diskMounted false.
The review read twelve native identities and counted five directories/five files.
Those counts are consistent with the previous nine-entry tree plus the new
receipt, but this output neither names that extra file nor verifies its contents.

The eight reported capability surfaces retain the previously observed rule forms:
two explicit directory capability rows, explicit/inherited disk rows, inherited
directory rules and inherited native-file rules. That is not descriptor equality,
effective-access proof or permission-policy acceptance. No receipt rule surface
is identified by this output. The observation confirms a current off fixture VM
and disk remain; it does not prove that no intermediate native change occurred.

readOnly is true, mutationAttempted and cleanupAttempted false, automaticRetry
and studyReady false. The probe did not retry removal or alter permissions.
It does not compare the selected VM GUID to the private saved claim, authenticate
receipt bytes, check configured foreign-VM references or identify failure cause.
diskMounted false is not proof of the latter reference check. The missing
historical creator identity remains distinct from the new claim's saved identity.

Two focused metadata-review regressions were rerun and passed without skips or
failures; no operation/query source was changed. No protected receipt or event
contents were read by the agent. The separately agreed bounded receipt-and-VMMS
diagnostic is prepared below; its subsequent administrator capture is recorded
at the end of this document. Retain the fixture off and leave the receipt/root
untouched; no second removal attempt is approved.

## Prepared receipt and VMMS diagnostic

The user approved this bounded read-only scope after the metadata review. Five
small ignored local ESM files separate receipt validation, event filtering,
query composition, public projection/capture and tests. The source-pinned entry
point supports a source-only check and explicit read-only inspection, never
cleanup execution. No frozen operation, receipt writer, root pin or permission
policy source was changed. The existing execution attempt remains consumed.

The diagnostic independently recomputes the saved snapshot fingerprint against
the literal accepted target, validates the reported three-record failure and
intent subject, compares the saved GUID with current VM inventory, then reads
only the fixed local VMMS Admin channel in the bounded receipt-metadata window.
It returns allowlisted event IDs, levels and numeric codes only for whole-field
named VM-identity matches. A GUID mentioned in free text is insufficient.
Receipt/root metadata, bytes and current VM identity are checked again afterward.

Preparation found and corrected three compatibility/attribution defects before
any privileged capture. First, an isolated invocation of the installed Windows
PowerShell 5.1 hash-filter date builder shifted UTC inputs by this host's local
offset. The diagnostic now uses explicit UTC FilterXml bounds, avoiding local
reparsing and repeated-hour ambiguity. Second, the unchanged receipt writer's
typed optional string serializes as an empty string, not null. Flow tests now
generate receipt records with that actual function and an in-memory append
instead of only hand-constructing expected JSON. Third, scanning arbitrary GUID
tokens could attribute a description's incidental mention to the wrong VM.
Matching now requires a whole VmId/VirtualMachineId value and refuses conflicting
or invalid identity fields. None of these findings explains the native removal
failure or authorizes a change to the original safeguards.

### Qualification and limits

The new diagnostic tests exercise real Windows PowerShell parsing and logic with
all VM inventory, protected receipt, native identity and event operations mocked.
Synthetic positive flows use their generated snapshot fingerprint; a separate
fixed-approval negative flow retains the literal accepted fingerprint and proves
that merely repeating that field cannot authenticate a different snapshot.
Scenarios cover unsafe permissions/receipt shapes, wrong/currently running VM,
implausible timing, pre/post-read drift, missing/disabled/empty logs, unsupported
payloads, incidental/conflicting GUIDs, XML/row/event bounds, provider failures,
strict output projection, capture failures and cancellation without retry.
Provider output is collected incrementally so records returned before a later
terminating error are still disposed; partial-query errors remain incomplete.
The full verification passed 51 Windows tests without failures or skips:
12 diagnostic cases and the unchanged 39-test wrapper/review/recovery/fixture
regression set. The synthetic scenarios do not prove native privileged access.

An installed 5.1 FilterXml property round-trip preserves fractional ISO UTC
bounds, including a repeated local DST hour, without invoking the cmdlet's query
methods, reading events or constructing an event reader. Read-only installed
method inspection also confirmed direct XML handoff, not DateTime reparsing;
this is compatibility evidence, not native event-query success. The actual
receipt reader was exercised only against its own ordinary temporary file:
read-only open, exact length/bytes, wrong-length refusal, handle release and
unchanged contents/mtime, followed by verified removal of that test file.

The source-only CLI reports source_bound, commandLaunchAttempted false, readOnly
true, mutationAttempted/cleanupAttempted false and retryAllowed false. It does
not read the protected fixture or establish administrator access. Source pins
do not authenticate administrator intent or attest installed binaries.

At preparation time, the protected receipt and VMMS event collection had not
been run by the agent or supplied by the administrator. Receipt metadata is a
mutable, approximate time anchor, not certified event timing. Named identity schemas and
numeric-code fields may be incomplete; missing, limited or unrecognized evidence
must not become a root-cause claim. The recognized field names are a conservative
subset, not a verified complete VMMS manifest contract. No raw receipt, GUID,
path, account, XML or message is returned. No new disk-reference, effective-access, deletion-readiness
or historical-creator proof is claimed.

No application/image source changed, so application suites and Docker no-cache
build/replacement were not repeated for this Windows-only ignored preparation
and documentation update. No branch, merge, release, production, Unraid or shared
Ollama operation occurred. The single approved read-only administrator capture
has now been supplied and reviewed below. Do not rerun apply, reset/remove the
receipt, change permissions, restart services or
start either VM to obtain new evidence.

## Completed administrator receipt and VMMS capture

The user supplied the read-only diagnostic screenshot on 21 October 2026. It
reports incomplete at complete with reasonCode no_events, category 0 and HRESULT
0. The completed step means the bounded inspection and final readback reached
their end, not that the native removal succeeded or its cause was established.

receiptVerified, snapshotMatches and currentVmMatches are true, receiptRecords
is three, and vmState is off. Under the unchanged pinned query, these results
establish that the protected three-record receipt passed validation, its saved
snapshot recomputed to the accepted fingerprint, and its saved VM GUID and paths
matched the current off VM before and after collection. This closes the earlier
saved/current identity gap. It does not recover the missing historical creator
identity, establish effective access, verify foreign-disk references or authorize
cleanup. No raw receipt, GUID, path or account was returned.

channelVerified is true and windowSeconds is 241. The enabled, expected-provider
VMMS Admin channel was recognized, but eventsScanned, eventsMatched and
eventsUnrecognized are all zero and rows is empty. This is an empty bounded
channel/provider/time result, not a set of events rejected by the GUID matcher
or an XML-schema failure. The reported 241 seconds are the rounded correlation
window including two minutes on each side, not the removal duration. Receipt
filesystem timestamps remain an approximate, mutable time anchor.

readOnly is true; mutationAttempted, cleanupAttempted, automaticRetry,
retryAllowed, rootCauseConfirmed and studyReady are false. No query/limit/close
failure was reported, but no provider event code was available. This does not
prove the failure was unlogged everywhere, that the original call was harmless,
or that deletion is now safe. No additional administrator query, cleanup retry,
log widening, permission change or service/power operation was performed by the
agent in response.

One new screenshot-shaped projection regression passed without failures or
skips. It preserves verified identity alongside incomplete/no_events and refuses
to promote that result to observed, root-cause confirmation or retry authority.
The source-only check still reports source_bound without launching PowerShell.
The earlier 51-test qualification remains separate; no operation or diagnostic
query source was changed for this documentation update.

Source review confirms the original catch/receipt retained only the known
failure projection, not richer provider messages, ErrorDetails or the full
exception chain. The child runspace has exited and the transport created no
persistent richer capture. No independent original capture is known to exist.
The next recommendation is therefore to preserve the off fixture and receipt
and stop collection with cause unresolved. A future isolated, instrumented
reproduction would require its own agreed preparation and execution scope;
no such reproduction was prepared or run in response to this screenshot.

This update changes documentation and one ignored projection regression only.
No application suite, Docker rebuild/replacement, dependency/PR implementation,
branch or release operation was needed or performed.
