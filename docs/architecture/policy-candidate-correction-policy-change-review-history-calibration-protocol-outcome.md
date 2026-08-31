# Policy-Change Review-History Offline Calibration Protocol Outcome

## Status

Implemented and validated on the unreleased branch. No release, tag, or
version bump is created by this work.

## Intended Outcome

- Make the next human action clear after calibration readiness changes.
- Admit the offline procedure only when six aggregate periods are eligible and
  the current review process is consistent.
- Show a fixed checklist with no manual trigger or background work.
- Preserve automatic status refresh using the existing Settings lifecycle.

## Deliberate Non-Outcomes

- No threshold calculation, proposal, approval, policy change, provider call,
  AI/RAG use, learning, classification, retry, or routing change.
- No aggregate export, snapshot storage, individual decision, media, library,
  actor, policy, model, provider, prompt, response, or RAG data.
- No new endpoint, request selector, migration, job, or write path.

## Open Pull Request Applied Locally

On 2026-08-31, [PR #523](https://github.com/cloudbyday90/Classifarr/pull/523)
was open. Its client tooling updates for `@types/node` and `@vue/test-utils`
are applied locally for validation only. The latter drops class-component test
support; the repository has no class-component usage. The pull request is not
merged or modified.

## Implementation Outcome

- The existing policy-change review-history summary is now contract version
  `v4` and contains a fixed calibration-protocol read model.
- The protocol is available only when the existing six-period calibration
  readiness is `ready_for_human_review` and the existing review-process state
  is `consistent`. Malformed input, insufficient evidence, and a shifted or
  unavailable comparison fail closed.
- The Settings card refreshes through the existing automatic lifecycle and
  shows an accessible, fixed four-step ordered procedure only in the ready
  state. It creates no request, job, snapshot, export, threshold, proposal,
  policy update, AI/RAG call, provider call, retry, classification, or routing
  action.
- PR #523's `@types/node` 26.4.0 and `@vue/test-utils` 2.5.0 updates are
  applied locally and locked. The PR remains open and was neither merged nor
  modified.

## Validation

Completed on 2026-08-31:

- Focused protocol contract, summary, route, presentation, and component
  suites: 3 server suites / 8 tests and 3 client files / 6 tests passed.
- Full suites: server unit 961 suites / 27,143 tests passed; server integration
  75 suites / 868 tests passed, with one intentional skipped suite/test; client
  288 files / 3,970 tests passed.
- Server and client lint, type checks, production client build, and both
  `npm audit --audit-level=high` checks passed with no vulnerabilities.
- Server and client coverage suites passed. The repository coverage ratchet
  passed with no regression.
- A complete security diff scan found no reportable issues across the HTTP
  boundary, server contract, client validation/UI, and dependency update. The
  advisory TAC connector was unavailable and did not gate the review.
- `docker compose build --no-cache` completed; `docker compose up -d
  --force-recreate --wait` reported healthy; the local root returned HTTP 200.

## Next Item

After real use reaches `ready_for_offline_protocol`, define a separately
reviewed, checked-in synthetic fixture corpus and a versioned human approval
packet format. It must remain offline and non-mutating until an administrator
explicitly approves a future policy change.
