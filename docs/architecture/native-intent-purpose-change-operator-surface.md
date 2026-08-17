# Native Intent Purpose Change Operator Surface

Status: implemented for 12R.5 on 2026-08-16.

## Decision

Classifarr exposes one administrator-only maintenance form for the active
native intent's declared purpose. The form first reads a narrow,
server-owned projection containing only the typed `update_purpose` command
and its active revision. It may request the 12R.4 purpose-coverage preflight
as advisory input, but it discards that advice whenever the command or
revision changes.

Applying the form posts only `expected_revision` and one typed
`update_purpose` command to the existing native-intent mutation endpoint. The
server owns admission, locks the persisted policy and active intent, rechecks
the revision in the transaction, and writes a new native-intent version plus a
constrained `native_intent_change_applied` audit event. The browser reloads
the narrow projection after an accepted write or stale-revision outcome; it
does not infer a committed result from local state.

The surface does not read or submit compatibility configuration, routing
targets, learning state, classifications, profiles, RAG, provider, prompt, or
AI data. It is maintenance outside normal new-policy authoring, not a second
policy-builder flow.

## Research

OWASP recommends deny-by-default authorization checks for every request,
server-side allowlist validation, and transaction authorization that validates
the intended action against current state. Conditional HTTP requests show why
a version validator is useful for stale-client detection, but application
state must still be checked at the authoritative persistence boundary. These
principles favor a small server projection, a typed command, and a locked
compare-and-swap write rather than browser-owned policy data or AI repair.

Sources:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [MDN: HTTP conditional requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Conditional_requests)

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Dedicated native-purpose surface and narrow read projection | Establishes current server authority, minimizes exposed data, preserves the existing write boundary, and gives the operator an explicit reviewable action. | Adds a dedicated read endpoint and focused UI component. |
| Reuse the compatibility editor or full policy read | Reuses existing screens and data shapes. | Reopens a retired authoring path and exposes unrelated configuration beyond the native-purpose operation. |
| Let an AI provider propose or apply the change | Could reduce operator input for some changes. | Probabilistic, provider-dependent, and cannot be policy or routing authority. |
| Auto-apply a change from preflight coverage | Fewer clicks. | Advisory aggregate evidence cannot establish intent or replace explicit transaction authorization. |

## Recommendation Stack

1. Require administrator authorization for the read, preflight, and mutation.
2. Read only the active native `update_purpose` command and its revision from
   server-controlled state; do not expose a generic policy projection.
3. Normalize the same exact typed command for read, preflight, and admission;
   allowlist signals, operators, value shape, semantics, and provenance.
4. Treat coverage as advisory and invalidate it when either command content or
   revision changes.
5. Lock and re-read the policy and active intent inside the write transaction,
   then reject stale or unavailable authority before any mutation.
6. Refresh from the server after a completed or stale operation. Do not use
   browser state as proof of commit.
7. Keep AI, compatibility data, routing, learning, profiles, history, RAG,
   and classification data outside this authority path.

## Contract

`GET /api/policies/:id/native-intent/purpose-change` returns the narrow
operator projection:

- current active revision;
- one canonical `update_purpose` command;
- an explicit display-only authority declaration; and
- false exposure flags for compatibility, AI, routing, and learning data.

`POST /api/policies/:id/native-intent/changes` accepts only:

```json
{
  "expected_revision": 4,
  "change_commands": [
    {
      "command_id": "update_purpose",
      "values": ["allow-listed native purpose rules"]
    }
  ]
}
```

The route rejects browser-supplied authority state, legacy payloads, aliases,
and unrelated fields. The preflight remains a separate, aggregate-only POST;
it has no authority to write, authorize, or retain the command.

## Verification And Outcome

Focused client coverage verifies rule editing, advisory invalidation, exact
write payloads, stale refresh, and the absence of compatibility or AI controls.
Focused service and route coverage verifies authorization, narrow read
projection, command normalization, unexpected-field rejection, and stale
outcomes. PostgreSQL integration coverage proves the native-purpose revision
and migration-event write commit together.

The migration `20260816_173000_add_native_intent_change_applied_event.sql`
extends the audit-event allowlist for the committed native-purpose change
event. This corrects the former mismatch that rolled back an otherwise valid
transaction.

## Follow-Up

12R.6 is complete. Native intent changes now use durable, actor- and
policy-bound idempotency receipts to replay an exact committed result after a
response-loss retry without creating another revision. See [Native Intent
Change Idempotency Receipts](native-intent-change-idempotency-receipts.md).

12R.7 is complete. The maintenance surface now reads an administrator-, actor-,
and policy-bound post-reload status through a separate bounded contract. It
shows a passive current-account revision notice only; it cannot expose retry
keys, fingerprints, command values, receipt history, or mutation authority.
See [Native Intent Change Recent Receipt
Discovery](native-intent-change-recent-receipt-discovery.md).

The next candidate is **12R.8 Native Intent Change Receipt Retention And
Capacity Guard**.
