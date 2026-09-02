# Frozen Semantic-Adjudication Cohort Outcome

## Delivered

Candidate Retrieval Monitoring now includes an automatic, configuration-bounded
semantic-adjudication evaluation cohort.

- Each eligible candidate comparison persists only an opaque SHA-256 marker
  derived server-side from the AI authority and semantic-retrieval protocol.
- The normal aggregate monitoring endpoint selects only the newest such cohort
  in the completed UTC-day window; it does not return a fingerprint, model,
  provider, library, item, description, prompt, response, vector, or actor.
- The collapsed Statistics disclosure reports whether the cohort is absent,
  collecting later operator outcomes, or ready for a human evaluation after
  twelve resolved proposals.
- It refreshes with the existing five-minute monitoring cadence and introduces
  no acknowledgement, manual action, new Settings surface, migration, raw
  content capture, or live-routing behavior.
- The reported operator alignment remains descriptive. Both policy-change and
  automatic-routing eligibility remain false for every workbench state.

## What operators should infer

**Waiting for a frozen proposal cohort** means no recent candidate comparison
has both a valid server-owned AI authority and a valid semantic-context status.
It does not mean AI or RAG is disabled.

**Collecting later operator decisions** means Classifarr has started a stable
proposal cohort but has fewer than twelve resolved advisory proposals. Normal
operator confirmations provide the observational reference automatically; no
second approval is needed.

**Ready for human evaluation** means the latest unchanged proposal cohort has
reached the review floor. It is the point to plan an independently labelled
semantic study—not permission to change a policy, tune RAG, trust AI, or route
automatically.

## Verification

The implementation adds ESM unit coverage for:

- stable and fail-closed proposal-fingerprint construction and projection;
- persistence allow-listing of the opaque marker only;
- aggregate newest-cohort SQL shape and fixed parameters;
- bounded cohort counts, status transitions, and inert authority; and
- the Statistics disclosure's fixed status presentation and absence of action
  controls.

Targeted server and client test suites pass before the full repository,
security, and Compose verification gates run.

## Open pull-request check

GitHub's public pull-request endpoint for `cloudbyday90/Classifarr` returned
no open pull requests on 2026-09-01. There was no random external PR to copy
into the local worktree or merge; this change is based solely on current
`main`.

## Next recommendation

After a stable cohort reaches the review floor, the next high-value component
is an **independently labelled semantic reference-set import workflow**. It
should require a separate administrator-approved, time-bounded study session;
freeze the exact RAG/index and model artifacts; expose a purpose-minimized
review packet only to authorized reviewers; retain human labels separately
from model output; and delete the packet at expiry. It must remain offline and
outside routing until its measured error profile and security review support a
separate design decision.
