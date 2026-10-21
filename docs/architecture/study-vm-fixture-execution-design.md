# One-target study-fixture execution wrapper

## Agreed scope

On 21 October 2026 the user approved preparing an execution-ready command for
the current disposable fixture accepted by the full administrator inspection.
This extends the [recovery preparation](study-vm-fixture-recovery-design.md), not
permission to execute cleanup. The user must explicitly run the final command
as administrator after a separate execution agreement. The agent must not run
it, elevate, or use the real study VM as a test subject.

Preserve the original qualification, inspector and generated cleanup query.
Use separate ignored ESM modules for fixed source/target binding, public outcome
projection and a single-launch wrapper. No product API, dependency, scheduler,
general cleanup tool, new branch or release is needed.

## Admission and source binding

Bind the screenshot's current-target fingerprint literally in private local
material; never generate a replacement from a fresh observation. It identifies
the reviewed current state, not the original creator's missing VM identity.
Pin the exact generated apply query, unchanged inspect query, fixed local
PowerShell bootstrap and existing command-capture implementation with SHA-256.
Reject a missing/mismatched binding before launch. No CLI argument or environment
variable may select a different fingerprint, target, path, query or host.

The only operating modes are a local source check, which performs no VM/fixture
access, and explicit apply. Validate Windows/SystemRoot before constructing the
fixed System32 Windows PowerShell 5.1 executable. Reuse filtered environment,
native local-machine bootstrap, no profile, noninteractive stdin script and
shell-free hidden-window capture. Do not add native compilation or target I/O
to module import or the local source check.

Apply retains every existing admission predicate, two fresh snapshots, matching
approved fingerprint, protected one-shot receipt, flushed before-effect intent,
exact subject identities and stop-on-drift behavior. Receipt collision refuses
replay. There is no resume, rollback, permission repair, force/recursive deletion,
VM startup/shutdown, network operation or automatic retry. The fixture root and
private receipt are retained even after successful payload cleanup.

## Bounds and uncertain outcomes

Maximum one command launch per wrapper instance. Concurrent native invocations
must still win the exclusive protected receipt before any payload effect; an
in-process guard is not a host-wide lock. Keep the existing admission, tree,
record and byte bounds. Set the capture timeout to five minutes and public
capture to 64 KiB. Timeout/cancellation attempts to terminate the local child;
it does not undo accepted Hyper-V work, guarantee service cancellation or prove
all descendants exited. Do not rerun after an uncertain result.

Before launch, a refusal can report no receipt/payload attempt. After launch,
timeout, cancellation, command exception, failed/oversized/malformed capture,
stderr or inconsistent public fields must report review-required and unknown
effects. Never reuse the inspector's no-mutation failure result for apply.
Counters, receipt state and absence become unknown unless validated output
establishes them. Do not expose raw output/errors, identities, paths or private
receipt contents. Validate mode, current fingerprint and result relationships;
do not accept a successful result for an unbound target. An observed mismatched
snapshot can be reported only as a no-write refusal, never a new baseline.
No-attempt results use unobserved receipt state, not an unverified absence claim;
an explicit prior-attempt refusal reports existing/unreviewed. Successful receipt
counts must equal two records per resource action plus the claim and completion.
For this inspected nine-entry tree, completed actions must be between three
(VM, retained disk and its parent) and ten (VM plus every original tree entry).

Completion requires validated cleaned status, the bound fingerprint, verified
VM/payload absence, complete protected receipt and completion step. Exit zero
only for local source-check success or verified cleanup. Partial/unknown results
remain nonzero, require review and prohibit automatic retry. Literal-path checks
remain non-atomic against concurrent trusted administrators; prohibit concurrent
VM administration during any eventual execution.

## Options and recommendation

| Option | Advantage | Cost or risk |
| --- | --- | --- |
| Retain powered-off fixture | No deletion risk; valid stopping point | Small retained disk/configuration allocation |
| Enable the original inspector | Fewer local files | Blurs its tested read-only/disabled contract; rejected |
| Separate fingerprint/source-pinned command | Explicit administrator entry point, preserved evidence, truthful uncertainty | Native removal still unqualified and can stop partially; recommended preparation |

Recommendation stack: preserve the successful inspection and original sources;
prepare the separate pinned command; qualify failure projection and capture;
review the exact scope; obtain separate execution agreement; perform at most one
administrator invocation and review its result. Do not advance the real VM's
permission exception, guest setup or on-demand study based on fixture cleanup.

## Verification and evidence

Use actual source hashes, Windows PowerShell parsing and the existing mocked
recovery flow suites. Add wrapper tests for wrong mode/source/fingerprint,
cancel-before-launch, one launch/concurrency, strict filtered capture settings,
known blocked/partial/complete output, cancellation during capture and every
uncertain capture category. Exercise the real capture transport only with
ordinary benign local processes: success, timeout, cancellation and output limit.
No test may invoke the live apply entry point or use the protected fixture.

Document exact results and limits separately in an outcome. Windows-only ignored
preparation and documentation do not change application/image source; do not
replace containers or claim a new Docker build. No Unraid/shared Ollama access.

## Read-only review after the first native attempt

After separately approving one execution, the user supplied a removal-stage
failure. That consumes the agreed attempt; it does not authorize replay or a
changed removal method. Preserve the private receipt/root and frozen operation
sources. Do not infer current VM absence or file inventory from pre-write counts.

Reuse the existing source-pinned metadata-only state review. Its bounded tree
accepts the additional protected regular receipt as an extra file, but does not
read its contents, open a writer or pin the root. Verify compatibility in mocked
VM-present and VM-absent cases before requesting one fresh administrator capture.
This is a new post-mutation observation, not a repetition of old evidence to
explain the original failure.

The review can distinguish present/absent VM and disk observations and bounded
metadata failures. It cannot bind a returned VM to the receipt's saved GUID,
validate receipt records, establish foreign-disk references, prove native failure
cause or authorize further cleanup. Any later receipt/event/provider diagnosis
must remain separately scoped and sanitized. Do not weaken root/receipt sharing
protections, repair ACLs or try another Remove-VM call based on a hypothesis.

## Official sources

Discovered and opened through search MCP on 21 October 2026:

- [Node.js 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html)
  documents shell-free spawn, capture streams, close/error events and abrupt
  Windows termination. The moving page currently reports 24.22.1; qualification
  uses the installed pinned 24.21.0, not a silent toolchain update. A kill request
  is not a rollback or proof that provider-side effects stopped.
- [Microsoft Hyper-V cmdlet reference](https://learn.microsoft.com/en-us/powershell/module/hyper-v/?view=windowsserver2025-ps)
  identifies Remove-VM separately from disk operations. The previously verified
  [removal and receipt sources](study-vm-fixture-recovery-design.md#official-sources-and-limits)
  still govern the unchanged cleanup query and its limitations.
