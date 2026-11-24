# Native question handoff binding outcome

November 24, 2026. The [design](native-question-handoff-binding-design.md)
records the recommendations, tradeoffs, and agreed compatibility boundary.

The producer captures the canonical library ID, routing input, and bounded
native policy inputs before either read starts. It compares the current
selection and returned evidence identities before building a plan. Admission
and publication verify the original classification result, current library,
proof references, and handoff content.

A failed binding before History holds the item for review without a proposed
destination or new native question. Later checks suppress stale output and
refuse provider dispatch if it has yet to start. Already recorded History,
queue admission, and acknowledged provider outcomes retain their existing
closeout and replay behavior. Existing questions, retry state, equivalent
canonical IDs, and stable no-create decisions retain their behavior.

## Verification

- The full backend run passed 64,656 tests across 1,958 suites, with one test
  skipped. Coverage reached 89.33% statements and lines, 86.93% branches, and
  90.81% functions. The coverage ratchet passed with the existing client
  reports after verifying unchanged client inputs and report hashes.
- 161 focused tests covered forged or changed handoffs, canonical aliases,
  refusal at admission, and acknowledged provider outcomes.
- 35 isolated PostgreSQL tests covered pending persistence, exact resolution,
  the queue write barrier, and routing replay.
- Repository lint, type checking, CI preflight, import and mock checks, policy
  gates, Markdown lint, and the staged secret scan passed. The root, server,
  and client dependency audits each returned zero advisories.

## Next recommended item

Record a bounded failure stage for scheduled source-pair evaluation. The
generic `evaluation_unavailable` category can cover admission, a snapshot
read, worker evaluation, or publication. A safe stage indicator would help
identify a recurrence without logging library contents or provider data.
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
[OpenTelemetry error attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/error/)
