# Policy Library Evidence Loader

## Status

Implemented as the server-owned, read-only composition boundary for a library
destination's evidence handoff.

The loader requires a successful cached-profile handoff before it reads any
other source. It then runs the final-outcome, pending-answer, routing-outcome,
and normalized-metadata collectors, requires every collector audit to pass, and
builds exactly one existing policy evidence envelope. It returns summaries and
audits for source collectors, not their raw database records.

## Problem

The evidence envelope correctly combines bounded snapshots, but leaving every
caller to load profile, collect source records, audit each result, and assemble
the envelope creates workflow-order drift. A caller could accidentally omit a
source audit, build an envelope from a failed collector, or query sources before
the required profile handoff is valid.

The loader makes that order explicit:

```text
cached profile handoff and audit
  -> bounded source collectors and audits
  -> one evidence envelope and audit
  -> downstream intent handoff
```

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends testing workflow order and rejecting skipped or reordered steps.
  The loader blocks all source reads until profile validation succeeds, then
  blocks the envelope unless every source audit succeeds.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-side workflow-state validation. The loader owns the
  profile-to-source-to-envelope sequence; no client state controls it.
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
  recommends generic unexpected-error handling. Thrown profile or collector
  failures become stable status and risk IDs without exposing error text.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined and verified security boundaries. The loader preserves each
  nested audit and verifies the final envelope audit before reporting ready.

## Recommendations

1. Validate the positive library ID before invoking any dependency.
2. Load and audit cached profile evidence first; do not query secondary sources
   when the profile handoff is blocked.
3. Run independent read-only source collectors only after a valid profile.
4. Require `ok` and a passing audit from every collector before envelope build.
5. Build one envelope with the existing boundary, then require its audit.
6. Return only collector summaries and audit risk IDs outside the envelope.
7. Keep the loader side-effect free apart from bounded persisted reads.

## Pros And Cons

Pros:

- Enforces one deterministic server-side evidence workflow.
- Prevents a failed source from silently becoming an empty snapshot.
- Preserves focused collector ownership while giving later engines one handoff.
- Avoids database/provider logic in the envelope itself.
- Provides a compact audit trail without duplicating source records.

Cons:

- Requires all current source collectors to succeed before a ready envelope is
  returned; partial evidence is intentionally not treated as complete.
- Adds an orchestration module, although it contains no evidence inference.
- Future source additions must be explicitly registered with a collector and
  audit rather than being passed ad hoc.

## Final Recommendation Stack

1. `policyLibraryProfileEvidenceLoader.mjs` validates cached observed evidence.
2. Source-specific collectors provide bounded persisted snapshots.
3. `policyLibraryEvidenceLoader.mjs` enforces profile-first collection and
   nested audits.
4. `policyEvidenceEnvelope.mjs` builds one combined evidence boundary result.
5. Intent and readiness engines consume only a ready loader handoff.

## Implementation Outcome

The loader returns:

```text
profileHandoff summary
profileAudit
sourceSummary
evidenceEnvelope
evidenceEnvelopeAudit
sideEffects
nextStep
```

Source summaries retain stable status, count summaries, and audit risk IDs but
do not copy the collectors' record arrays. A failed profile, source collector,
or envelope returns a blocked status with no next step.

## Security Outcome

- A positive integer library ID is validated before any dependency runs.
- Profile failure prevents all secondary source reads.
- Every collector and the final envelope must pass its own audit.
- Thrown dependency errors are converted to generic blocked results.
- The loader does not perform live media-server/provider lookups, quota reads,
  storage writes, learning mutations, metadata refreshes, or route attempts.
- The top-level audit detects missing nested audits, a blocked next step, and
  claimed unsafe side effects.

## Next Step

The policy evidence handoff verifier now audits the collector and loader
contracts together and records the evidence-engine completion criteria. The next
component is a focused intent-engine adapter that consumes only a ready verified
library evidence handoff.
