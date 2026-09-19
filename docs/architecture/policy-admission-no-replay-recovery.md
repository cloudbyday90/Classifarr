# Policy admission: recover state without replaying writes

Date: 2026-09-19. Design and outcome from the PR 532 browser validation.

## Cause and change

`admitPolicyAuthoringProposal` supplied an idempotency key but did not opt out of
the shared Axios transport's automatic retries. A dropped response triggered
1/2/4-second delayed replays before the existing outcome-recovery composable could
read the current policy lifecycle. The new browser test genuinely aborts the
response after simulating a successful server write; it exposed this delayed,
repeated admission behavior rather than simply mocking a resolved failure object.

The named API function now sets the existing `skipAutomaticRetry` option. It keeps
the same request body, revision checks, CSRF handling and idempotency header.
On an uncertain result, the existing composable immediately reloads lifecycle,
finds an already-created policy when available, and removes the obsolete create
action. No new service, API contract, global retry change or user control is needed.

## Alternatives and standards

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Keep transport retries | Can recover an idempotent response | Delays existing reconciliation and repeats admission; reject here |
| Read lifecycle after uncertainty | Immediate recovery, no repeated write, existing UI | Read may fail or race commit; retain existing unavailable-state guidance |
| Remove all client write retries | Wider consistency | Cross-cutting behavior change; defer to a separately scoped audit |

[HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) distinguishes
safe retry behavior from blindly retrying non-idempotent methods. This endpoint
already has server idempotency protection; the change is not a claim of duplicate
policies or a standards violation. It chooses existing read-side reconciliation
over delayed replay for a caller that can inspect the committed state.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
supports communicating asynchronous results without moving focus. Existing status
feedback and recovery notices are retained; no new alerts, acknowledgement or
screen density is added. Sources were discovered and read on 2026-09-19.

The no-replay option also returns authentication failures to the caller rather
than refreshing authentication and automatically replaying the admission. This
does not bypass authentication; current failure/recovery guidance remains active.

## Validation and outcome

- API unit test requires the idempotency header and `skipAutomaticRetry: true`.
- Existing transport tests cover no automatic network/status/authentication replay.
- Browser lost-response test aborts the request, expects a lifecycle reread and
  existing-policy guidance, and asserts exactly one admission request.
- Stale-admission test checks refreshed guidance and exactly one request.
- Concurrent-tab test checks one created/one conflicting outcome without retries.

Recommendation: preserve idempotent server writes → return uncertain outcomes →
read current lifecycle → render one current action. Audit other mutation endpoints
with existing reconciliation next, separately from the library-learning work.
Rollback is local to the API request option; no database migration is involved.
