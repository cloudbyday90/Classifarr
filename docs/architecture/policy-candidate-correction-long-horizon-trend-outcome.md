# Policy Candidate Correction Long-Horizon Trend Outcome

## Status

Implemented and verified on the unreleased branch. No release is created by
this work.

## Delivered Components

- Added pure ESM long-horizon trend and report-composer services.
- Advanced correction analytics to response contract v5 and added two
  server-defined adjacent 28-day completed UTC aggregate periods.
- Reused the current readiness gate and calculated the complete cohort screen
  on the server, while exposing only a compact, allow-listed cohort result to
  the client.
- Added a strict client projection that re-derives the trend and fails closed
  on a mismatched exact span or adjacency, count identity, readiness status,
  cohort status, or derived trend state.
- Added a semantic, read-only Statistics panel with a captioned table, scoped
  headers, existing status announcement, no actions, and no automatic
  maintenance behavior.

## Decision Outcome

The selected stack is fixed 28-day aggregate monitoring guarded by the existing
fixed cohort-composition comparison. A sustained review status means only that
two representative, comparable aggregate periods reached the already-defined
review criterion. It does not mean that the policy is incorrect, that AI or RAG
should be changed, or that routing is authorized.

The outcome is intentionally conservative for the screenshots that motivated
the work: a visible recurring aggregate signal may guide a human to inspect a
representative cohort, but a material cohort shift or insufficient data stops
the system from presenting it as a policy-behavior conclusion.

## Pull Request Check

GitHub Pull Requests MCP found no open pull requests for
`cloudbyday90/Classifarr` on 2026-08-30. There was therefore no random open
PR to implement locally; no closed, merged, or inferred pull request was
substituted.

## Validation

Focused tests passed: four server suites (seven tests) and three client files
(nine tests). The complete workspace suite also passed: 1,803 server tests and
3,842 client tests, with three intentional skips. Project lint, typecheck,
production build, Markdown lint, copyright, ESM-import, test-mock-shape, and
coverage-ratchet checks passed. Security diff scan
`b415611b-093b-4318-9081-63a38454fd84` reviewed the 14 changed executable and
test surfaces with zero reportable findings.

## Next Item

Build a bounded, read-only **representative review handoff** only when the
long-horizon screen shows a sustained review signal. It should link an
administrator to existing pending-review workflows without carrying analytics
identities or automatically changing policy, AI, RAG, learning, or routing.
