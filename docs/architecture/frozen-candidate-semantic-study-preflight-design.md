# Frozen Candidate Semantic Study Preflight Design

## Status

Implemented on the unreleased branch on 2026-09-02. This is an offline,
read-only preparation boundary. It does not create a release, tag, database
row, HTTP route, background task, or Settings panel.

## Problem

Classifarr already has candidate-scoped current-library semantic retrieval and
an independently labelled 24–32 case readiness gate. The next credible study
must test one unchanged AI/RAG configuration against that exact case set. A
mutable RAG index, changed model selection, or swapped label/snapshot file
would otherwise make its result hard to interpret.

The goal is **not** to make the model route media. It is to establish whether a
specific, bounded semantic comparison can later be considered for a narrowly
defined policy-path change.

## Selected Design

```text
four externally prepared, redacted study documents
  + opaque server-generated AI/RAG proposal-cohort marker
  + 31-day maximum study window
  -> strict content-address binding
  -> existing independent-label readiness evaluation
  -> aggregate-only human-study preflight
  -> no live provider, index, policy, learning, retry, or routing action
```

The new contract accepts only an explicit JSON proposal with:

- four SHA-256 content addresses for the fixture, semantic snapshot, snapshot
  manifest, and independent reference-label documents;
- one opaque SHA-256-wrapped proposal-cohort marker. That marker is already
  derived server-side from the bounded provider authority, candidate count,
  and candidate semantic-retrieval protocol; it exposes no provider host,
  credentials, prompt, item, library, embedding, or response;
- fixed candidate-scoped retrieval, advisory-model, and authorized
  time-bounded-review scope identifiers; and
- canonical UTC start and expiry timestamps, with an enforced maximum window
  of 31 days.

`policyCandidateFrozenSemanticStudyContract.mjs` owns the allow-list,
fingerprint validation, scope values, and study-window rules.
`policyCandidateFrozenSemanticStudy.mjs` composes that validation with the
existing semantic readiness evaluator. It calculates each input's stable
content address in memory and compares it to the proposal before returning an
aggregate-only report. The report can say only `invalid_study`, `not_ready`, or
`ready_for_human_study_review`—never automatic routing or policy-change
eligibility.

The semantic snapshot document is the frozen, candidate-scoped index evidence
slice for the study. The proposal cohort marker separately freezes the
server-owned model/retrieval protocol configuration. Neither mechanism claims
to freeze the entire mutable library database; a later study workbench must
capture any access-controlled inventory snapshot it needs outside this small
evaluation contract.

## Local Workflow

An authorized maintainer supplies all five project-contained JSON files:

```text
node scripts/run-policy-candidate-frozen-semantic-study-preflight.mjs \
  --fixture-file path/to/redacted-fixtures.json \
  --snapshot-file path/to/redacted-semantic-snapshots.json \
  --manifest-file path/to/redacted-semantic-snapshot.manifest.json \
  --reference-set-file path/to/independent-reference-labels.json \
  --proposal-file path/to/frozen-candidate-study-proposal.json
```

Each path must be relative to the checkout, resolve inside it, name a regular
JSON file, and remain below the existing 128 KiB input limit. The command
reads files only and prints no item text, descriptions, library data, item
identifiers, embeddings, prompts, responses, paths, labels, or caller-supplied
study identifier. A malformed
input produces only a fixed failure message.

The proposal is deliberately content-free. Its shape is:

```json
{
  "version": "policy.candidate_frozen_semantic_study_proposal.v1",
  "studyId": "candidate-study-2026-09",
  "proposalCohortFingerprint": "sha256:<opaque-64-hex-marker>",
  "fixtureDocumentFingerprint": "sha256:<64-hex>",
  "snapshotDocumentFingerprint": "sha256:<64-hex>",
  "semanticSnapshotManifestFingerprint": "sha256:<64-hex>",
  "referenceSetDocumentFingerprint": "sha256:<64-hex>",
  "candidateRetrievalScopeId": "policy_owned_current_library_candidates",
  "modelOutputScopeId": "advisory_candidate_comparison",
  "accessScopeId": "authorized_time_bounded_review",
  "studyWindow": {
    "startsAt": "2026-09-03T12:00:00.000Z",
    "expiresAt": "2026-09-17T12:00:00.000Z"
  }
}
```

The proposal's expiry is an admission control, not a data-deletion mechanism.
Classifarr stores no study packet. The authorized study owner remains
responsible for revoking access and deleting external packet material at or
before expiry.

## Security and Privacy Controls

- All input documents use existing realpath containment, regular-file, size,
  and JSON parsing controls.
- The proposal rejects unknown fields, so prompts, titles, descriptions,
  library names, credentials, hosts, provider responses, vectors, reviewer
  identities, and arbitrary instructions cannot enter the contract.
- Four stable content addresses prevent a reviewer from pairing a frozen
  configuration marker with a different fixture, snapshot, manifest, or label
  document.
- A narrow 31-day study window prevents stale evidence from being presented as
  current configuration evidence.
- A failed binding, expired window, invalid independent-label gate, or
  unready precision/recall profile is fail-closed.
- The preflight authority explicitly disables AI invocation, RAG querying,
  learning, policy changes, retries, and routing.

## Research Basis

The sources below were retrieved from their official publishers on 2026-09-02
for the requested August 2026 best-practice baseline.

- NIST's AI RMF calls for continuous `GOVERN`, `MAP`, `MEASURE`, and `MANAGE`
  activity; its Measure function specifically calls for rigorous testing,
  documented test sets and metrics, independent assessment, production
  monitoring, and documented limitations. A bound, expiring study proposal
  makes the configuration and test material traceable without treating a
  model's output as truth. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP identifies data leakage, cross-context conflicts, inversion, and
  poisoning as RAG/vector risks, and recommends fine-grained access, validated
  trusted sources, classification, and immutable retrieval logs. Candidate
  scope, content minimization, and exact document binding follow that
  direction. [OWASP LLM08:2025 Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- W3C's evaluation methodology calls for an explicit scope, representative
  sample selection, evaluation, and reporting; it also says documentation can
  have different confidentiality levels. The preflight therefore emits a
  minimal aggregate report while leaving detailed study material to the
  authorized review process. [WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)

## Options Considered

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Let the currently selected model/index run against any new corpus | Fastest path. | Results cannot distinguish data/configuration drift from capability change. | Reject. |
| Persist full titles, descriptions, prompts, responses, and vectors in a new workbench database | Rich investigation material. | Greatly expands data retention, access, prompt-injection, and exposure scope. | Defer. |
| Bind a content-free study proposal to a bounded snapshot and opaque runtime cohort marker | Reproducible, minimal exposure, explicit expiry, and no runtime authority. | Requires an authorized maintainer to prepare a real study bundle. | Adopt. |

## Final Recommendation Stack

1. Keep current-library retrieval candidate-scoped and AI advisory; do not let
   either select an unrestricted destination or route media.
2. Run the independently reviewed 24–32 case bundle through the existing
   readiness gate. Do not fabricate that human result from synthetic fixtures.
3. When it is ready, bind the exact bundle to one frozen proposal cohort with
   this preflight and conduct the time-bounded human study.
4. If the study demonstrates the required error profile, design a narrow,
   separately reviewed semantic counter-evidence policy change.
5. Keep automatic routing out of scope until a later, production-like,
   security-reviewed evaluation demonstrates it is appropriate.
