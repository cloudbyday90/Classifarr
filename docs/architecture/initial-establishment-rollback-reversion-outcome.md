# Initial establishment rollback reversion outcome

Direct reversion now checks the exact establishment receipt and its
creation event in the locked snapshot read. It applies the check to
claimed snapshots and to snapshots in the initial-establishment path
namespace. A fresh initial reversion requires its established intent to
be active and restores compatibility. A verified completed reversion
still replays after expiry and payload redaction.

The command uses its existing blocked response when the proof is
missing. The proof keeps BIGINT comparisons in PostgreSQL and does not
expose the receipt, request fingerprint, or event metadata in the
response. The reversion event and reconciliation hold still commit with
the authority and snapshot updates.

## Verification

- In isolated PostgreSQL, merge imported an adjacent large snapshot and
  kept readiness pointed at the original. Authenticated reversion of the
  imported snapshot returned `409`, including after the fixture marked
  the copy restored. Neither request changed the saved intent, audit,
  hold, or snapshot state.
- Reversion of the verified original returned to compatibility, wrote
  one event, and installed a hold bound to that event. The exact result
  replayed after expiry and after retention redacted the snapshot.
- A claimed snapshot with a missing event fingerprint was refused even
  with a historical path. A valid receipt did not permit reactivation of
  the initial intent after a successor became active.
- The native policy-create route established a snapshot and event at the
  BIGINT maximum. The authenticated reversion kept the exact snapshot
  ID and retention preserved its attribution. Existing legacy rollback,
  predecessor reversion, conversion, rebuild, and retention tests passed
  in the focused run of 72 tests across ten suites.

## Quality gates

The fresh backend run passed 65,037 tests across 1,959 suites, with one
existing skip and 89.29% statement coverage. Client inputs and the
SHA-256 of the previous coverage report matched. Its statement coverage
was 87.84%. The coverage ratchet, ownership preflight, policy gates,
type checks, ESM checks, lint, schema check, and staged secret scan
passed. All three production dependency audits reported zero
vulnerabilities.

The disposable PostgreSQL fixtures were removed and the local
Classifarr container retained its identity and healthy status. GitHub
listed zero open pull requests.

## Follow-up

Compare establishment readiness with the same proof and manifest checks
used by direct reversion. Replace restore can change policy and library
IDs in relational rows while preserving the original IDs in the archived
manifest. First verify which remaps are supported and how readiness
should explain a snapshot the command would decline.

[Design, official sources, and tradeoffs](initial-establishment-rollback-reversion-design.md)
