# Policy Native Intent Post-Conversion Runtime Observation

## Status

Implemented as automatic outcome feedback for an approved native intent
conversion. It is a read-only post-commit observation, not a second approval,
automation switch, or compatibility-deletion gate.

## Problem

An administrator could confirm a bounded native intent conversion and receive a
successful write result, but that result alone did not show whether the live
runtime reader now resolved the selected policy from native storage or whether
an active rollback snapshot was present. Requiring the administrator to run a
separate verification workflow would add the manual work that the
intent-first model is meant to remove.

## Official-Source Research

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  describes `Read Committed` visibility per command. The observation runs only
  after the conversion transaction returns, so it queries committed current
  rows rather than trying to treat the pre-conversion plan as proof.
- [OWASP API5: Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
  recommends explicit authorization for administrative functions. The
  observation remains inside the already administrator-only conversion action;
  it does not create a new public diagnostic endpoint.
- [OWASP API6: Unrestricted Access to Sensitive Business Flows](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/)
  supports bounded, protected handling for consequential flows. The observer
  accepts the same maximum of twenty-five policy IDs as the conversion action.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends recording useful security-event context while excluding secrets
  and excessive payloads. The response and route log only status, counts,
  policy IDs in bounded risk records, and no legacy or native JSON payload.

## Options Considered

### Separate Verification Screen

Pros:

- Could show a larger historical report.

Cons:

- Adds an operator workflow after a confirmed action.
- Splits the proof from the conversion result and encourages stale checks.
- Reintroduces the manual, advanced-control experience removed from policy
  authoring.

### Persist A New Verification Record For Every Conversion

Pros:

- Creates durable historical observation records.

Cons:

- Adds storage, retention, and privacy obligations before a consumer needs
  that history.
- A stored observation can still become stale, so it cannot replace later
  compatibility-deletion evidence.

### Automatic Read-Only Observation In The Existing Response

Pros:

- Proves the selected current policies resolve through the real native runtime
  path immediately after conversion.
- Confirms an active, unredacted rollback snapshot without reading its payload.
- Keeps the action one confirmation, one response, and one maintenance screen.
- Returns a bounded unavailable state instead of hiding an observation failure
  behind a conversion success.

Cons:

- It is immediate evidence, not a long-running production-monitoring signal.
- It intentionally does not prove that compatibility code can be deleted.

## Final Recommendation Stack

1. Keep the existing administrator-only, typed-confirmation conversion action
   as the sole mutation boundary.
2. After its transaction completes, call
   `policyNativeIntentRuntimeObservation.mjs` for only the selected policy IDs.
3. Attach each policy through the existing native read service and evaluate the
   exact runtime read path used by detailed policy reads.
4. Check only for a current, unredacted, un-restored rollback snapshot; never
   load or return the snapshot payload.
5. Render a concise status, count, and warning in the existing maintenance
   screen. A failed observation never silently reverses a committed conversion
   and never authorizes compatibility removal.

## Implementation Outcome

- Added `policyNativeIntentRuntimeObservation.mjs`.
- The conversion action now returns `runtimeObservation` only after an applied
  or already-current result.
- Observation verifies, per selected policy, native runtime source/status,
  read validation, authority metadata, and rollback availability.
- Observation is bounded to twenty-five unique positive policy IDs, has no
  write operations, and reports generic unavailable status without database
  error text.
- The conversion maintenance screen now shows the immediate read-only
  verification outcome after a successful confirmation.
- Compatibility deletion, routing configuration, profile freshness, and
  automation readiness remain separate decisions.

## Validation

- Focused server tests cover verified native reads, missing rollback snapshots,
  bounded unavailable results, invalid selections, and no write statements.
- Conversion-action tests cover propagation of the read-only observation.
- Client composable and view tests cover retention and presentation of the
  returned observation.

## Next Step

Continue the existing **Compatibility Path Deletion Readiness** evidence chain.
This immediate conversion outcome is useful operational proof, but it must not
be promoted to deletion authority without the existing current-artifact,
backup/restore, support, and approval gates.
