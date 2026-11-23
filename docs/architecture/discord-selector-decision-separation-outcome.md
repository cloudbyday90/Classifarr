# Discord decision and correction controls outcome

November 23, 2026 Eastern. See the
[design](discord-selector-decision-separation-design.md) for the alternatives
and primary sources.

## Implemented behavior

An enabled compact answer must be offered on the clicked notification. The
answer transaction rechecks the stored message, current fingerprint and
offered destination under the History lock. Exact completed receipts retain
their replay behavior and an accepted duplicate does not route a second time.
The pending sender handles an unsent row already awaiting a decision under
the existing pending notification settings and delivery gate.

The existing shared library menu can correct a finalized item when the offered
option and correction control match a delivered receipt for that row and
message. The delivery must have originated on a completed or routed row.
The confidence tier's configurable action can disagree with the control shown,
so the gate uses the existing correction menu shape and receipt kind together.
Older pending menus, even after the item resolves, and completed menus without
matching delivery evidence direct the operator to Classifarr. This preserves
the existing wire formats and uses the existing transaction and database schema.

## Verification

All 250 focused backend tests and 143 isolated PostgreSQL tests passed. The
controls exercise actual Discord.js components and the Classifarr delivery
repository with local routing and Discord stand-ins. They cover a delivered
classification correction, an independently configured manual tier, a
pending-origin notification on a later completed row, absent and mismatched
receipt evidence, stale fingerprints, concurrent message replacement, exact
large IDs, and completed replay. Web admission and direct corrections have
independent regression coverage.

Fresh backend coverage passed 64,382 tests across 1,957 suites, with one
skip. The coverage ratchet passed with the verified, unchanged client inputs
and coverage reports. Lint, type checks, ownership and preflight, ESM checks,
policy gates, Markdown lint, and staged secret scanning passed.

The root, server, and client npm audits each returned zero findings. No open
PRs were available for local adoption or Dependabot rebasing at either check.

## Next recommended item

Qualify the older verification opener and direct correction buttons against
the exact stored Discord message and History row. Then assess widening the
completed correction selector's separate safe-integer limit.
