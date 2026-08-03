# Policy Runtime Question Answer Contract

## Status

Phase 5R.5 is complete. This document records the shared answer boundary for a
pending policy-runtime question in the Classifarr UI and Discord.

## Problem

The former pending-resolution path accepted a library ID, a display label, an
actor name, and an optional learning flag. The UI and Discord independently
translated their presentation into that payload. A stale control, altered
label, or old Discord button could therefore attempt to resolve a newer
question, and a visible choice was too close to becoming a learning command.

Runtime resolution must be narrow: select the destination for the current
item, or explicitly keep it from routing. It is not an instruction to change
the destination policy or remember an item for later decisions.

## Official Research Basis

The requested June 2026 best-practice baseline uses these official sources:

- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires the server to enforce workflow state, bind identifiers to workflow
  stages, and reject out-of-order requests.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends syntactic and semantic validation at the trust boundary.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side authoritative computation and idempotency for
  non-idempotent effects.
- [Discord Component Reference](https://docs.discord.com/developers/components/reference)
  documents the bounded, message-scoped `custom_id` component mechanism used
  for interaction routing.
- [Discord interaction receiving and responding documentation](https://docs.discord.com/developers/interactions/receiving-and-responding)
  confirms that the component `custom_id` returns as interaction data and
  therefore must be treated as untrusted input.
- [NIST AI RMF Secure practices](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  supports an iterative, documented control boundary for automated decisions.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep source-specific UI and Discord payload parsers | Small local edits; preserves existing controls | Duplicates authorization logic, makes display text a command input, and permits path drift. |
| Let the client or Discord control hold the selected policy state | Simple presentation code | A stale client can authorize a newer state; hidden or forged fields expand the command surface. |
| Use one server-owned question and answer contract | The same bounded actions and IDs reach every surface; state, freshness, destination scope, and learning posture are validated at the transaction boundary | Requires old controls to fail closed and requires a contract refresh after relevant state changes. |

## Decision

Use `policy.runtime_question_answer.v1` as the only policy-runtime resolution
contract. `policyRuntimeQuestionAnswerContract.mjs` builds it from a validated
normalized or native persisted question. The client and Discord render this
projection; neither constructs policy meaning.

The projection contains:

- a version and deterministic fingerprint;
- bounded question type, uncertainty type, and safe display text;
- the current candidate item and candidate destinations;
- the complete action list and destination scope for each action;
- selected-option requirements that require server IDs and reject labels;
- learning posture, currently always `blocked`; and
- freshness status and current context version.

The HTTP resolution endpoint accepts only `contract_version`,
`contract_fingerprint`, `action_id`, and, when required,
`destination_library_id`. It rejects the legacy `selected_option`,
`library_id`, `resolved_by`, and `generate_rule` fields. The authenticated
request identity supplies the actor.

The server reconstructs the contract from the row locked for resolution,
compares its fingerprint and version, validates freshness, and then validates
the action against its declared scope. A confirm action may select only a
candidate destination. A change or route-not-applicable action may select only
an active library with the same media type. The implementation never uses a
client-provided display label as a command.

## Action Semantics

| Action | Current availability | Effect |
| --- | --- | --- |
| `confirm_destination` | Available with a current candidate destination | Resolves the current item and requests normal routing. |
| `change_destination` | Available with an active, media-compatible library | Resolves the current item to another destination and requests normal routing. |
| `route_not_applicable` | Available with an active, media-compatible library | Resolves the current item without requesting routing. |
| `retry_classification` | Advertised separately | Uses the existing retry flow; it does not resolve the question. |
| `mark_exact_item_memory` | Unavailable | Reserved for the Phase 5R.6 learning guard. |
| `request_policy_edit` | Unavailable | Reserved for a separately admitted policy-edit command. |

## Security And Idempotency Controls

- The fingerprint is recomputed from current server state. It is an integrity
  comparison value, not a bearer credential.
- Resolution takes the existing row lock and rechecks stale policy context
  before accepting an answer.
- Library existence is checked at the route boundary and active/media-type
  compatibility is checked inside the locked resolver.
- Discord emits compact, bounded component IDs containing the classification,
  action, destination, and fingerprint. The handler also verifies that the
  interaction is attached to the `discord_message_id` recorded for that
  classification before resolution.
- Legacy Discord clarification controls fail closed for policy-runtime
  questions and direct the operator to retry from the latest Classifarr queue
  state. Non-policy legacy clarifications retain their existing behavior.
- The resolved outcome records the exact answer version, fingerprint, action,
  and destination. A replay is idempotent only when all four values match the
  final recorded outcome; it does not repeat routing.
- The contract exposes `learning.eligible: false`; no answer action can write
  learning or change a policy. Phase 5R.6 will own the sole durable-learning
  admission guard.

## Implementation Outcome

- `GET /api/classification/pending` projects `policy_question_answer` only for
  current, actionable server-owned questions.
- `POST /api/classification/pending/:id/resolve` accepts the narrow answer
  payload and delegates to `ClarificationService.resolveRuntimeQuestionAnswer`.
- `NeedsAttentionPanel` renders server candidates, uses numeric destination
  IDs, and offers retry for unavailable or stale questions.
- Discord notifications use only the compact contract button format; the
  Discord handler binds each interaction to its stored notification message.
- Focused tests cover stale, malformed, changed, and legacy-label answers;
  contract-bound UI serialization; direct HTTP payload forwarding; Discord
  message binding; old-control fail-closed behavior; and exact replay
  idempotency.

## Recommendation Stack

1. Keep all policy-runtime answers on the versioned server-owned contract.
2. Treat every UI field and Discord `custom_id` as untrusted transport data;
   re-derive state and enforce scopes under the row lock.
3. Keep item resolution and learning separate until the Phase 5R.6 guard can
   admit a narrowly defined, auditable side effect.
4. Retire or fail closed old policy-question controls rather than maintaining a
   second compatibility resolver.

## Next Work

Phase 5R.6, Learning Guard And Outcome Separation, is next. Its first task is
to define the server-owned learning-admission guard and reason-code record so a
resolved item cannot become durable learning without an explicit, allow-listed
decision.
