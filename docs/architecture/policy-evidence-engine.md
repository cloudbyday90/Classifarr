# Policy Evidence Engine

## Status

Implemented as the durable policy evidence contract.

This design creates a server-owned evidence vocabulary and deterministic
projection helper. It does not wire runtime classification, learning, routing,
native intent storage, or UI changes. Those remain later bounded runtime and
storage work.

Resolved pending-item answer evidence is deliberately projected as insufficient
evidence. It proves that an operator resolved a destination question without
making the answer text, responder identity, or the resolution itself an
automatic learning instruction.

Persisted Arr routing outcomes are normalized to fixed succeeded, blocked, or
skipped states before projection. The evidence contract carries neither raw
route reasons nor Arr request, response, path, or error details.

Persisted normalized metadata is currently limited to aggregated genre facts.
It is projected only as compatibility evidence; source authority rules prevent
metadata from establishing identity, hard limits, avoid rules, or direct
learning.

The library evidence loader now provides the only server-owned composition path
for the cached profile handoff and all bounded persisted source collectors. It
requires each nested audit before it builds the evidence envelope, preventing
callers from treating a failed collector as an empty source section.

The policy evidence handoff verifier now checks the complete loader-to-envelope
chain, including static engine rules, nested audits, projection fingerprint, and
quality assessment. Its ready result proves handoff integrity, not that a
destination is ready for automation.

June 2026 hardening adds a projection summary and legacy reducer cutline
inventory. The summary gives downstream engines a bounded, deterministic view
of bucket counts, source authority, blocking evidence, and review evidence. The
cutline inventory prevents replay/impact reducers from returning as normal
operator UI unless they are rewritten into source-authorized evidence reducers.
The evidence boundary now validates the public input envelope, adapts it into
the projection shape, and audits the generated projection before later engines
consume it. July 2026 hardening also validates the generated projection
fingerprint, trace attributes, and sanitized provenance against the returned
projection before downstream engines can consume the handoff. Evidence quality
hardening adds a generated, label-free quality assessment so downstream engines
can distinguish usable, constrained, review-needed, and insufficient evidence
without reusing replay/provider diagnostics.
Boundary-audit hardening adds a reusable server-side check over the complete
handoff result so downstream engines only receive evidence when the input gate,
projection audit, fingerprint audit, side-effect contract, issue count, and
intent-inference handoff agree.

Evidence-entry hardening now canonicalizes and bounds every projected key,
label, value, reason code, and timestamp. Source adapters own allow-listed
reason codes, so incoming snapshot records cannot redefine evidence meaning.
The projection audit detects later field-contract tampering without returning
unsafe text.

## Problem

The previous policy-builder direction exposed too many implementation diagnostics in
the policy builder: replay preview, impact preview, provider readiness, TMDB
coverage, parity panels, and scoring internals. That made operators reason
about tools instead of destination meaning.

The policy evidence engine starts the replacement runtime path by answering one
narrower question:

```text
What does Classifarr know about this destination, and which authority source
supports each piece of evidence?
```

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  frames trustworthy AI systems around risk-managed design, evaluation, and
  trustworthiness considerations. For Classifarr, AI and provider output should
  be evidence inputs or suggestions, not policy authority.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/Projects/ssdf)
  emphasizes secure development practices, risk-based prioritization, tracking
  security requirements, and provenance. The evidence engine therefore records
  source authority and strips raw/transient provider payloads.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for secure web application control verification. The design
  keeps server-side validation and audited contracts as the boundary instead of
  trusting client/UI state.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends clear allow-list validation and bounded canonical inputs. The
  evidence contract applies that pattern to evidence bucket IDs, source IDs,
  authority source IDs, reducer dispositions, and summary counts.
- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  define spans, attributes, events, and context propagation. The evidence
  engine does not adopt telemetry, but each evidence bucket now has a stable
  trace attribute so later decision tracing can map evidence without renaming
  the model.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  define common names for operations and data. The evidence summary keeps trace
  attributes stable while avoiding sensitive raw values.

## Recommendations

1. **Use a server-owned evidence vocabulary.**
   The evidence buckets are:
   - identity evidence,
   - compatibility evidence,
   - hard-limit evidence,
   - avoid evidence,
   - outlier evidence,
   - routing evidence,
   - freshness evidence,
   - insufficient evidence.

2. **Keep source authority explicit.**
   Evidence entries must identify their source and authority source. Operator
   declared intent is the only source allowed to create hard-limit or avoid
   evidence.

3. **Strip provider and UI implementation details.**
   Evidence projection must not expose raw provider payloads, live lookup state,
   provider quota/cooldown state, replay payloads, impact-preview payloads, or
   UI chip labels.

4. **Stay offline and deterministic.**
   Policy evidence projection uses cached/provided inputs only. It never
   performs live TMDB or other provider calls.

5. **Make the contract auditable.**
   The server exposes an audit that fails when future changes allow metadata to
   own identity, final outcomes to learn directly, live lookups inside evidence
   projection, or raw/transient payload leakage.

6. **Expose summaries, not diagnostics, to later engines.**
   Downstream engines should consume the projection summary for counts,
   authority-source coverage, blocking evidence, and review evidence. They
   should not depend on replay panels, impact panels, provider quota state, or
   UI chip labels.

7. **Classify legacy reducers before reuse.**
   Replay and impact code must be explicitly marked as rewrite, delete, or
   maintainer-only migration material. Normal operator flow cannot consume old
   diagnostic reducers directly.

8. **Generate bounded evidence quality.**
   Downstream engines should consume server-generated quality status and
   next-action IDs instead of recalculating evidence readiness from raw bucket
   labels.

9. **Audit the complete boundary handoff.**
   The boundary result should be checked as a unit before downstream engines
   consume it: ready results must have a successful input gate, projection
   audit, fingerprint audit, and intent-inference handoff; blocked results must
   have no next step and no live/provider/storage side effects.

10. **Normalize evidence entries at the source boundary.**
    Canonicalize Unicode text, remove control characters, bound output fields,
    normalize timestamps, and retain source-owned reason codes before evidence
    is projected or audited.

11. **Consolidate only exact canonical evidence facts.**
    Suppress repeated entries only when their complete bounded semantic identity,
    including bucket, source, authority, value, count, confidence, reason, and
    timestamp, matches. Preserve distinct provenance and reject duplicate
    canonical entries during projection audit.

12. **Require bucket-container ownership.**
    Every evidence entry must declare the same bucket as the projection array
    that contains it. Reject mismatches before source, authority, summary,
    quality, fingerprint, or later engine logic consumes the projection.

13. **Use canonical semantic entry order.**
    Sort distinct valid entries by their complete canonical identity before
    summary and quality generation. Audit reordered received projections and
    canonicalize bucket arrays again when deriving fingerprints.

## Pros And Cons

Pros:

- Creates a small engine primitive instead of another policy-builder panel.
- Gives the policy intent engine a stable input model for intent suggestions.
- Keeps server-side authority explicit and testable.
- Makes provider data useful without making provider state the product model.
- Avoids live API calls in policy-building evidence projection.
- Gives downstream intent and readiness engines a compact summary instead of
  forcing each engine to rescan bucket entries or reuse diagnostic panels.
- Makes old replay/impact reducer disposition explicit before future cleanup.
- Gives downstream engines a label-free quality assessment for usable,
  constrained, review-needed, and insufficient evidence.
- Gives the intent engine one boundary audit to trust instead of duplicating
  input-gate, projection, fingerprint, and side-effect checks.
- Prevents unbounded or control-character evidence fields from leaking into
  audit, trace, or workflow projections.

Cons:

- This is not yet a full profile reducer for all current library data.
- Existing replay/impact reducers are not deleted in this slice; they are
  classified for rewrite, deletion, or maintainer-only migration use.
- Runtime classification still uses current paths until runtime integration.
- Native storage waits until runtime engine contracts prove stable.
- The boundary audit is defensive validation; it does not replace the lower
  input-gate, projection, fingerprint, or quality audits.
- Entry normalization bounds individual fields; collection cardinality remains
  a distinct input-boundary concern.
- Exact deduplication does not reconcile near-duplicate facts with distinct
  bounded values, timestamps, source IDs, or authority IDs.
- Bucket ownership validation rejects inconsistent projections; it does not
  attempt to infer the intended location or mutate a received projection.
- Canonical order is a deterministic contract, not a user-facing relevance or
  recommendation ranking.

## Final Recommendation Stack

- Server module:
  `server/src/services/policyEvidenceEngine.mjs`
- Quality module:
  `server/src/services/policyEvidenceQuality.mjs`
- Boundary module:
  `server/src/services/policyEvidenceBoundary.mjs`
- Entry normalizer:
  `server/src/services/policyEvidenceEntryNormalizer.mjs`
- Test module:
  `server/src/__tests__/services/policyEvidenceEngine.test.mjs`
  `server/src/__tests__/services/policyEvidenceQuality.test.mjs`,
  and `server/src/__tests__/services/policyEvidenceBoundary.test.mjs`
- Documentation:
  `docs/architecture/policy-evidence-engine.md`
- Roadmap owner:
  Policy Evidence Engine in `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The server module exports:

- evidence bucket IDs,
- evidence bucket readiness IDs,
- evidence source IDs,
- prohibited payload IDs,
- reducer cutline IDs,
- an evidence projection builder,
- an evidence projection summary builder,
- an evidence quality assessment builder,
- an evidence projection audit for generated/tampered contract instances,
- an evidence boundary audit for complete handoff results,
- a reducer cutline inventory,
- bucket/source lookup helpers,
- bucket/source validation helpers,
- a full evidence-engine audit.

Boundary callers should use
`buildBoundedPolicyEvidenceProjection` from
`server/src/services/policyEvidenceBoundary.mjs` when they need a
complete policy-evidence handoff. That boundary runs the input gate first, maps
public section names into the projection input shape, builds the projection,
and runs the projection audit. Callers can then use
`buildPolicyEvidenceBoundaryAudit` to validate the complete handoff before
passing it to the intent engine.

Persisted media-server profile distributions should first be adapted by
`server/src/services/policyLibraryProfileEvidence.mjs`. That pure adapter emits
bounded compatibility and review-only outlier candidates without allowing broad
distribution values to establish destination identity.

`server/src/services/policyLibraryProfileEvidenceLoader.mjs` is the only
cached-profile handoff for this flow. It derives freshness from persisted
timestamps, marks missing or stale timestamps as review-required, and audits
the resulting evidence boundary before later engines consume it.

`server/src/services/policyEvidenceEnvelope.mjs` combines that handoff with
bounded source snapshots and invokes the evidence boundary once. It does not
reuse the item-level runtime evidence projection or issue cross-table queries.

`server/src/services/policyLibraryOutcomeEvidenceCollector.mjs` is the
source-specific read boundary for final classification outcomes and manual
corrections. It exposes no titles, metadata, correction actors, or learned
state, and the envelope receives only its bounded evidence records.

`server/src/services/policyEvidenceEntryNormalizer.mjs` is the primitive-field
boundary used while building every evidence entry. It preserves valid Unicode
labels, removes control characters, bounds text, canonicalizes keys and
timestamps, and keeps source-owned reason codes out of caller control. Its
design record is [Policy Evidence Entry Normalizer](policy-evidence-entry-normalizer.md).

`server/src/services/policyEvidenceEntryIdentity.mjs` defines the canonical
semantic identity shared by construction and projection audit. Exact repeated
facts are consolidated before summaries, quality, and fingerprints are built;
facts with distinct source or authority provenance remain separate. Its design
record is [Policy Evidence Projection Deduplication](policy-evidence-projection-deduplication.md).

Each projection entry must declare the bucket that contains it. The audit fails
closed when `entry.bucketId` differs from the enclosing bucket ID, keeping
summary, quality, and fingerprint consumers from accepting an ambiguous
location. Its design record is [Policy Evidence Projection Container Ownership](policy-evidence-projection-container-ownership.md).

`server/src/services/policyEvidenceEntryIdentity.mjs` also owns canonical entry
ordering. Projection construction sorts each bucket by the complete semantic
identity before summary and quality computation; audit rejects reordered
received projections; fingerprinting canonicalizes bucket arrays independently.
Its design record is [Policy Evidence Projection Canonical Ordering](policy-evidence-projection-canonical-ordering.md).

`server/src/services/policyEvidenceInputCardinality.mjs` bounds every input
array before recursive input-gate scanning. Oversized input fails closed with a
count-only status before projection work begins; it is not silently truncated.
Its design record is [Policy Evidence Input Cardinality](policy-evidence-input-cardinality.md).

The projection entry shape is intentionally small:

```text
bucketId
sourceId
authoritySourceId
key
label
value
count
confidence
reasonCode
observedAt
stale
includesRawPayload = false
liveLookupPerformed = false
```

This shape is safe to pass into future intent/readiness work without exposing
raw provider payloads or UI-specific labels.

The projection summary shape is intentionally compact:

```text
version
totalEntryCount
bucketSummaries[]
sourceIds[]
authoritySourceIds[]
blockingBucketIds[]
reviewBucketIds[]
hasBlockingEvidence
hasReviewEvidence
```

The summary is generated from the projection, not provided by the client. The
projection audit fails if the summary is missing or no longer matches bucket
entry counts.

The projection quality shape is also generated from the projection:

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

The quality assessment exposes counts and stable IDs, not evidence labels or
provider/replay payloads. The projection audit fails if quality is missing,
stale, or leaks entry labels.

No diagnostic reducer inventory remains. Replay and impact migration reducers
were retired after bounded evidence, intent, readiness, and rollback contracts
became their explicit replacements.

The projection audit validates the generated instance after construction. It
fails when a projection:

- marks itself as generated from live provider data,
- exposes raw provider payloads or UI chip language,
- contains unknown buckets, sources, or authority sources,
- lets a source populate a bucket it is not allowed to own,
- lets metadata enrichment own destination identity,
- lets hard-limit or avoid evidence bypass operator-declared intent,
- contains individual entries that claim raw payloads or live lookup behavior,
- contains duplicate canonical entries,
- contains an entry whose declared bucket does not match its bucket container,
- contains valid entries in noncanonical semantic order,
- omits the generated summary,
- carries a stale summary whose counts do not match the bucket entries,
- omits generated quality, carries stale quality, or leaks entry labels through
  quality.

## Security Outcome

- Live provider calls are prohibited in evidence projection.
- Raw provider payloads are not copied into projection entries.
- Generated projections are independently auditable so future code cannot
  bypass the constructor by mutating or assembling unsafe evidence entries.
- Projection fingerprints are independently auditable so downstream engines do
  not consume stale or tampered evidence correlation handles.
- Provider quota/cooldown state is not evidence.
- Manual outcomes can describe evidence, but cannot create learning directly.
- Hard limits and avoid evidence require operator-declared intent.
- Trace attributes are stable strings and contain no sensitive values.
- Projection summaries contain counts and IDs only; they do not include raw
  titles, provider payloads, request prompts, API keys, quota state, or
  diagnostic UI copy.
- Projection quality contains status, next action, reason IDs, booleans, and
  counts only; it does not carry evidence labels.
- Exact duplicate canonical facts are suppressed before summary, quality, and
  fingerprint generation, while distinct source and authority provenance stays
  visible to later engines.
- Each accepted entry has one validated bucket location; bucket-local summary,
  quality, and fingerprint computations do not trust a caller-provided label
  that differs from its container.
- Distinct valid entries use canonical semantic order, so equivalent input order
  produces one projection correlation fingerprint without merging provenance.
- Boundary audits require ready results to have a successful input gate,
  projection audit, fingerprint audit, and intent-inference handoff; blocked
  results cannot carry a next step.
- Boundary audits reject live provider lookup, provider quota reads, and policy
  storage mutation as evidence-boundary side effects.
- Replay and impact reducers are blocked from normal flow unless rewritten into
  source-authorized evidence reducers.

## Next Step

Proceed to **Policy Intent Engine** consumption hardening. That component should
consume evidence buckets plus generated quality, block insufficient evidence
handoffs, and produce proposed destination intent with assumptions, warnings,
confidence, and review needs while keeping inferred evidence separate from
operator-declared constraints.
