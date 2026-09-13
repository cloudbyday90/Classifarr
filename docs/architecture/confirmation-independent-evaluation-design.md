# Confirmation-independent library evaluation: design

## Decision

Commit `e6d643cc` added live calibrated-neighbor shadow evaluation but found that
the local `require_all_confirmations=true` preference stopped preparation entirely.
Separate permission to evaluate existing evidence from permission to route. Keep
the configured preference unchanged and keep explicit policy restrictions intact.

This component evaluates existing local AI proposals and current library evidence;
it does not train model weights, turn placements into verified labels, rescan the
inventory on a new schedule, or enable calibrated fallback routing.

## Behavior matrix

| Configuration | Evidence evaluation | Routing from this service |
| --- | --- | --- |
| Confirmations off, otherwise eligible | Existing strict path; selective calibrated shadow | Existing fresh strict receipt only |
| Confirmations on, otherwise eligible | Cached-only strict and calibrated evaluation | Original review result; no receipt |
| Unknown confirmation value, remote/disabled provider, invalid scope | Not admitted | No new authority |
| Configuration, evidence, identity or policy changes during evaluation | Reject qualification | No new authority |

A caller may request a stricter confirmation hold but cannot relax the database
preference. Bind that caller preference into the one-use preparation context.
The database reader retains its existing `false` default for an absent setting;
explicit unrecognized values are not converted into permission.
Do not remove the confirmation guard from shared offline evaluators or the final
routing gate. The live service explicitly separates evidence inputs from its
server-owned evaluation mode, and checks that mode before receipt issuance.

## Modular implementation

- A small ESM evaluation-control module owns valid mode selection, fixed counters
  and one in-flight evaluation slot. Release the slot in `finally`; completion is
  idempotent, so an old completion cannot release a newer attempt.
- Reuse the existing learned-evidence service, policy checks, library validation,
  cross-fit calibration and final source/configuration revalidation. Do not clone
  a second policy engine or add a new singleton.
- Confirmation-held evaluations share the existing ten-second cooperative signal
  across all extra reads. Strict automatic evaluation retains existing behavior.
  Held evaluations and calibrated shadows share one slot with no queued backlog.
- Extend the internal retriever with a validated cached-query-only option. Missing
  or expired query vectors return unavailable; evaluation must not generate an
  embedding or a second AI response. Existing normal retrieval remains unchanged.
- Count strict qualification with a routing hold separately from calibrated
  qualification with a routing hold, failed evidence and busy/unavailable work.
  Preparation counts are not qualification counts. Keep diagnostics process-local,
  bounded and content-free; no public receipt or editable authority flag is added.

## Official sources verified 13 September 2026

These URLs were discovered through search and opened, not guessed:

- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, default denial, permission validation for every
  request and authorization tests. Applied here: evaluation does not imply routing
  permission, malformed state is rejected, and the final routing hold remains.
- [OWASP RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  describes output validation, scoped retrieval, cache invalidation and fail-closed
  behavior. Applied here: reuse computation only, re-read current evidence, and
  never treat retrieved text or a cached model as authorization.
- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  explains that accessible feedback does not require inventing new notifications,
  and warns about excessive live-region feedback. This backend component adds no
  card, acknowledgement, polling loop or announcement. A future status summary
  should use concise, programmatically identified updates without stealing focus.

The implementation choices are project-specific applications of these sources,
not a claim that the sources establish classification accuracy or full compliance.

## Alternatives and recommendation stack

| Option | Advantage | Cost or risk |
| --- | --- | --- |
| Leave evaluation tied to confirmation | No new work | Manual-routing installations cannot measure evidence qualification |
| Disable confirmation automatically | Fewer holds | Violates the operator's routing preference; rejected |
| Independent cached-only evaluation | Hands-off evaluation with unchanged routing control | Extra bounded reads; missing caches remain unevaluated |

Recommend the existing PostgreSQL/pgvector and local embedding stack, strict
library evidence first, selective cross-fit evaluation second, and independent
fresh routing authorization last. No new dependencies, settings or schema are
needed. Report the design and measured outcome in separate documents.

## Validation plan

Test strict and calibrated qualification with confirmation on/off, caller holds,
malformed settings, both configuration-toggle directions, context replay and
mutation, all existing evidence/identity vetoes, cache misses, cancellation and
concurrent attempts. Verify original result identity, no receipt and the final
route gate with confirmation on. Use PostgreSQL integration and read-only local
Compose checks; distinguish synthetic control-path checks from natural traffic.
Record actual results and the next useful component in the
[outcome](confirmation-independent-evaluation-outcome.md).
