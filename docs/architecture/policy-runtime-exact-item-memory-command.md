# Policy Runtime Exact-Item Memory Command

## Status

Phase 5R.6.2 is complete. A resolved runtime item remains outcome-only until an
authenticated operator invokes the separate exact-item memory command.

## Problem

The runtime question answer closes a decision for one item. It is not an
authority to persist future classification evidence. Reintroducing an answer
field such as `mark_exact_item_memory`, or accepting a client-provided media,
destination, or learning flag, would let stale or altered browser data change
later classification behavior.

The command must therefore derive its complete write target from a
transaction-locked completed resolution and make the durable write idempotent.

## Official Research Basis

The implementation uses these official sources, reviewed August 3, 2026:

- [OWASP API Security Top 10: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
  requires authorization checks on every endpoint that uses a client-provided
  object identifier. The command treats the path classification ID as a lookup
  key only; its TMDB ID, media type, destination, and outcome are read from the
  locked row and revalidated server-side.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends a final authorization gate tied to execution, immutable
  transaction data, and unique operation credentials. The executor repeats the
  lock and authorization checks immediately before receipt claim and evidence
  persistence.
- [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
  identifies object/property authorization and sensitive-business-flow abuse as
  API risks. The endpoint rejects all request fields, accepts no destination or
  learning values, and returns only bounded status and reason-code feedback.
- [NIST AI RMF Playbook](https://www.nist.gov/itl/ai-risk-management-framework/nist-ai-rmf-playbook)
  and the [AI RMF Govern function](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  support defined human-AI roles, accountable decisions, and documented
  controls. The item outcome is distinct from the operator's later decision to
  retain exact-item memory.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Add a learn flag to the runtime answer | One interaction | Couples item resolution to durable learning and allows stale answer payloads to expand authority. |
| Write exact memory automatically after every resolution | Minimal operational work | One-off choices silently change future classification, with no distinct authorization or replay boundary. |
| Separate authenticated exact-item command derived from a locked recorded outcome | Revalidates target state, has a durable receipt, preserves outcome-only resolution, and permits a precise audit trail | Requires an explicit follow-up command when exact memory is warranted. |

## Decision

Use the separate command.

`POST /api/classification/history/:id/exact-item-memory` has an empty request
body. It is behind the existing authenticated admin classification router and
`requireReadWrite`. The route derives the actor from trusted middleware state;
it rejects client-provided actor, destination, item, media, and learning data.

The client API exposes `rememberResolvedExactItem(classificationId)` for a
future dedicated product control. Phase 5R.6.2 intentionally does not add a
runtime-answer action or UI control.

## Command Flow

1. `policyRuntimeExactItemMemoryExecutionState.mjs` locks the classification
   and current destination with `FOR UPDATE`.
2. It accepts only a `completed` or `routed` classification whose recorded
   outcome is a `resolved` `policy_question` outcome. It requires the stored
   current runtime-answer contract version, fingerprint, supported resolution
   action, matching destination, active same-media library, TMDB ID, and media
   type.
3. The command source event is derived as
   `runtime_exact_item_memory:<classification-id>:<answer-fingerprint>`.
   It is never supplied by the client.
4. `policyRuntimeExactItemMemoryAdmission.mjs` builds a canonical
   `operator_confirmation` intake with `remember_exact_item`. It only admits
   the `exact_item_memory` tier and cannot queue a profile refresh.
5. `policyRuntimeExactItemMemoryExecutionAuthorization.mjs` revalidates the
   authenticated actor, actor/intake match, locked state, and derived source
   event immediately before execution.
6. `PolicyAuthorizedOutcomeTransactionExecutor` rebuilds and relocks the
   state, claims the durable source-event receipt, verifies the existing final
   outcome, and calls only the exact-item-memory writer.
7. The final-outcome operation is
   `verify_recorded_final_outcome`, not `record_final_outcome`. The command
   never overwrites the original policy-question outcome or appends an
   artificial second outcome transition.

The receipt has the existing unique `(source_id, source_event_id)` boundary.
An identical retry is reported as replayed without calling the final-outcome or
evidence writer. A changed destination or outcome produces a different command
fingerprint under the same derived source event and is rejected before writing.

## Security Properties

- **Outcome-only resolution:** the runtime answer contract has no enabled
  exact-memory action; this command is the only Phase 5R.6.2 route to a write.
- **Server-owned target:** the request body is empty. The locked row supplies
  classification ID, TMDB ID, media type, active destination, and stored answer
  fingerprint.
- **TOCTOU resistance:** the command locks state before admission and the
  executor locks and revalidates it again before receipt claim.
- **Actor authority:** only authenticated middleware state is used. The actor
  must match the canonical intake at execution time.
- **Replay and substitution resistance:** derived source-event identity plus
  receipt fingerprinting rejects cross-item and cross-destination substitution
  and makes identical retries non-mutating.
- **Data minimization:** receipts and endpoint feedback carry IDs, status IDs,
  and reason codes. No model text, displayed library label, provider payload,
  or client-supplied decision text is persisted by this command.
- **Atomicity:** receipt claim, final-outcome verification, and exact-memory
  persistence run in one transaction. A writer failure rolls the receipt back.

## Implementation Outcome

- Added modular state, admission, authorization, effect, command-service, and
  route modules under `server/src/services` and `server/src/routes`.
- Extended the existing authorized-outcome command contract with the narrowly
  scoped `verify_recorded_final_outcome` operation. Its audit permits only an
  admitted exact-item-memory operation and no profile refresh.
- Added server API and client API coverage without wiring the command into a
  runtime question answer or user-facing decision flow.
- Added tests for complete locks, missing/stale outcomes, source-event
  substitution, missing exact-item references, authorization/executor flow,
  receipt replay, body rejection, and API export coverage.

## Final Recommendation Stack

1. Keep runtime resolution outcome-only and do not re-enable
   `mark_exact_item_memory` in the answer contract.
2. Keep exact-item memory behind this empty-body, authenticated,
   server-derived command and durable receipt boundary.
3. Use `verify_recorded_final_outcome` only for exact-item commands that prove
   an existing locked outcome; use `record_final_outcome` for workflows that
   actually create a final outcome.
4. Apply the same executor, provenance, and receipt pattern to the later 5R.6.3
   compatibility and identity evidence commands, with their required profile
   refresh outbox.

## Verification

- `policyRuntimeExactItemMemoryExecutionState.test.mjs`
- `policyRuntimeExactItemMemoryAdmission.test.mjs`
- `policyRuntimeExactItemMemoryCommandService.test.mjs`
- `classificationRouteExactItemMemory.test.mjs`
- Existing authorized-outcome executor and persistence-command coverage
- Client API and barrel-export coverage

## Next Task

Proceed with **Phase 5R.6, Task 5R.6.3: Compatibility And Identity Evidence
Admission**. It must retain the same authenticated, receipt-backed executor
boundary while requiring bounded intent/evidence-quality provenance and
profile-refresh outbox handling for destination evidence changes.
