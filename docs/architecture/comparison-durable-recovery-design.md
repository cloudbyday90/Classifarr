# Durable comparison incident recovery

Date: 2026-10-09. Scope: optional comparison warning lifecycle; no release.

## Problem and contract

The previous tracker owns exact warning UUIDs only until its process exits.
A subsequent healthy refresh cannot safely associate those warnings with itself.
Persist new incident ownership, not guesses based on record age or container name.

Use one database-local ledger row with a random HMAC key, opaque configuration
and verified model fingerprints, episode/scope UUIDs, and at most 128 warning
UUIDs. Never persist an endpoint or model response in this ledger. A new database
creates no ledger until there is a correlatable warning. Existing uncorrelated
and version-1 warnings are not retrospectively claimed.

One session advisory lock encloses the scheduled refresh and its reporting.
The lock connection also owns the short incident transactions. Losing it aborts
the refresh and prevents a disconnected owner from committing a resolution.
There is no age-based lease takeover. Lock order is comparison session, then the
existing discovery admission; no transaction spans provider work.

Only a configuration and representation inspected during the current attempt
can create or recover a durable incident. The representation includes provider,
model, digest and dimensions. Pre-inspection failures retain conservative
process-local tracking. Observed configuration changes or disablement abandon
the prior ledger episode without changing its warnings. Model changes do the
same. Readiness refusals cannot borrow a previous attempt's identity.

Warning insertion and ledger membership commit atomically. Recovery requires
`ready` or `revalidated`, matching fingerprints, exact IDs and version-2 metadata.
Resolution and ledger clearing share a transaction; original warning evidence
and manually resolved records remain unchanged. Unknown/ambiguous outcomes
remain open until another verified refresh, without replaying external writes.

## Bounds and failure behavior

- One active refresh per database; one small ledger row, 128 IDs maximum.
- Existing 360-second refresh deadline, resource admission, memory limits,
  completeness checks and scheduler retry policy remain unchanged.
- Ledger transactions: 3-second statement, 1-second lock, 5-second transaction
  timeout. No new provider request, background retry loop or cooldown reset.
- Busy ownership defers without a warning. Shutdown/connection loss cancels.
- Database/log persistence failure falls back to existing warning behavior;
  it never fabricates recovery. Overflow warnings are not durably claimed.
- Advisory ownership coordinates cooperating current versions, not hostile
  database users. It is not a new security boundary or ingestion ownership fix.

## Research and alternatives

Official sources retrieved through search on October 9, 2026:

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html):
  session advisory locks survive transaction boundaries and are released when
  the session ends. This supports ownership across HTTP work without long SQL
  transactions; all participants must cooperate.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  retain useful correlation while excluding sensitive values. Separate original
  failure evidence from the later recovery observation.
- [Node crypto documentation](https://github.com/nodejs/node/blob/main/doc/api/crypto.md?plain=1):
  use built-in HMAC and cryptographic random bytes for opaque scoped comparison.

| Approach | Benefit | Cost / limitation |
| --- | --- | --- |
| Process-only IDs | Small, already verified | Restart loses continuity |
| Message/age matching | Little new storage | Can close an unrelated failure; rejected |
| Database ledger and session ownership | Restart continuity with exact evidence | One extra held connection; conservative exclusions |

Recommendation stack: exclusive refresh → current configuration/model evidence
→ atomic bounded incident ledger → exact conditional resolution → existing log
history. Test restart, competing sessions, termination, rollback and changed
configuration using isolated PostgreSQL. Keep sustained resource profiling as
the next independent operational check; do not weaken safeguards to obtain it.
