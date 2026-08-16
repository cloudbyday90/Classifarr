# Native Intent Change-Command Purpose Preflight

Status: implemented for 12R.4 on 2026-08-16.

## Decision

Classifarr provides a distinct, administrator-only, read-only preflight for
one explicit native `update_purpose` command. It accepts a positive expected
revision and a typed purpose command only. The server derives the policy,
library, media type, active native intent, and current revision from the route
identifier and PostgreSQL; it does not accept client authority state, policy
scope, candidates, scores, results, or compatibility payloads.

The preflight first validates the exact command shape, reads the authoritative
native contract, and compares the expected revision with the current active
revision. Only then does it derive transient required identity terms and run a
same-media-type aggregate overlap query. A non-authoritative or stale contract
fails closed before the overlap query. The existing native change endpoint is
still the only mutation path and independently locks and checks its revision
inside its transaction.

There is intentionally no new Vue control in this task. The current native
experience is read-only and does not expose a native purpose-change command.
Adding a preflight panel without a revision-bound command form would create a
second policy-authoring path. When the native command is exposed, its UI must
discard advice whenever its typed command or loaded revision changes.

## Research

OWASP requires permission checks for every request and server-side allowlist
validation before processing request data. OWASP also advises REST APIs to
reject unexpected content. PostgreSQL documents that read-committed reads can
observe different committed state across statements, while `SELECT FOR UPDATE`
returns the current locked version. Therefore a preflight may provide only
advice bound to the observed revision; it cannot authorize a later write or
replace the write transaction's compare-and-swap check.

Sources:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Revision-bound server preflight | Uses the actual native authority and current media scope, validates a small typed command, returns no terms, and leaves write authority intact. | Adds an advisory read before a command can be applied. |
| Reuse the compatibility-draft endpoint | Reuses a visible endpoint. | Accepts the wrong abstraction, does not bind to `update_purpose` or its expected revision, and risks reopening compatibility authoring. |
| Trust browser authority or a prior preflight response | Fewer database reads. | Bypassable and stale; a browser cannot establish the current authoritative contract. |
| Let AI evaluate or repair purpose | Can offer natural-language suggestions. | Probabilistic, provider-exposing, and unsuitable for native command admission or routing authority. |

## Recommendation Stack

1. Require an authenticated administrator on every request.
2. Accept only `expected_revision` and one exact `update_purpose`
   `change_command`; reject aliases, legacy payloads, authority state, and
   unexpected fields.
3. Validate the bounded command with explicit signal, operator, values,
   semantics, and provenance allowlists. Keep its terms transient.
4. Derive policy scope and active native authority server-side. Reject absent,
   ambiguous, non-native, incomplete, invalid, or stale authority before
   comparing any coverage.
5. Compare only eligible native purpose rules inside PostgreSQL and project
   fixed coverage status, aggregate counts, fixed guidance, and the observed
   revision. Do not return terms, rule JSON, AI data, routing data, or a
   reusable decision token.
6. Keep the mutation endpoint's locked revision check as the only action that
   can create a new native intent revision, alter routing, or record history.

## Contract

`POST /api/policies/:id/native-intent/changes/purpose-coverage/preflight`
accepts only:

```json
{
  "expected_revision": 4,
  "change_command": {
    "command_id": "update_purpose",
    "values": [
      {
        "signal_type": "genres",
        "operator": "require_any",
        "values": { "require_any": ["Animation"] },
        "semantics": "identity"
      }
    ]
  }
}
```

The response is an advisory projection with:

- the fixed `update_purpose` command identifier;
- the expected and observed active revision;
- aggregate counts for required signal types, required terms, unshared terms,
  shared terms, and overlapping destinations;
- `declared_specialized_coverage`, `missing_specialized_coverage`, or
  `broad_overlap_review_required` plus fixed guidance; and
- explicit flags that the command was not retained, raw configuration was not
  exposed, the change was not authorized, no provider was called, no database
  was written, and routing was unaffected.

A stale revision returns `409` with
`POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_STALE_REVISION`. An unavailable
authority returns `409` with
`POLICY_NATIVE_INTENT_CHANGE_PURPOSE_PREFLIGHT_AUTHORITY_UNAVAILABLE`. Neither
response returns authority internals, terms, or rule values.

## Verification And Outcome

Focused service, contract, route, and real PostgreSQL integration coverage
proves exact request allowlisting, administrator authorization, authoritative
current-scope derivation, revision mismatch rejection, non-authoritative
rejection, aggregate-only response projection, no raw-term disclosure, and no
writes to `policy_intents` or `policy_intent_rules`.

No migration or provider configuration is required. Preflight results are not
persisted. A native purpose editor is deferred to 12R.5 and must use this
endpoint as advisory input only before invoking the existing write endpoint.
