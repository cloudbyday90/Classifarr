# Creation journal file qualification outcome

## Scope

On 22 October 2026 the user approved both the file-only implementation and the
existing isolated no-cache frozen image rehearsal. The
[design](study-vm-creation-journal-design.md) records the recommendation stack,
pros/cons, official MCP-discovered sources and concrete contracts. This outcome
is separate from the historical research and from future VM execution evidence.

Implemented three small ESM modules for canonical bounded private framing,
fixed Windows identity/security source and exclusive native file writing.
Added a test-only PS5.1 harness, local preflight command and CI wiring. Linux CI
runs portable contracts and explicitly skips native Windows cases; it is not
a Windows qualification receipt. No production caller, creator/remover CLI or
existing-target binding imports these primitives.

## File verification

Using pinned Node 24.21.0 on Windows, all 12 new test cases pass, including real
PS5.1/.NET Framework file creation and cleanup. Native cases cover creation-time
protected permissions, exclusive creation, write/delete sharing refusal, bounded
frames/record count/total bytes, flush/readback, truncation, actual hard-link
refusal, path/descriptor refusal, and write/short-call/flush/close fault injection.
Pure cases reject corrupt/truncated frames, invalid sequence/source/plan/identity,
accessors/proxies and unbounded journals. Injected identity mismatch is not an
actual provider race. Lost-output testing cuts only the final output envelope
after normal cleanup, not the process during an outstanding write.

All newly owned fixture roots are absent after the new tests. Failure diagnostics
contain fixed classifications/line numbers, not raw paths, identities or errors.
No old receipt, VM/VHD, event log or retained target was queried or altered.

Verification scope exception: an existing creator regression suite was included
once and imported Hyper-V/Storage modules. Its real child input was a fixed
module-loading probe; resource commands in its other cases were mocked. This
exceeded the agreed no-provider-import boundary, although no real VM/provider
resource operation ran. It was not rerun. Remaining VM verification uses only the
new file suite and pure/synthetic error and simulation suites. The first combined
run exposed a test-harness single-frame array bug; the fixed harness preserves
byte arrays without PowerShell enumeration, and the new suite passes afterward.

The combined new journal, pure simulation and synthetic error suites pass all
44 tests with no skips. Copyright (1,806 code files), npm CLI flag policy,
static-import policy, Markdown (2,349 files at that check) and diff whitespace
checks passed. Final image evaluation and any later documentation checks are
recorded separately against their actual source revision.

## Limits and next recommendation

No live integration, real creation identity schema, administrator envelope
qualification, native creator operation budget or power-loss/crash-retention
proof is delivered. A checksum is not authorization. A flushed prefix cannot
admit creation retry, name adoption, cleanup or study readiness. Existing VMs,
consumed bindings and unknown original removal cause stay unchanged; VM startup
and shutdown remain as-needed requirements for any future integration.

For the VM work, design the retained partial-journal/crashed-child inspection
fixture and agree the early-creation quarantine/default-settings case before
connecting these primitives to a provider. Keep native creation, independent
admission and any one-shot removal as separately reviewed gates. No release,
tag, PR merge, published image or live service deployment is authorized here.

The subsequently reported scheduler incident takes priority as the next
platform recommendation: see its separate
[investigation](representative-refresh-failure-diagnostics-outcome.md) and
private-safe diagnostics proposal. It does not expand this file-only VM scope.
