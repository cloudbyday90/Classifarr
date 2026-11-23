# Exact History IDs in Discord completed decision buttons outcome

November 23, 2026 Eastern. See the [design](discord-completed-buttons-bigint-design.md)
for recommendations, tradeoffs, and the official sources.

## Delivered behavior

The existing `correct`, `verify_yes`, and `reclassify` buttons accept exact
History IDs through `9223372036854775807`. The parser splits the existing
bounded formats into action and identifier tokens, requires the correct
number of tokens, and uses the existing PostgreSQL ID validators. Previously
delivered components use the same format. Safe IDs retain their numeric
representation in services, and larger IDs stay as decimal strings. Destination
library IDs use the existing INTEGER range.

The interaction still requires an enabled offered button and its saved Discord
message. The persistence path checks the matching delivered notification under
the History lock and applies the action's existing eligibility and replay
rules. Affirmative verification writes the outcome before routing. Direct
correction also records the correction and preserves a valid original-decision
snapshot when available.
The earlier verification opener, correction selector, and pending answers
keep their existing behavior.

## Verification

Before the parser change, three focused large-ID cases and seven isolated
PostgreSQL cases failed at the safe-integer gate. The new cases exercise
adjacent large rows, BIGINT max, cross-notification refusal, destination
eligibility, rollback, a committed write with its acknowledgement discarded,
and replay. PostgreSQL tests use installed Discord.js components and the
production database adapter. They observe routing at the application's
provider boundary with a stub. All 421 focused tests and 221 PostgreSQL tests
passed. All three npm audits reported zero findings.

The fresh backend run passed 64,431 tests across 1,957 suites with 89.36%
statement and line coverage and 86.87% branch coverage. The coverage ratchet
passed with the previously verified client report and unchanged client
inputs. Lint, type checks, ownership and other CI preflight checks, Markdown,
and the import, test-mock, and product-policy gates passed. Local verification
skipped one Linux-only filesystem test and two Windows symlink fixtures. The
previous completed-button regex lint warning is gone. GitHub listed no open
PRs for local adoption or Dependabot rebasing.

## Next recommended item

Audit the older `clarify` button dispatch first. It still uses permissive
numeric parsing and records a response without the saved-message check used by
the other buttons. The current source has a consumer and no matching renderer.
Determine whether older messages still need a compatibility path, then test
its refusal or exact binding before widening any legacy question controls.

For index-only `ai_clarify` messages, assess migration to the existing
fingerprinted pending answers. The renderer, parser, handler, and shared
resolver still cap those legacy controls at a safe integer.
