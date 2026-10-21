# One-target study-fixture execution preparation outcome

## Result and authority

Prepared on 21 October 2026 under the approved
[execution-wrapper design](study-vm-fixture-execution-design.md). A separate
private local entry point is execution-capable for the single reviewed current
fixture. Preparation approval does not authorize running it. No live apply,
elevation, VM/VHD/provider operation or protected fixture write was performed.
The existing inspector still refuses apply before launching PowerShell.

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
physical power-loss durability. Native removal, privileged receipt creation on
this protected fixture and its actual post-removal ACL/tree behavior remain
unqualified. Unexpected changes may stop recovery after VM removal, leaving
payload that requires a separate review. Do not delete/replace the receipt or
root, rerun the original fixture, retry apply, or adopt new identities to bypass
a refusal.

Next: obtain separate agreement for one administrator execution of this exact
prepared command, then review its sanitized result before further action. The
non-destructive alternative remains retaining the powered-off fixture. No
execution command was invoked or handed off as authorized by preparation alone.

No application/image source changed, so application suites and Docker no-cache
build/replacement were not repeated for this ignored Windows-only preparation
and Markdown update. Prior runtime image evidence remains separate. No branch,
merge, release, production change, Unraid or shared Ollama operation occurred.
