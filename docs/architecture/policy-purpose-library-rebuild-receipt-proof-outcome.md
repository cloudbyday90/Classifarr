# Policy-purpose library rebuild receipt proof outcome

Policy-purpose inventory, recent coverage, and held-out re-audit now
check the saved event evidence for library rebuilds with large linked IDs.
The verification runs inside PostgreSQL before the recent source limit.
The reports still use their aggregate fields and administrator controls.
PostgreSQL compares typed JSONB to exact values derived from the stored
BIGINT columns, and keeps the event metadata private.

The capture check uses the linked capture event when the original intent
or verification run is large. The replacement check verifies the joined
event when the original intent, replacement intent, gate, snapshot, or run
is large. Safe legacy references and independent large event primary keys
continue to qualify through the existing relations. The reports qualify
historical lifecycle evidence independently of completed command replay and
removal readiness.

## Local verification

- Before the fix, the three reports credited a genuine rebuild and kept
  its credit after the fixture stored a large replacement reference as
  a JSON number. Replay and removal readiness rejected that reference.
  The reports also counted the fixture after its capture event lost the
  run reference. Completed replay still returned the saved outcome.
  Both unproven cases lost report credit after the fix.
- A real capture and replacement fixture exercised each large link
  independently, adjacent IDs, the BIGINT maximum, safe companion
  representations, and high event primary keys with otherwise safe links.
  Missing keys, a neighboring reference, and high JSON numbers removed
  credit. All seven execution gates remained stored.
- Recent coverage refilled a limit-one page from an older eligible rebuild.
  The retained event proof qualified after snapshot payload redaction.
  The rebuild stayed in recent history and held-out counts after the
  original became active again. Current-revision credit followed the
  active intent.
- A query-plan probe on one synthetic rebuild used a single indexed
  capture-event lookup. The limit-one report took 0.46 ms in that run.
- The isolated PostgreSQL 18 run passed 46 tests, including existing
  identity, rollback, and purpose coverage controls. The focused backend
  run passed 234 tests, including the administrator route and report
  projection checks. Astra reviewed the high-ID branches and the filter
  position.

## Quality gates

Fresh backend coverage passed 64,981 tests across 1,959 suites with one
existing skip and 89.33% statement coverage. The client coverage report
recorded 7,751 passing tests and 87.84% statement coverage. Its inputs and
SHA-256 were verified before reuse. The coverage ratchet, type checks,
preflight, policy and ESM gates, server and documentation lint, migration
checks, and staged secret scan passed. All three production dependency
audits reported zero vulnerabilities.

The isolated PostgreSQL fixtures were removed. The protected local
Classifarr container retained its identity, start time, and healthy
status. GitHub showed zero open PRs.

## Follow-up

Test how the initial-establishment source handles its linked migration
event. The shared report accepts an established row with an intent link.
Compare that with the writer's event acknowledgement and determine in
isolated PostgreSQL whether a historical link can cause false credit.

[Design, official sources, and tradeoffs](policy-purpose-library-rebuild-receipt-proof-design.md)
