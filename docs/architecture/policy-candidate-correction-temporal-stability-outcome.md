# Policy Candidate Correction Temporal-Stability Outcome

## Status

Implemented locally and verified on the unreleased branch. No release is
created by this work.

## Delivered Components

- Added a reusable completed-UTC-day helper that builds adjacent, equal-length
  fixed observation windows without overlap.
- Added a pure ESM temporal-stability service that recognizes persistent,
  emerging, diminishing, low-signal, insufficient-data, and inconclusive
  outcomes from two existing count-only readiness snapshots.
- Introduced Correction Analytics response contract v3, which included the
  current and previous aggregate periods plus derived stability for the overall
  aggregate, every score-margin band, and the union of observed fixed
  evidence-source/state buckets. The current response contract is v4 after the
  delivered cohort-composition guard.
- Added a separate strict client presentation module. It re-derives the
  expected status from both validated periods, discarding inconsistent or
  unknown server content before rendering.
- Added semantic adjacent-window tables and a concise status announcement to
  the Statistics view. The view remains read-only and has no maintenance,
  policy, AI, RAG, retry, learning, or routing control.

## Decision Outcome

The selected stack is an adjacent fixed-window persistence check layered on
top of the existing 20-applicable-decision and 95% Wilson-interval readiness
gate. A one-window review signal is deliberately labeled **New review signal**
and requires another completed window before it is described as persistent.

This provides more useful evidence than an unqualified percentage-point
delta, without pretending that two aggregate windows prove causation or score
correctness.

## Pull Request Check

GitHub Pull Requests MCP found no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. There was therefore no random open
PR to implement locally; no closed, merged, or inferred pull request was
substituted.

## Validation

Focused server validation passed 5 suites / 14 tests, and focused client
validation passed 2 files / 5 tests. Root/server/client lint, server and
client type checks, production build, Markdown lint, copyright, static-import
and ESM mock-shape checks, coverage ratchet, and `git diff --check` passed.

The completed security diff scan covered all 15 changed executable source and
test files. It found zero reportable findings and confirmed the fixed
aggregate response boundary, client fail-closed projection, bounded two-query
service behavior, and absence of new AI, RAG, policy, retry, persistence, or
routing authority. Scan `7b522640-018c-4584-8ecc-7e8281293efd` completed with
2,680,214 measured tokens and complete coverage.

## Follow-on Outcome

Aggregate cohort-composition stability is now delivered in
[the separate outcome document](policy-candidate-correction-cohort-composition-outcome.md).
It provides a fixed count-only TVD guard before a repeated correction signal is
interpreted as a policy-behavior pattern.
