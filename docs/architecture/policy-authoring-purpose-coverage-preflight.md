# Policy Authoring Purpose Coverage Preflight

Status: implemented for 12R.3 on 2026-08-16.

## Decision

Classifarr provides an explicit, administrator-only pre-save check for the
existing compatibility policy editor. The check validates the submitted draft
with the established server validator, derives only required `genres`,
`keywords`, and `studios` purpose terms, and compares them with current active
validated native contracts for other destinations of the same media type.

The result is advisory. It returns fixed status IDs, aggregate counts, and
server-authored guidance only. It cannot authorize a save, retain a draft,
create or change native intent, call AI, select a destination, queue work, or
change classification routing. A draft edit clears its previous result so it
cannot be interpreted as approval of changed content.

## Research

OWASP recommends allowlist validation and server-side semantic validation
before processing input. It also recommends authorization checks on every
request and least-privilege access to protected resources. NIST's
explainability guidance requires explanations to reflect the actual process and
its knowledge limits. These principles require a server-owned, authenticated,
bounded aggregate instead of browser comparison or an AI interpretation.

Sources:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [NIST IR 8312: Four Principles of Explainable Artificial Intelligence](https://doi.org/10.6028/NIST.IR.8312)

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Server-owned explicit preflight | Deterministic, uses current policy contracts, validates the actual draft shape, avoids provider use, and preserves authorization. | Adds a deliberate request before save. |
| Client-only comparison | Immediate local feedback. | Bypassable, exposes comparison logic, and cannot establish current authorized scope. |
| AI policy review | Can phrase suggestions naturally. | Probabilistic, provider-exposing, costly, and not routing or save authority. |
| Automatic repair or save | Reduces an interaction. | Changes policy authority without explicit operator action. |

## Recommendation Stack

1. Accept only `policy_intent_draft` on an authenticated administrator POST.
2. Reuse the existing strict server draft validator and derive required-purpose
   terms transiently; do not trust client policy, library, media type, score,
   or result values.
3. Read the requested policy's current persisted scope, then compare terms in
   PostgreSQL against eligible native contracts for other active destinations
   of the same media type.
4. Return only aggregate counts, one fixed status, and fixed guidance; do not
   return terms, rule JSON, classifications, profiles, history, RAG, provider,
   prompt, or AI data.
5. Keep saving, revision authority, native change commands, and routing on
   their existing server-owned paths.

## Contract

`POST /api/policies/:id/native-intent/purpose-coverage/preflight` accepts only:

```json
{
  "policy_intent_draft": { "...": "validated legacy editor draft" }
}
```

The server derives the policy/library identity from `:id`; request fields that
attempt to provide library, media, policy, candidate, or result scope are
rejected. The response provides:

- the persisted policy and library identity;
- counts for required signal types, required terms, unshared terms, shared
  terms, and overlapping destinations;
- `declared_specialized_coverage`, `missing_specialized_coverage`, or
  `broad_overlap_review_required`;
- fixed guidance; and
- explicit flags declaring that the response is advisory, no draft or raw
  configuration is retained or exposed, no provider is used, no database is
  written, and routing is unaffected.

The comparison uses active, inferred, valid-or-warning native intent with at
least one purpose rule. It excludes the current destination, so multiple
policies attached to one library do not create a cross-destination overlap.

## Verification And Outcome

Focused server, client, route, persistence, and real PostgreSQL integration
coverage proves validation, request allowlisting, administrator authorization,
aggregate-only response projection, current persisted scope, same-media-type
comparison, no raw-term disclosure, and no writes to `policy_intents` or
`policy_intent_rules`.

No migration is required. The feature reads existing contracts and retains no
preflight result or draft.
