# Discord verification and direct correction button outcome

November 23, 2026 Eastern. See the
[design](discord-legacy-completed-buttons-design.md) for the options and
source references.

## Implemented behavior

Classifarr admits the existing `correct`, `reclassify`, `verify_yes`, and
`verify_no` commands only for the exact enabled button on the clicked message.
The safe-integer History limit and positive 32-bit destination limit apply.
A shared database check requires the saved Discord message and a delivered
receipt for the same row, message, and expected kind. The receipt must have
started on a completed or routed row. Older messages with missing or stale
evidence direct the operator to Classifarr.

Affirmative verification commits the status and outcome together under the
History lock. A duplicate verified or routed decision returns without another
write or provider call. A pending, corrected, or superseded decision cannot
receive a new affirmative verification. The verification opener checks the
same evidence before reading destinations, releases its transaction before
editing the Discord message, and the resulting selector independently admits
the eventual selection. Direct correction uses the same receipt gate as the
selector and records its outcome in the existing correction transaction.

## Verification

All 103 focused tests and 158 isolated PostgreSQL tests passed. The checks
covered the four actual button shapes, successful routing through a stand-in,
duplicate affirmative clicks, rollback on a real SQL error during outcome
writing, and concurrent message changes. They also exercised the generated
verification selector, the two pending formats, and prior correction and
delivery regression suites. The positive cases reached the safe-integer
boundary and verified the exact provider destination. Astra reviewed the
production paths and reported no blocking findings.

Fresh backend coverage passed 64,400 tests across 1,957 suites, with one skip.
The coverage ratchet passed using the client report after verifying its hashes
and inputs. Lint, type checks, ownership and preflight, ESM checks, policy
checks, Markdown lint and staged secret scanning passed. The root, server,
and client npm audits each returned zero findings. GitHub listed no open PRs
for local adoption or Dependabot rebasing.

## Next recommended item

Widen the completed correction selector to exact PostgreSQL BIGINT History
IDs. Carry the ID through the verification opener, menu rendering, parsing,
the locked receipt check, correction evidence, and provider routing. Test
adjacent IDs at the existing safe-integer boundary and retain the destination
ID range.
