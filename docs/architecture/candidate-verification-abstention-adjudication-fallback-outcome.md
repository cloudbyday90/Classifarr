# Candidate Verification Abstention Adjudication Fallback Outcome

## Outcome

The fallback is implemented and covered on 2026-09-10.

For an eligible `prompt_confirm` policy decision, an abstained strict verifier
now leads to one advisory comparison of the same two or three policy-eligible
libraries. Its result stays in the existing pending-decision flow and requires
an operator confirmation. A strict confirmation still ends the flow as before;
a contract violation is not retried through adjudication.

This specifically addresses the observed pattern where a title such as *Deep
Water* was initially proposed for a clearly unsuitable library, while the
strict verifier correctly abstained but could not identify the more suitable
policy candidate.

## Local Evidence

Focused backend verification passed:

```text
8 test suites passed
190 tests passed
```

The coverage includes:

- fallback admission after `abstained` and
  `provider_capability_unavailable`;
- refusal to mask `confirmed`, contract-violation, and candidate-integrity
  results;
- a policy-path integration case that performs strict verification first,
  then sends exactly the server-bounded alternatives to advisory adjudication;
- preservation of `needs_clarification: true` and the original
  candidate-bound verification status.

The previous local Docker Compose eligibility audit remains relevant: all
6,649 sampled pending items were ineligible for an independent held-out study
because the installation currently has profile-derived rather than retained
declared policy purpose. That is a correct fail-closed result. It means the
platform must not pretend existing library placement is a labelled semantic
truth set.

## Open Pull Request Check

GitHub's official repository pull-request API was checked on 2026-09-10 and
reported no open pull requests. Consequently, no unrelated pull request was
selected or applied locally for this change; doing so would require inventing a
nonexistent candidate.

## Scope Deliberately Excluded

- No automatic route is added.
- No policy score or threshold is inflated.
- No provider/model thinking, raw output, or raw retrieval payload is retained.
- No current-library profile is promoted to semantic proof.
- No historic data is fabricated to create an evaluation corpus.
- No browser UI panel is added; the existing decision presentation remains the
  progressive disclosure surface.

## Next Recommended Item

Create a compact, administrator-reviewed policy-intent bootstrap that lets a
policy owner explicitly retain each library's declared purpose. Then collect
independently labelled, held-out outcomes for the existing stratified study.
That is the prerequisite for measuring whether semantic retrieval and bounded
AI adjudication improve destination precision before any broader automation is
considered.
