# Contract-only pending classification resolution outcome

November 24, 2026. See the [design](contract-only-pending-resolution-design.md)
for the caller audit, implementation options and source review.

The shared transaction now parses the existing wire answer, rejects
non-resolution actions and normalizes the exact History ID before opening a
transaction. It derives the destination, recorded option and receipt from
the answer. The generic method, free-form label, safe-integer fallback and
BIGINT opt-in are gone. The public web payload and compact Discord button
still use the same contract and response fields.

Fresh resolution checks the locked row, current question, destination and
applicable Discord message binding before a write. Completed replay checks
the saved answer before rebuilding a question. A matching older unbound
receipt can replay for a safe ID. For large IDs the receipt must bind to the
exact row. A matching destination by itself returns `409`. The existing
post-commit learning command still owns its durable idempotency. Replay
never routes the item again.

## Verification

- The earlier private method treated a matching library as sufficient for
  completed replay. The regression supplies a valid command and verifies
  refusal and no outcome write when the receipt is absent.
- All 286 focused tests passed. Cases cover pre-transaction refusal of missing
  or malformed commands, default BIGINT maximum admission, saved question
  validation, native provenance and outcome-only learning.
- All 129 tests across six isolated PostgreSQL suites passed. Cases cover
  adjacent large History IDs, saved replay, safe-ID legacy receipts, missing
  or mismatched row bindings, exactly one route, and durable learning.
  Loopback HTTP and Discord fixtures exercised the real answer contracts.
- The full server run passed 64,544 tests across 1,958 suites with one
  existing skip. The coverage ratchet passed with 89.32% server and 89.58%
  client line coverage. The client report came from the preceding verified
  client run, with the same inputs and report hashes.
- Lint, type checks, preflight, ownership, ESM, policy and Markdown checks
  passed. All three workspace dependency audits returned zero findings.
  The local Classifarr container kept the same identity, start and health.

GitHub listed no open PRs at intake or before delivery.

## Next recommended item

Audit destination library IDs at answer admission. The shared contract
parser still uses numeric coercion for that separate identifier. Discord
already validates the positive PostgreSQL INTEGER range. Cleanup also parses
saved receipts through the shared parser. Verify accepted wire spellings and
historical encodings before tightening new command input.
