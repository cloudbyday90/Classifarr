# Study-fixture removal reproduction planning outcome

## Delivered scope

Prepared on 21 October 2026 after the user approved a separate reproduction plan
with better sanitized error capture, without creating resources, running it or
touching either VM or the receipt. The
[design](study-vm-removal-reproduction-design.md) is a plan, not implemented or
execution-capable tooling. This change contains Markdown only.

The earlier verified saved/current identity and empty bounded VMMS query remain
the latest administrator observations. No existing target was read again.
Original cause remains unresolved and the original cleanup attempt consumed.

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
no-existing-VM access is justified. A future host/read-scope agreement is required
without dropping those safety checks. Potential retention of one new off fixture
must also be agreed before any creation; cleanup cannot be guaranteed.

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

## Recommendation and handoff

Next, confirm and implement only the pure ESM error contract, pure PowerShell
projection source and synthetic tests described in the design. This can validate
privacy and failure preservation without target access or native capability.
It cannot establish the old cause or authorize a live reproduction.

Before native work, separately resolve the host/inventory-read scope, exact fresh
identity/path/profile bindings, durable identity and one-shot journal semantics,
cleanup/quarantine policy and administrator execution agreement. Retain both
existing VMs off and the existing receipt unchanged. No command needs to be run
by the user for this planning handoff.
