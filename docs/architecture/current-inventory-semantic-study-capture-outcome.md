# Current-Inventory Semantic Study Capture Outcome

## Delivered

- Added a modular ESM capture-request contract for a real 24–32-case
  current-inventory semantic study.
- Added a modular ESM, sequential in-memory runner that calls only the
  existing candidate-scoped semantic retriever and immediately reduces each
  result to a redacted snapshot.
- Added a private, stdin-only ESM command that can run the bounded capture
  locally without putting raw titles, descriptions, or library context into a
  repository file. It writes only the redacted snapshot document.
- Reused the existing strict snapshot document validator and published its
  opaque identifier patterns for pre-retrieval validation rather than copying
  a second identifier protocol.
- Added focused tests for redaction, sequential execution, retriever failure
  abstention, no-call validation failure, duplicate IDs, unknown-field
  rejection, stdin-size enforcement, fixed-error behavior, and the
  media-type/metadata requirements that the live retriever needs.

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

- Focused server tests: 2 suites / 8 tests passed.
- The 24-case test proves the retriever never has more than one in-flight call
  and proves serialized output excludes test media metadata, retrieved titles,
  library IDs, and retrieved-item arrays.
- A forced retriever failure produced one unavailable snapshot while retaining
  the other 23 cases; it did not surface the provider error.
- A 23-case request was rejected before any retriever call.
- A private stdin request reached the injected capture boundary once and
  returned only the redacted document; its private title, overview, and
  library identifiers were absent from serialized output.
- An oversized private input and unsupported command-line option both failed
  closed without exposing the supplied value.

## Pull Request Check

The repository had no open pull requests when checked against GitHub's
official pull-request API on 2026-09-04. No unrelated or closed PR was copied
into this change. GitHub documents this endpoint's open-state listing
behavior in its [Pull Requests REST
API](https://docs.github.com/en/rest/pulls/pulls).

## Next Item

The first real local Compose capture and both existing gates were exercised
on 2026-09-04. The 28-case inventory replay returned `not_ready`; independent
human labels remain incomplete and existing indexed identities make this
unsuitable as generalization evidence. See the
[study outcome](current-inventory-semantic-study-2026-09-04-outcome.md).

Complete a held-out, independently labelled 24–32-case packet using this
private capture boundary's [held-out successor](held-out-semantic-study-outcome.md),
then rerun the existing readiness gate and
frozen-study preflight. If its error profile supports the use case, the next engineering
component is a narrowly scoped semantic counter-evidence experiment that can
move only a broad-policy conflict to candidate comparison or operator review;
it must not auto-route.
