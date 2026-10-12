# System Information simplification: outcome

Date: 2026-10-12. See the separate
[design and presentation tradeoffs](system-information-simplification-design.md).

The System Information card now contains facts rather than a startup report.
Application/runtime versions, uptime, platform, architecture and memory remain.
The pgvector section shows version, build, selected optimization and AVX/AVX2 CPU
support as compact name/value pairs. Process references, report timestamps, scope
explanations and the "Recorded by this application process" paragraph are removed
from the card, not moved into another expanded diagnostic block.

Only a confirmed current CPU mismatch shows a short warning. Missing or stale
selection evidence shows Unknown. Backend API diagnostics, actual Database/RAG
health, service counts, authentication and all memory/security safeguards remain
unchanged. This is not a claim that startup selection proves a loaded binary.

## Verification and delivery

- Focused System/presentation tests: 63 passed, including current versus stale
  evidence, no internal report text, mismatch warning and unchanged health totals.
- Final frontend lint, API/component type checks and all 7,180 frontend tests passed.
- Chromium at 390px and 1280px: five facts, no internal references/timestamps,
  no horizontal overflow or fixture requests, and unchanged keyboard focus behavior.
  Both saved screenshots were visually reviewed. These are component fixtures,
  not a claim of an authenticated end-to-end production session.
- Existing production-route asset checks: eight passed. Combined backend/frontend
  coverage ratchet passed without baseline changes.
- Clean runtime/UI commit: `e50019ffb540bc7a1a830000e5845cfecb529974`.
  The no-cache image build includes this change. Shared validation and deployment
  evidence is recorded in the [cache outcome](health-cache-reconciliation-outcome.md).

Recommendation: keep this page concise and reserve implementation details for
existing diagnostics. The tradeoff is one more troubleshooting step when detailed
provenance is needed, without making normal system information harder to read.
Next UI follow-up: review other operator-facing messages for clear status and
specific actions, without suppressing actionable failures.
