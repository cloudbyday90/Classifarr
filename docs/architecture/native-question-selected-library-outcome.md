# Exact selected library for native questions outcome

November 24, 2026. The [design](native-question-selected-library-design.md)
records the source review, options, and agreed safeguards.

The classifier, native handoff, and envelope admission share the exact
PostgreSQL INTEGER check. Valid `id` values take precedence. A null or absent
`id` uses `library_id`. The writer emits the same numeric IDs in the native
metadata and resolve option, and its audit requires both to match.

A malformed supplied selection is cleared before handoff reads, History
persistence, and automatic routing. The classifier keeps the item in review
with the existing Retry Classification path. Existing questions and retry
state remain available. The pending record carries no newly proposed library
or native question from the rejected selection.

## Local verification

- The 134 focused tests covered canonical numbers and strings, the INTEGER
  maximum, nullish fallback, explicit precedence, malformed inputs, matching
  saved copies, and preservation of existing questions and retry state.
- All 34 isolated PostgreSQL tests passed. The queued classification case
  saved an `awaiting_decision` row with no destination or question. It left
  the route marker unset and made no stored profile, routing configuration,
  or provider call. The suites also exercised valid routing and the
  completed receipt replay path.
- Lint, type checks, preflight, ESM, Markdown, and policy checks passed.
  All three workspace dependency audits returned zero findings. Client
  source and dependencies were unchanged. The previous 7,739-test client
  coverage report was reused after verifying its hashes.
- The full backend run passed 64,627 tests across 1,958 suites with one
  existing skip. The coverage ratchet passed with 89.33% backend and 89.58%
  client line coverage. The local Classifarr service kept its identity,
  start time, and health.

GitHub listed no open PRs at intake or before delivery.

## Next recommended item

Bind new native handoffs to the exact library they evaluate. Astra found that
the handoff currently carries its plan without the original library ID. The
writer can now prove that its two saved copies agree. An explicit binding
would also let it check agreement with the source after asynchronous reads.
