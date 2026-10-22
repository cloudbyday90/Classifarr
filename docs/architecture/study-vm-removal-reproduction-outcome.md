# Study-fixture removal reproduction planning outcome

## Delivered scope

Prepared on 21 October 2026 after the user approved a separate reproduction plan
with better sanitized error capture, without creating resources, running it or
touching either VM or the receipt. The
[design](study-vm-removal-reproduction-design.md) is a plan, not implemented or
execution-capable tooling. That planning change contained Markdown only.

The earlier verified saved/current identity and empty bounded VMMS query remain
the latest administrator observations. No existing target was read again.
Original cause remains unresolved and the original cleanup attempt consumed.

The user later separately approved implementing only the pure error projector
and synthetic tests. That implementation is recorded below; the earlier
planning-only verification/non-actions describe the preceding change.

## Findings incorporated

Source review distinguished the original same-child qualification from the later
fresh-child removal with both root pin and receipt open. It found no evidence
that handles, ACLs, capability grants, antivirus or provider state caused the
failure. The proposed future experiment preserves conditions rather than
silently relaxing them. A fresh same-process create/remove is explicitly a
different experiment.

The existing catch can lose primary public failure fields when later disposal
fails; the plan requires primary and secondary failures separately. The proposed
richer projection would retain each bounded exception's numeric evidence, not only an outer
generic HRESULT or one Win32 code. Private text, arbitrary error data and unknown
IDs remain excluded. Cycles, placeholder records, truncation and unsupported
provider details must be visible as incomplete rather than a diagnosis.

The existing tools hard-bind the old fixture, while their foreign-reference
guards read other VMs. Neither reuse as a fresh-target runner nor a promise of
no-existing-VM access is justified. At that stage host/read scope and potential
retention of one new off fixture needed agreement without dropping those safety
checks. The later planning choices are recorded below; cleanup is not guaranteed.

## Verification and non-actions

Read the existing execution/maintenance helpers, frozen fixture/recovery flow,
native handle/receipt code, capture transport and prior design/outcome records.
Opened current official Microsoft references through search MCP and recorded
their exact URLs and limits in the design. The execution directory contained no
applicable reusable error-capture utility; no new script was needed for planning.

No sanitizer, mocked test, native wrapper, target identity or execution command
was created. No PowerShell diagnostic child, VM/VHD/provider/event query, protected receipt
read, administrator handoff, permission change, provisioning, removal or power
operation was run. No hypothesis was tested against either existing VM.

Only documentation, whitespace and staged secret validation apply to this
Markdown change; prior runtime tests remain historical evidence, not validation
of the proposed implementation. Application tests and Docker no-cache
build/replacement are not relevant to prose and were not run. No dependency/PR
implementation, new branch, merge, release, Unraid or shared Ollama operation is
included in this explicitly narrowed planning scope.

Documentation validation checked 2,344 Markdown files with zero errors. Diff
whitespace and staged secret checks passed; no runtime qualification is claimed.

## Planning handoff

The planning handoff recommended confirming only the pure ESM error contract,
pure PowerShell projection source and synthetic tests. This can validate
privacy and failure preservation without target access or native capability.
It cannot establish the old cause or authorize a live reproduction.

Before native work, separately resolve the host/inventory-read scope, exact fresh
identity/path/profile bindings, durable identity and one-shot journal semantics,
cleanup/quarantine policy and administrator execution agreement. Retain both
existing VMs off and the existing receipt unchanged. No command needs to be run
by the user for this planning handoff.

## Approved pure implementation

Implemented the two small ESM modules and one test file proposed in the design.
The JavaScript contract validates bounded own-data DTOs, strips unread private
extras, preserves primary failure evidence and appends bounded secondary errors
without mutating the input. It never grants retry, diagnosis or live-operation
authority. It contains no process/file/network operation and accepts no raw Error
object, proxy or accessor as a projected record.

The PowerShell export is function-definition source only, with no launcher,
native binding, provider import or target command. It uses fixed CLR getters to
bypass throwing ETS shadows, reads embedded records only from exact reviewed
types, and retains each exception's signed HRESULT separately from a typed
Win32 native code. Unknown IDs/types remain finite classifications. Private
messages, ErrorDetails text, stack/source/target contents and arbitrary Data are
never read or serialized.

Six exception nodes and six records bound each extraction; a report emits at
most six nodes total across the primary and four secondary entries. Independent
extractions do not share counters. Unsupported wrappers, placeholder records,
cycles, limits and projection failures remain explicit partial/unavailable
detail. These are projection states, not native-operation outcomes.

Review found a cycle-detection weakness before handoff: first-path BFS ancestry
could miss a real cycle reached through a shared shortcut. Private bounded-edge
reachability now detects that case while preserving the acyclic shared-reference
case. A regression reproduces the exact topology. Early test-fixture failures
also caught use of PowerShell's reserved Error variable and missing Force when
deliberately adding shadow members; both fixture issues were corrected. None of
these observations diagnoses the retained VM's removal failure.

## Implementation verification and limits

All 13 new tests passed on Windows with no skips, using Node 24.21.0 and real
PowerShell 5.1 with only synthetic in-memory ErrorRecords/exceptions. Cases cover
opaque validation, privacy/getter/proxy refusal, graph/record budgets, nested
Win32 values, placeholders, DAG sharing, direct/shortcut cycles, oversize IDs,
fault-injected projector failures, primary plus journal/disposal failures and
actual CI wiring. One cyclic fixture mutates a private CLR field in memory only;
that technique is not a production input or API contract.

Node's focused coverage reports 100% lines/functions and 99.18% branches for the
JavaScript contract. This is not PowerShell coverage or native provider evidence.
The test AST contains one function definition and only Set-StrictMode as a
command; no target/provider operation is present. On non-Windows CI, eight
portable tests run and five PowerShell-specific tests explicitly skip. No new
Windows runner or dependency installation was added.

The new npm test command is invoked by local preflight and a separate step in
the existing CI workflow. Static-import, npm-flag and copyright checks passed.
Frozen cleanup/inspector/bootstrap/transport bindings still match, checked by
source hashing without native target access. No prior operation source, receipt
or identity was edited or regenerated.

Final Markdown validation checked 2,344 files with zero errors. JavaScript syntax,
diff whitespace and staged secret checks passed. No remote CI result is claimed
by the local test run.

The related handoff/lifecycle/shutdown regression run initially exposed a flaky
handoff fault injection: incrementing a Number inode can round away rather than
change it. Only that synthetic injection was changed to a guaranteed different
value, with a numeric regression above MAX_SAFE_INTEGER; the handoff reader's
runtime behavior is unchanged. The final combined run passed 43 of 44 tests with
zero failures and one existing Windows symlink-privilege skip. No protected
handoff/receipt was used; ordinary handoff fixtures create and clean their own
temporary files. Exact runtime metadata handling remains a separate concern,
not a fix claimed by this test-only adjustment.

The Dockerfile copies scripts/lib, so a future image would include the two inert
modules. No production caller imports them; no runtime integration, Docker
build/replacement or application suite was run in this explicitly limited pure-
test slice. Existing containers, both VMs, their permissions and the protected
receipt were not accessed or changed. No PR/dependency work, branch, merge,
release, Unraid or shared Ollama operation occurred.

## Subsequent host and retention planning agreement

On 21 October 2026 the user answered yes to both proposed planning choices:

- Use this existing local Hyper-V host, with bounded read-only VM inventory and
  configured-drive checks including the two retained VMs in a future run.
- Accept retaining at most one new off, disconnected disposable fixture and its
  private evidence if cleanup fails or becomes uncertain, without automatic
  retry, replacement fixture, permission repair or forced deletion.

The question explicitly settled planning scope only. No native implementation,
inventory query, target/receipt inspection, creation, deletion or power operation
was approved by that answer or performed to record it. Both existing VMs and the
consumed attempt remain untouched; their current state was not observed anew.

Source-only follow-up found reusable identity, exclusive-directory, bounded
capture and error-projection components, but no drop-in disabled reproduction
runner. The tracked creator uses the full study profile; old private modules bind
the old fixture and can proceed from creation into cleanup. Existing removal
journaling begins after creation and cannot supply missing creator identity.

The old recovery inventory accepts 128 VMs, 64 configured drives per other VM and
1,024 drives combined per pass, using overflow sentinels and GUID validation.
Its configured-path comparison is not an exhaustive snapshot/parent/alias
reference check, and per-pass limits are not whole-phase limits. No broader
existing-VM disk inspection was silently added to the agreed read scope.

The most important remaining weak point is partial creation: ID/SID/ACL or
capture failure can occur before startup/checkpoint settings and adapter checks.
The code never intentionally boots the fixture, but that does not prove current
off/disconnected/configured state. Retention must preserve unknown outcomes,
not advertise guaranteed quarantine settings or authorize corrective operations.
The design records this early-failure case for explicit review before live work.

Refreshed official Get-VM, Get-VMHardDiskDrive and New-VM references by discovering
and opening their URLs through search MCP on 21 October 2026. Those cmdlet
contracts do not establish atomic ownership, crash-safe identity persistence or
exhaustive reference detection. Installed provider behavior remains untested.

Only the separate design/outcome documents and high-level Unreleased entry were
updated for this agreement. Markdown validation checked 2,344 files with zero
errors, and diff whitespace validation passed. No runtime test, provider child,
Docker build/replacement, PR/dependency work or release was performed for this
documentation-only change; no new runtime qualification is claimed.

## Next recommendation

The user subsequently confirmed the disabled preparation scope. Its separate
[design](study-vm-removal-simulation-design.md) and
[outcome](study-vm-removal-simulation-outcome.md) record the implemented data-only
ESM runner, memory journal and failure tests. This qualifies modeled ordering,
not actual durable identity, filesystem exclusivity or native provider behavior.

Next agree a source-only native-integration design covering actual creation-
identity persistence, reference coverage, early-failure retention, exact future
paths and protected journal/source bindings. Implementation and administrator
execution remain separate agreements. No command needs to be run for this handoff;
original cause remains unresolved and the consumed cleanup must not be replayed.
