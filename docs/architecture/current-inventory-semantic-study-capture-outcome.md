# Current-Inventory Semantic Study Capture Outcome

## Delivered

- Added a modular ESM capture-request contract for a real 24–32-case
  current-inventory semantic study.
- Added a modular ESM, sequential in-memory runner that calls only the
  existing candidate-scoped semantic retriever and immediately reduces each
  result to a redacted snapshot.
- Reused the existing strict snapshot document validator and published its
  opaque identifier patterns for pre-retrieval validation rather than copying
  a second identifier protocol.
- Added focused tests for redaction, sequential execution, retriever failure
  abstention, no-call validation failure, duplicate IDs, and unknown-field
  rejection.

## Observed Result

The study path can now collect the real semantic comparison Classifarr needs
to evaluate: whether the policy-leading library is less semantically relevant
than a policy-owned alternative. It does so without placing the full library
contents, titles, descriptions, or provider output in normal persistence or
the browser.

This is evidence collection, not learning or routing. A successful capture
does not make a policy score higher or lower, nor does it increase AI
confidence. The independent-label evaluator and frozen-study preflight remain
the only next consumers, and both retain no automatic routing eligibility.

## Local Validation

- Focused server tests: 3 suites / 9 tests passed.
- The 24-case test proves the retriever never has more than one in-flight call
  and proves serialized output excludes test media metadata, retrieved titles,
  library IDs, and retrieved-item arrays.
- A forced retriever failure produced one unavailable snapshot while retaining
  the other 23 cases; it did not surface the provider error.
- A 23-case request was rejected before any retriever call.

## Pull Request Check

The repository had no open pull requests when checked against GitHub's
official pull-request API on 2026-09-03. No unrelated or closed PR was copied
into this change. GitHub documents this endpoint's open-state listing
behavior in its [Pull Requests REST
API](https://docs.github.com/en/rest/pulls/pulls).

## Next Item

Create and independently label the first real 24–32-case study packet, then
run its existing readiness gate and frozen-study preflight. If its error
profile supports the use case, the next engineering component is a narrowly
scoped semantic counter-evidence experiment that can move only a broad-policy
conflict to candidate comparison or operator review; it must not auto-route.
