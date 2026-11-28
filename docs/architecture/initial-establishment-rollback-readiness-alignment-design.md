# Initial establishment rollback readiness after restore

On November 28, 2026, a disposable PostgreSQL 18 probe restored a real
initial establishment from its exported archive. Replace restore moved
policy `1` to `4800`, library `1` to `4700`, and snapshot
`9007199254740992` to `9007199254740993`. The receipt followed the new
snapshot. The archived manifest still recorded policy and library `1`.
The readiness service reported `rollback_available` after restore,
while the reversion command's manifest validator rejected the remapped
owner. The probe read both verdicts without applying reversion.

## Proposed contract

- Keep archived manifests and backup restore behavior. A pending
  snapshot with historical owner IDs needs maintenance review.
- In the administrator readiness query, resolve the receipt's actual
  snapshot under the current policy. Reuse the exact receipt and event
  proof used by reversion. Scope the declared-rule read to the policy and
  library as well as the linked intent. Use only the command's current
  policy and library scope when checking for ambiguous active authority.
- Validate initial-establishment manifests in PostgreSQL for both the
  read and the locked command. Match each owner as a JSON number or its
  canonical decimal string. Require the existing restore section names,
  legacy-policy object, presets array, and routing-target field. The two
  current establishment entry points already emit this shape. Alternate
  spellings or containers that previously passed JavaScript coercion may
  need maintenance review. Keep other snapshot families on their
  existing manifest checks.
- Project only bounded proof and manifest booleans from the snapshot and
  event on the GET. Keep the existing HTTP and response structure, with
  fixed recovery states for unverified proof, invalid manifest and
  ambiguous live authority. These states require maintenance review.
  Check proof before a saved restored timestamp. Verified completed
  rollbacks still report `reverted` after expiry or redaction. Existing
  redaction and expiry states keep their display order when no completed
  rollback is recorded.
- Keep GET advisory and read-only. The POST still evaluates admission
  under its existing locks before any authority, event or hold changes.
  Keep existing access checks, temporary-read failure, statement count,
  declared-rule limit and exact ID representation.

## Guidance and tradeoffs

PostgreSQL Read Committed gives each `SELECT` one statement snapshot.
Calculate ownership, proof, and recovery facts in the same read and keep
the write's locked validation authoritative. Typed JSONB operations can
check names and shapes inside PostgreSQL without returning the archived
body to the application.
[PostgreSQL isolation](https://www.postgresql.org/docs/18/transaction-iso.html) ·
[PostgreSQL JSON functions](https://www.postgresql.org/docs/18/functions-json.html)

W3C PROV distinguishes original records from their derived copies. Use
the remapped foreign keys to follow the receipt, and preserve the
archived manifest as evidence of its original owners. HTTP defines GET
as a safe read, and OWASP places the final authorization check at
execution. Apply both principles by keeping status reads observational
and rechecking admission in the command.
[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) ·
[RFC 9110](https://www.rfc-editor.org/info/rfc9110/) ·
[OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)

| Option | Benefit | Cost |
| --- | --- | --- |
| Share proof and manifest checks while preserving archives | Availability reflects the command, and restore keeps historical evidence | Some restored snapshots require maintenance review |
| Report only restored owner mismatch on GET | Small read-only patch | Other proof and shape failures still produce misleading readiness |
| Remap live manifest owners during restore | Could make verified restored snapshots usable | Needs separate evidence for all references and preserves provenance only with an explicit model |

Astra recommends the first option. Use the shared proof and bounded
manifest checks, preserve existing writes and restore semantics, and
consider a provenance-preserving remap after inventorying which archived
references can be mapped reliably.

## Verification

Exercise authenticated GET and POST against disposable PostgreSQL.
Verify that replacing a real archive moves relational IDs but preserves
the complete manifest, readiness shows maintenance review, and the POST
leaves authority, snapshots, events and holds intact. Cover exact
adjacent BIGINT IDs, invalid proof ahead of a restored timestamp,
verified redacted replay, valid initial producers, cross-owner rule
isolation, and ambiguous active authorities. Run the local gates, keep a
separate outcome, update Unreleased, and push on main without a release.
