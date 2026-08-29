# Policy Cohort Simulator Outcome

Implemented: 2026-08-29.

## Delivered

Existing-policy maintenance now includes **Preview recent cohort impact**. An
administrator can explicitly compare the saved policy and its unsaved editor
draft against a recent deterministic historic cohort before saving.

The server returns only:

- cohort window, maximum size, and evaluated count;
- current and proposed eligible counts;
- aggregate transition counts for newly eligible, no longer eligible, retained
  eligible, and retained ineligible records; and
- fixed status and guidance text.

The UI makes the limit explicit: eligibility is only one deterministic policy
stage and is neither an AI prediction nor a final routing decision.

## Behavior Boundaries

- Cohort: 90 calendar days, maximum 100 records.
- Input: server-selected rows with fixed allow-listed deterministic methods and
  terminal historic statuses for the saved policy's media type.
- Runtime semantics: both sides use the shared native-intent eligibility
  evaluator through in-memory contracts.
- Authority: administrator-only and explicitly invoked.
- Output: aggregate-only. No media title, ID, term, draft, metadata, score,
  provider state, prompt, model output, or RAG data is returned.
- Side effects: none. The draft is not persisted; no AI, learning, routing,
  threshold, policy, or database mutation occurs.

## Recommended Operator Workflow

1. Use purpose-overlap review to find broad or shared signals.
2. Edit the unsaved draft to express the destination more precisely.
3. Run **Preview cohort impact** and inspect the aggregate transitions.
4. If the change is plausible, save through the existing server validation
   path. If it produces an unexpected delta, revise the draft instead of
   lowering automatic thresholds.
5. Treat a zero-sized cohort as insufficient evidence, not approval.

## Verification

Focused tests passed for the draft adapter, bounded static query, service
orchestration, authorization, strict request envelope, aggregate-only response,
API client, and accessible component behavior:

- server unit and route tests: 6 suites, 29 tests;
- server integration test: 1 suite, 1 test; and
- client component, API, and modal tests: 3 files, 44 tests.

The complete quality gates passed on 2026-08-29:

- `npm run test:unit` in `server`: 878 suites, 25,434 tests;
- `node scripts/run-vitest.mjs run` in `client`: 249 files, 3,638 tests;
- server and client lint and typecheck; and
- client production build.

The security-diff review is performed against the final working-tree patch
before commit. Its result is recorded with the commit handoff.

## Follow-up

The next high-value improvement is an aggregate **destination competition
preview**: evaluate the same bounded cohort across the proposed destination and
other active policies, while retaining the same server-only, no-AI, no-routing,
aggregate-only boundary. That work needs a separate design because it begins
to model candidate selection rather than one policy's eligibility.
