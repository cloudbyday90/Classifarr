# Disabled study-fixture removal runner outcome

## Delivered scope

Implemented on 21 October 2026 after the user approved the preparation-only
[design](study-vm-removal-simulation-design.md). Four small ESM modules separate
strict synthetic contracts, memory-journal bookkeeping, finite mock outcomes and
phase orchestration. A portable test suite is invoked by local preflight and an
explicit step in the existing CI workflow. No dependency or Windows runner was
added. The previous error projector is reused without changing its contract.

The model accepts finite data, not callbacks or real paths/GUIDs. Create, inspect
and remove require separate explicit calls. Returned synthetic disk/VM identities
must receive modeled journal acknowledgements before later resource effects.
Missing identity, drift, failed observation, short write, flush failure, timeout
or capture loss halts work without replay, repair or automatic cleanup. Partial
creation remains unconfirmed; a successful remove call still needs a separate
absence observation. Payload cleanup is never attempted or claimed complete.

Competing runner views share one in-memory admission/history instance. Existing
or partial mock journals refuse work; no hydration, reset or resume is present.
This is not a process lock, persistent retry budget or actual one-shot receipt.
Timeout/cancellation are scripted outcomes, not operational deadlines or provider
cancellation. Primary evidence survives secondary journal/projection/disposal
failures within the existing global error budget. All output remains simulation-
labeled and grants no native mutation, live operation, retry, diagnosis or study
readiness, including after a successful modeled removal.

## Findings and tradeoffs

Data-only adapters and fictional numeric handles avoid dormant native capability
and accidental real-target binding. The cost is that no provider integration,
file identity, permission policy or actual flush/exclusivity is qualified. An
injectable executor would be closer to integration but expand this approved
mock-only boundary; it was not added.

Review tightened two model boundaries before completion: reserve an inventory
slot before creation, rather than knowingly exceeding the post-create limit;
and refuse exhausted call/observation budgets before incrementing successful
admission counters. The byte-limit test initially assumed a fixed serialized
record size; it now derives the boundary from an actual model record instead.
These are simulation/test improvements, not fixes for the old Hyper-V failure.

Bounds are six observations, sixteen mock calls and sixteen journal records per
environment, with 64 KiB per record, 512 KiB total journal and 64 KiB public output.
Configured-drive validation remains 64 per other VM, 1,024 per pass and at most
6,144 across six complete passes. The drivesValidated counter counts successful
validated passes, not physical reads or evidence of exhaustive file non-use.
Unsupported reference coverage refuses even when configured paths do not match.

## Verification

Using Node 24.21.0, all nineteen new portable tests passed with no skips. They
include thirty-six journal-write fault cases (all twelve success-path positions
times write/short-write/flush failure) and sixty scripted operation fault cases.
Additional contracts cover phase order, competing claims, drift and collision,
returned-identity binding, partial creation, later foreign references, inventory
and byte limits, failed absence, immutable state, private/getter/proxy refusal,
global error budgets, secondary failures and actual CI wiring.

Focused Node coverage for the four new modules reports 100% lines/functions and
96.15% branches. This is JavaScript model coverage, not native or filesystem
durability evidence. The combined simulation/error/handoff/lifecycle/shutdown
regression run passed 62 of 63 tests with zero failures and one existing Windows
symlink-privilege skip. The older error suite's PowerShell cases used synthetic
in-memory errors only; handoff tests used their own ordinary temporary files.

JavaScript syntax, static-import, copyright (1,801 files) and npm-flag checks
passed. Markdown validation checked 2,346 files with zero errors; whitespace and
staged secret checks passed. These results do not qualify native execution.
No remote CI outcome is claimed.

Refreshed the official Node 24 filesystem reference through search MCP and linked
it in the design, distinguishing real sync/exclusive-create contracts from this
in-memory model. No real filesystem journal was implemented or accessed.

## Non-actions and next item

No live launcher, native query source, transport connection, real target binding,
VM/VHD/provider/event query, protected receipt read, administrator handoff, power,
network or permission action was added or performed. Neither existing VM nor its
consumed cleanup sources/bindings were changed. Original cause is still unknown.

The Dockerfile copies scripts/lib, so future images would contain the inert new
modules. No production caller imports them. No application-suite run, Docker
build/replacement, PR/dependency implementation, branch, merge, release, Unraid or
shared Ollama operation belongs to this narrowed mock-only implementation.

Recommendation stack: retain the model and evidence; agree a source-only native-
integration design for real creation-identity persistence, protected journal and
early-failure handling; resolve reference coverage and exact binding review;
only then consider a separately approved native implementation and execution.
No administrator command or existing cleanup retry is needed for this handoff.

Subsequent source-only [creation-journal research](study-vm-creation-journal-design.md)
develops that next recommendation. Its separate outcome records official sources,
open-PR requalification and the pending file-only/Docker scope choices; it does
not add a native implementation or execution authority.
