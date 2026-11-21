# Saved replacement and routing evidence

November 21, 2026 Eastern. Approved design assessed at `5c4bfe7b5`.
The [refusal details](retry-lineage-refusal-details-outcome.md) explain the
original verification failure. This proposal addresses generic refusals after a
local replacement committed.

## Evidence and recommendation

The transfer transaction records the replacement ID and completion claim
together on the retry proof. Those values establish that a local replacement
was committed for that exact task. The evidence can survive removal of the
History row. A later claim can legitimately differ from the completion claim.

A routing pointer can conflict with the replacement ID and cause a refusal.
Even a matching pointer records routing admission. It does not establish that
a provider received or applied a write. Missing and contradictory routing
evidence therefore get the same qualified explanation.

In the existing failed Queue read, check completion for generic terminal
classification refusals from the trusted retry sources. Use the proof's task
primary key and both completion fields in the same bounded SELECT. Keep the
current list order, limit and authorization. Project only a positive boolean.
No extra request or live History, library, owner or provider lookup is needed.

Use the existing **Why this stopped** disclosure for the explanation.
Suggested copy is “Classifarr saved the local replacement. Routing remains
unverified for this task.” A recorded refusal category keeps its existing
explanation. A generic refusal without completion evidence keeps the current
general wording. Opening or refreshing the card cannot admit, replay or
reconcile a write.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Read the completed proof on the bounded list | Covers existing failures and uses the durable transaction record | Adds an indexed lookup per eligible row and only establishes local completion |
| Save another reason on failure | Captures the worker's observation at that attempt | Duplicates existing completion evidence and leaves older refusals unresolved |
| Inspect routing state directly | Could explain an independently confirmed destination | Requires an authenticated reconciliation design with explicit provider and replay boundaries |

## Verification and sources

- Verify the positive projection with real PostgreSQL and HTTP for both sides
  of completion, a contradictory or absent routing pointer, a later claim,
  unrelated tasks, older failures and missing History. Verify one bounded read
  and exclude replacement IDs, claim tokens, proof details and payload lookalikes
  from the new field.
- Preserve the replay guard and exercise existing rollback, lost acknowledgement
  and routing recovery tests. UI tests should cover generic and recorded reasons,
  accessible disclosure at narrow width, and existing action availability.
- Run affected tests, coverage and quality checks before committing on main.
  No migration or backfill is needed.

Official guidance checked through MCP on November 21, 2026 Eastern.

- PostgreSQL commits local work atomically. Keep the completion check on the
  bounded failed-list projection. [Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
  · [SELECT](https://www.postgresql.org/docs/18/sql-select.html)
- Use the existing authorized read boundary and disclose only what it needs.
  [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- Treat uncertainty about a provider write independently from local commit.
  [RFC 9110, idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)
- Keep the supporting text keyboard-accessible in the existing disclosure.
  [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
