# Comparison refresh phase-lifetime outcome

Date: 2026-10-06. [Design and tradeoffs](comparison-refresh-lifetimes-design.md).

## Implemented

The comparison coordinator now uses a small ESM candidate service with separate
read/ownership and build scopes. The coordinator receives a key and model, not
the initial snapshot or fitting input. The same exact-key verification and
memory safeguards remain in place. No worker protocol, numerical algorithm,
database schema, provider scheduling or representative-hook behavior changed.

The isolated weak-reference regression failed before the change at the fitting
boundary and passed afterward. It proves the original snapshot can be collected
during fitting and the owned input before verification, including unchanged
cache revalidation. Diagnostic GC is confined to a separate test process.

## Validation recorded so far

- Sixteen focused suites / 193 tests passed, including cancellation at the new
  phase boundary, changed initial state, freshness, cache reuse and failure stages.
- Backend lint, type checking, normal/production dependency checks, copyright
  and the inventory ownership gate passed; no baseline was regenerated.
- Markdown checks passed. Full backend coverage and image experiments are in
  progress; this document does not yet claim a runtime memory reduction.
- Random PR #556 was applied and tested locally, then rejected by the Node 24
  compatibility gate. See its [separate outcome](node-types-pr556-outcome.md).

No release, remote PR merge or Unraid deployment is included. Final image,
schema and measured memory results will be recorded after validation.
