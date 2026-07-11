# Policy Evidence Envelope

## Status

Implemented as the read-only aggregator for a library-destination evidence
handoff.

The envelope requires a successful cached-profile handoff, accepts bounded
snapshots for final outcomes, manual corrections, pending answers, Arr routing
outcomes, and metadata evidence, and runs one combined policy evidence boundary.
It does not query the database, call providers, refresh a profile, mutate
storage, infer intent, or replace the item-level runtime evidence projection.

## Problem

The profile loader proves that observed library evidence is current enough to be
used. Later policy decisions also need outcome and routing context. Passing each
source separately to downstream engines would recreate inconsistent merge logic
and make it easier for a raw provider payload or an unchecked profile handoff to
bypass the existing evidence boundary.

`policyRuntimeEvidenceProjection.mjs` is intentionally not reused here. It is
an item-level runtime evaluation model with RAG-specific behavior; this envelope
describes a library destination and retains the policy evidence boundary as its
only projection contract.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends re-deriving security-relevant state on the server and enforcing
  workflow order explicitly. The envelope requires a successful server-owned
  profile handoff before it can build downstream evidence.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  calls for trusted-source scrutiny, sanitized event data, and bounded records.
  The envelope reports source counts only, limits each source to 50 records, and
  relies on the input gate to reject unsafe payload markers without echoing raw
  values.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined interfaces and verification as part of secure development.
  The envelope records stable status IDs and verifies the profile and boundary
  audits before exposing a ready handoff.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
  emphasize stable, documented field meanings. The source summary uses stable
  section IDs and counts instead of ad hoc labels or diagnostics.

## Recommendations

1. Build exactly one combined evidence boundary result per library-destination
   handoff.
2. Require the cached-profile loader and its audit before aggregation.
3. Keep each section bounded to 50 records and expose counts, not raw record
   labels, in the envelope summary.
4. Let `policyEvidenceInputGate.mjs` reject raw provider payload, live lookup,
   quota, replay, and UI diagnostic markers before projection.
5. Keep database reads in small source-specific collector modules; do not turn
   the envelope into a cross-table query service.

## Pros And Cons

Pros:

- Establishes one deterministic handoff for destination-level evidence.
- Prevents an incomplete or stale profile from reaching later engines.
- Bounds work and diagnostics for each evidence source.
- Preserves the existing input gate, projection audit, fingerprint, and quality
  contracts instead of duplicating them.
- Keeps item-level RAG runtime behavior separate from library policy evidence.

Cons:

- Collector modules must still supply the persisted source snapshots.
- A 50-record cap intentionally favors a representative bounded set over a full
  historical scan.
- The envelope does not make a policy or automation decision.

## Final Recommendation Stack

1. `policyLibraryProfileEvidenceLoader.mjs` supplies trusted cached-profile
   evidence and freshness.
2. Source-specific read-only collectors provide bounded persisted snapshots.
3. `policyEvidenceEnvelope.mjs` aggregates the snapshots and invokes the
   existing boundary once.
4. `policyEvidenceBoundary.mjs` validates, fingerprints, and audits the
   combined projection.
5. Intent and readiness engines consume only a ready envelope result.

## Implementation Outcome

The envelope accepts these public section IDs:

```text
classificationOutcomes
manualCorrections
pendingItemAnswers
arrRoutingOutcomes
metadataEvidence
```

Each section has a stable summary with `receivedCount`, `acceptedCount`, and
`truncated`. The assembler returns only a sanitized profile-handoff summary,
source counts, evidence-boundary result, boundary audit, stable status, and
side-effect record. A blocked result has no next step.

## Security Outcome

- A missing or invalid cached-profile handoff blocks aggregation.
- Raw provider payloads are rejected by the existing evidence input gate and
  their values are not copied into the returned result.
- Per-section record caps prevent unbounded historical scans from entering the
  projection path.
- The envelope has no direct database, network, quota, refresh, or storage
  mutation capability.
- The audit detects tampered section summaries and claimed unsafe side effects.

## Next Step

Implement the first source-specific collector for persisted classification final
outcomes and manual corrections. It should read a bounded, library-scoped result
set, expose only the evidence fields required by the envelope, and retain the
same no-write/no-provider-call contract.
