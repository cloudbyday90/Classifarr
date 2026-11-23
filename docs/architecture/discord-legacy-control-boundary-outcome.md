# Legacy Discord control identity and message binding outcome

November 23, 2026 Eastern. See the
[design](discord-legacy-control-boundary-design.md) for sources and tradeoffs.

## Implementation

The legacy clarification button and `library_select` menu use exact wire
parsing. The menu accepts one selection and now shares the button's
safe-integer History cap. Legacy clarification requires the exact button
and a nonblank label at the presented index, a saved destination, and a
matching notification message. Astra confirmed the lock boundaries and
recommended matching the button ID at the presented position.

The shared resolver rechecks the exact message, destination, and absence of
a stored policy question under the existing History row lock. The selector
checks the same message ID under the existing correction lock, before it
validates the destination or writes correction or outcome evidence. An older
control with missing message proof directs the operator to Classifarr.
Compact answers and other correction entry points keep their own admission.

## Verification

- All 238 focused backend tests and 35 scoped PostgreSQL tests passed.
  The PostgreSQL controls used local Discord interactions and a routing
  stand-in. Bound legacy controls at the safe-ID boundary resolved and
  routed once. Missing or foreign message proof left the row and correction
  evidence untouched. The tests held real row locks while replacing a
  message, stored question, or destination and verified refusal after the
  replacement committed.
- The ownership gate passed with its existing manifest. No open PRs were
  available for local adoption or Dependabot rebasing.
- Fresh backend coverage passed 64,358 tests across 1,957 suites with one
  skip. The coverage ratchet passed using the verified client report and
  unchanged client inputs. Lint, type checks, preflight, policy checks, and
  Markdown lint passed.
- The root, server, and client npm audits reported zero vulnerabilities at
  check time. The preceding commit's Trivy run was blocked before scanning
  by an HTTP 429 from its database registry mirror.
  [Trivy job](https://github.com/cloudbyday90/Classifarr/actions/runs/45170340543)

## Next recommended item

Separate pending decisions from completed-item corrections in the shared
Discord selector. Store and recheck the pending question and the offered
destination so the exact message binding can support a future BIGINT change.
