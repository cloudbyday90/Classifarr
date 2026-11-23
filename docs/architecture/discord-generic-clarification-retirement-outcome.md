# Retire generic Discord clarification buttons outcome

November 23, 2026 Eastern. The [design](discord-generic-clarification-retirement-design.md)
records the release history, tradeoffs, and official sources.

## Delivered behavior

Clicks on historical generic `clarify` buttons now receive a private reply
directing the operator to the Classifarr Command Center. The response is fixed
text. That branch performs zero database operations and leaves the original
Discord message intact. The retired write handler and delegate were removed.

Current `ai_clarify`, `ai_answer`, verification, and correction interactions
retain their independent handlers. The authenticated HTTP clarification route
still uses its shared writer. Historical responses remain in the database.

## Verification

The dispatcher tests cover repeated clicks with a historical button format
and with missing identifier tokens. They assert one ephemeral reply per
click and zero database, response-writer, or routing calls. The HTTP
integration test checks authentication, the stored response, and the History
confidence update on a synthetic item. It runs against isolated PostgreSQL.
All 516 focused tests in 28 suites and 182 integration tests in nine suites
passed. All three npm audits reported zero findings.

The full backend coverage run passed 64,428 tests across 1,957 suites.
Statement and line coverage were 89.36%, and branch coverage was 86.87%.
The coverage ratchet passed with the prior client report after its inputs
and checksums were verified. Lint, type checks, CI preflight, import and mock
checks, product-policy gates, and Markdown passed. Local checks skipped one
Linux-only filesystem test and two symlink cases on Windows. Discord replies
were checked through local interaction fixtures. GitHub listed no open PRs
for local adoption or Dependabot rebasing.

## Next recommended item

Review the authenticated legacy `/api/clarifications/:id/respond` contract.
Establish the intended route-to-body item identity and server-owned question,
actor, and confidence provenance. Verify atomicity and replay of its response
insert and History update before changing the active HTTP writer. The current
client prompt response API uses a separate service.
