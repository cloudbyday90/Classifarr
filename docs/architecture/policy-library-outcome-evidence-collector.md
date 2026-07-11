# Policy Library Outcome Evidence Collector

## Status

Implemented as the first source-specific collector for the policy evidence
envelope.

The collector reads a bounded, destination-library-scoped set of final
classification outcomes and manual corrections. It returns only stable evidence
keys, fixed labels, final status, confidence, timestamps, and reason IDs. It
does not read titles, media metadata, correction actor values, learned
corrections, provider data, or routing state.

## Problem

The evidence envelope accepts bounded source snapshots but must not become a
cross-table query service. The classification history and correction tables are
the authoritative records for final outcomes and explicit manual correction
events. A focused collector makes that database boundary explicit, parameterized,
and testable.

## Official Guidance Reviewed

- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  recommends prepared statements and least privilege. Both fixed read queries
  use bound parameters for library ID, allowed statuses, and row limit.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allow-list validation. The collector accepts only a
  positive integer library ID and uses a fixed final-status allow-list.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimizing sensitive data. The collector does not select titles,
  metadata JSON, correction actors, or database error text.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports documented security requirements and provenance. Returned records
  preserve stable source keys and timestamps without carrying original payloads.

## Recommendations

1. Keep final outcomes and manual corrections in separate, fixed queries.
2. Scope both queries to the destination library, never a global history scan.
3. Read at most 51 records and emit at most 50 so truncation is explicit.
4. Use only final statuses: `completed`, `corrected`, `verified`,
   `reclassified`, and `routed`.
5. Treat output as evidence for the envelope, not as an automatic learning or
   policy-write instruction.

## Pros And Cons

Pros:

- Makes persisted outcome provenance explicit and independently testable.
- Prevents raw history metadata and user identifiers from entering the evidence
  contract.
- Bounds database reads and downstream evidence cardinality.
- Uses parameterized, read-only queries with fixed SQL structure.

Cons:

- Represents only the most recent bounded records, not the entire history.
- Does not collect routing outcomes, pending answers, or metadata evidence;
  those remain separate collector tasks.
- A final outcome informs compatibility evidence but does not create durable
  learning by itself.

## Final Recommendation Stack

1. `policyLibraryOutcomeEvidenceCollector.mjs` reads final outcomes and manual
   corrections from their authoritative tables.
2. `policyEvidenceEnvelope.mjs` accepts the bounded records as separate source
   sections.
3. `policyEvidenceBoundary.mjs` validates and projects the combined envelope.
4. The learning guard remains responsible for deciding whether any resolved
   event can become durable learning.

## Implementation Outcome

The collector returns:

```text
classificationOutcomes[]
manualCorrections[]
summary
sideEffects
```

The summary records row counts, evidence counts, per-section truncation, and
the fixed 50-record cap. Collection errors return a stable risk ID and generic
message; database error text does not leave the module.

## Security Outcome

- All variable query values are parameterized.
- The library ID and final-status set are server-owned and allow-listed.
- No SQL is assembled from caller input.
- No metadata, title, actor, or provider values are selected or returned.
- The collector has no write, refresh, provider, quota, or media-server side
  effect.
- An audit detects unsafe side-effect claims and summary tampering.

## Next Step

Implement a separate read-only collector for pending-item answers. It should
return only resolved-answer state and timestamps, keep answers review-only until
the learning guard evaluates them, and remain distinct from Discord delivery or
question UI code.
