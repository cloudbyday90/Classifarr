# Policy Candidate Evidence Card Outcome

Status: Implemented (unreleased)

Date: 2026-08-30

## Delivered Outcome

Pending policy decisions now show whether their leading candidate has a stable
item identity anchor, declared-policy support, contextual library-profile
support, similar-item retrieval support, confirmed-outcome support, or a
retained deterministic conflict.

This makes the current screenshots actionable:

- A candidate supported only by a specialized declared policy and observed
  library contents now says that separate corroboration is limited. It no
  longer presents the library profile as semantic proof.
- A candidate whose observed library history differs now shows a conflict even
  if retrieval and declared policy support the leading destination.
- A missing stable identifier is visible as an identity-anchor gap, so title
  similarity cannot appear more reliable than it is.

The feature does not infer that a title belongs in a particular library. It
states what evidence was retained, how it relates to the candidate, and when a
human should seek a cross-check.

## Implementation

- Added the pure ESM server service
  `policyCandidateEvidenceCard.mjs`.
- Added the versioned candidate-evidence-card projection to the runtime
  question decision summary.
- Added a client allow-list presentation utility. It rejects missing,
  duplicate, unknown, or incompatible evidence mechanics.
- Added an accessible, non-focus-stealing evidence card to pending
  classification review. Its short fixed summary is a polite atomic status
  message; detailed evidence remains in normal document order.
- Added regression coverage for contextual-only profile support, retained
  history conflict, missing identifier anchors, corroborated support, raw-text
  containment, client fail-closed behavior, and rendered accessibility state.

## Pull Request Check

The GitHub Pull Requests MCP query found no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. No unrelated, closed, or merged pull
request was applied locally.

## Validation

Focused server tests passed 2 suites / 17 tests. Focused client tests passed
3 files / 12 tests. Full workspace validation passed: 902 server unit suites /
25,941 tests, 75 integration suites / 867 tests (one existing integration case
skipped), and 259 client files / 3,738 tests. Static ESM-import and ESM
mock-shape checks, the coverage ratchet, documentation lint, typecheck, client
build, copyright check, and diff whitespace check passed.

The Codex Security diff scan `8b8484d5-188b-43e0-9d26-592a579e3306` covered the
ten changed source and test files and reported no findings. Its optional TAC
connector was unavailable because no user was signed in; this did not prevent
the local diff review.

## Next Item

Implement a read-only contrastive-retrieval service for pending decisions that
need counter-evidence. It should build bounded supporting and contradicting
evidence sets from identity-verified metadata and active same-media-type
libraries, return fixed provenance/result states, and never expose raw
retrieval passages or change routing. After its evaluation fixtures prove that
it catches the Katrina-like cases without amplifying title collisions, a
strictly schema-validated local Ollama verdict can be evaluated as an
advisory-only final check.
