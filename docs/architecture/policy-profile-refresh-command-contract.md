# Policy Profile Refresh Command Contract

## Status

Implemented as Phase 6R.3.3e.1. This is a pure contract and parent-command
audit. It does not persist a refresh request, invoke a profile generator, or
create a background worker.

## Problem

The authorized outcome command can express a profile-refresh operation when a
compatibility or identity learning candidate changes destination evidence. Its
original audit validated only that an outcome-only command had no refresh
operation. A malformed ready command could therefore target a different
library, omit the guard reason, or attach refresh work to exact-item memory.

Executing refresh now would be premature. Compatibility and identity evidence
writers do not yet durably commit the causal change, so there is no transaction
that can atomically record evidence and its refresh request. The existing
library profile generator remains an operational recovery tool, not this
learning workflow's durable consumer.

## Official Guidance Reviewed

Official sources reviewed July 26, 2026 against the requested June 2026
baseline:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends validating authorization for every request and failing safely.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived state, explicit workflow transitions, and treating
  concurrent execution as a threat.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires controlled state transitions and an authorization control at
  execution time.
- [AWS Transactional Outbox Pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
  recommends committing the business change and durable event together, then
  processing events with an idempotent consumer.
- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html)
  documents that `SKIP LOCKED` is appropriate for queue-like tables with
  multiple consumers, not general-purpose consistent reads.

## Design

```text
canonical intake + guard + locked state + revalidated authority
  -> authorized outcome command
  -> parent-command audit
  -> policy.profile_refresh_command.v1
  -> later: same-transaction evidence record + outbox row
  -> later: idempotent worker invokes library profile generator
```

`policyProfileRefreshCommand.mjs` accepts an already built authorized outcome
command and independently reruns the parent audit. It emits a compact command
only when all of these are true:

- the parent command is a valid `ready` plan;
- the learning operation is compatibility or identity evidence;
- the operation is `queue_profile_refresh`;
- the target library matches the locked current state, final outcome, and
  learning candidate; and
- the guard included `profile_refresh_required`.

The compact command retains only source/event correlation, classification and
destination IDs, learning operation/tier, and candidate key. It never retains
labels, raw answers, AI content, provider payloads, route diagnostics, or an
actor context.

Exact-item memory, outcome-only decisions, hard-limit edits, blocked commands,
and malformed parent commands return a non-executable result. No caller can
convert a client-supplied refresh request into this command.

## Options Considered

### Invoke the Existing Profile Service From the Executor

Pros: smallest code change.

Cons: introduces a database-to-service dual write, cannot prove the evidence
change committed, and makes retries unsafe; rejected.

### Add an Outbox and Worker Before Evidence Writers Exist

Pros: establishes queue infrastructure early.

Cons: creates refresh work with no durable causal evidence mutation and violates
the Phase 6R.3.3e dependency; rejected.

### Validate a Pure Refresh Command Before Adding Writers and the Outbox

Pros: closes malformed-command paths now, preserves fail-closed behavior, and
defines a compact future queue payload without enabling a side effect.

Cons: no profile refresh is yet consumed; selected.

## Final Recommendation Stack

1. Build and audit the authorized outcome command from server-locked state.
2. Emit a refresh command only for compatibility or identity evidence and only
   with the guard's refresh reason.
3. Require every destination reference to match the locked final outcome.
4. Persist compatibility and identity evidence before any refresh request can
   exist.
5. Insert the evidence mutation and outbox row in one transaction.
6. Let an idempotent background worker claim queue rows and invoke the existing
   profile generator only after commit.
7. Keep exact-item memory, hard-limit policy edits, and direct route/UI refresh
   mechanisms outside this learning consumer.

## Security Outcome

- Refresh intent is fully server-derived from a validated parent command.
- The audit rejects destination substitution, unsupported tiers, missing guard
  reason codes, and invalid or outcome-only commands.
- No database, provider, media-server, queue, or profile side effect occurs in
  the contract.
- Future consumers receive no raw AI, provider, answer, route, or actor data.

## Verification

Focused tests cover a valid compatibility command, exact/no-refresh behavior,
and destination substitution. Parent-command audit coverage asserts that an
invalid refresh destination blocks the command before a future consumer can
persist or execute it.

## Next Step

Phase 6R.3.3e.4 is implemented in
[Policy Profile Refresh Outbox Persistence](policy-profile-refresh-outbox-persistence.md).
Proceed to **Phase 6R.3.3e.5: Refresh Worker Consumer**. It must claim only a
committed outbox row and invoke the profile generator outside the evidence
transaction.
