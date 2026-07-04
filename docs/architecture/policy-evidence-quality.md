# Policy Evidence Quality

## Status

Implemented as the durable policy evidence quality assessment.

This design adds a deterministic quality assessment to the server-owned evidence
projection. It does not add UI panels, live provider calls, policy writes,
routing actions, or learning behavior.

## Problem

The evidence projection already normalizes source-authorized facts, but later
engines also need a compact answer to:

```text
Is this evidence usable enough for intent inference, does it need review, or is
it missing destination identity?
```

Without a generated quality layer, downstream components would either rescan
bucket entries differently or reintroduce replay/provider diagnostics into the
operator workflow.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  frames AI systems around risk-managed, reliable, transparent, and explainable
  behavior. The quality layer makes uncertainty explicit before intent
  inference consumes evidence.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allow-list validation and bounded canonical inputs. The quality
  result uses fixed status, reason, and next-action IDs generated on the server.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend stable names for operations and data. The quality result uses
  durable IDs and counts so later traces can reference quality without carrying
  evidence labels.

## Recommendations

1. Generate quality from the evidence projection only.
   The client cannot provide or override the quality result.

2. Keep quality compact and label-free.
   Quality may expose counts, status, reason IDs, and next action IDs. It must
   not expose titles, labels, provider payloads, replay payloads, or UI chip
   copy.

3. Treat missing identity as insufficient evidence.
   Compatibility, metadata, or freshness evidence can support a destination, but
   they cannot define destination meaning by themselves.

4. Treat stale profile and insufficient buckets as review needs.
   The correct next action is profile refresh or evidence review, not implicit
   exclusion or automatic policy learning.

5. Audit generated quality before downstream use.
   If quality counts, status, or label-safety drift from the projection, the
   projection audit must fail.

## Pros And Cons

Pros:

- Gives downstream intent, readiness, and learning engines one deterministic
  handoff instead of ad hoc bucket scans.
- Keeps evidence quality separate from operator-facing UI.
- Prevents metadata-only evidence from becoming destination identity.
- Makes stale profile and missing identity states explicit.
- Keeps raw labels out of downstream quality and trace material.

Cons:

- Quality scoring is intentionally coarse; it is readiness guidance, not a final
  classification score.
- The quality result is generated from current evidence buckets only; broader
  runtime policy readiness still belongs to downstream readiness and operator
  workflow engines.

## Final Recommendation Stack

- Quality module:
  `server/src/services/policyEvidenceQuality.mjs`
- Evidence projection integration:
  `server/src/services/policyEvidenceEngine.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceQuality.test.mjs`
  and
  `server/src/__tests__/services/policyEvidenceEngine.test.mjs`
- Roadmap owner:
  Policy Evidence Engine in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The quality assessment shape is:

```text
version
statusId
score
nextActionId
reasonIds[]
counts
hasIdentityEvidence
hasObservedIdentityEvidence
hasDeclaredIdentityEvidence
hasHardLimitEvidence
hasRoutingEvidence
hasFreshnessEvidence
hasStaleProfileEvidence
```

Status IDs:

- `usable`
- `usable_with_constraints`
- `needs_review`
- `insufficient`

Next-action IDs:

- `collect_evidence`
- `confirm_destination_identity`
- `refresh_profile`
- `review_evidence`
- `verify_constraints`
- `proceed_to_intent`

The projection audit now validates that generated quality matches the projection
summary and bucket entries. It fails when quality is missing, stale, or carries
raw evidence labels.

## Security Outcome

- Quality is server-generated and deterministic.
- Quality does not perform provider calls.
- Quality does not expose raw provider payloads, evidence labels, UI chip text,
  prompts, titles, or quota state.
- Missing identity and stale profile evidence are handled as bounded review
  states instead of implicit exclusions or learning events.

## Next Step

Proceed to **Policy Intent Engine** consumption hardening. The next component
should make the intent engine consume the evidence quality status and block
intent inference when the evidence quality is `insufficient`.
