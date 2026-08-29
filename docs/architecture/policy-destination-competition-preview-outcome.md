# Policy Destination Competition Preview Outcome

Implemented: 2026-08-29.

## Delivered

Existing-policy maintenance now includes **Preview destination competition**.
An administrator can compare an unsaved proposed policy draft against active
same-media-type destination policies over the same bounded deterministic
historic cohort used by the individual cohort preview.

The response contains only aggregate proposed-only, shared, competitor-only,
and no-candidate eligibility counts, along with the bounded sample and
competitor-policy counts. It never exposes an item, a competitor identity, or
any policy configuration.

## Behavior Boundaries

- Cohort: 90 calendar days and at most 100 allow-listed deterministic historic
  classifications.
- Competitors: enabled policies in active libraries of the same media type,
  excluding the selected policy and capped at 25.
- Evaluation: shared deterministic native-intent evaluator and in-memory
  contracts only.
- Authority: administrator-only and explicitly initiated.
- Effects: no policy write, cache write, learning update, AI call, RAG call,
  threshold decision, routing decision, or media-server action.

## Recommended Operator Workflow

1. Review the purpose-overlap inspection when a policy contains broad signals.
2. Adjust the unsaved draft and run the individual cohort preview.
3. Run **Preview destination competition**.
4. Investigate a large shared-eligibility count by narrowing declared purpose
   evidence, adding an appropriate strict constraint, or deliberately keeping
   the overlap and relying on the normal downstream policy decision process.
5. Save only after the draft reflects the intended destination; neither
   preview authorizes routing.

## Verification

Focused server unit, route, persistence, service, integration, client API,
component, modal, and inventory tests cover the request boundary, batch
loading, bounded query, aggregate-only response, stale-result reset,
accessibility, and the non-authoritative authoring cutline. The integration
test confirms the live evaluator/query path makes no configuration or history
writes. On 2026-08-29, server lint and type checks, client lint/type checks and
production build, server unit tests (882 suites, 25,519 tests), client tests
(250 files, 3,654 tests), and the dedicated integration test passed. The
implementation remains unreleased; the next release decision is separate from
this change.

## Follow-up

The next high-value item is a **configured-policy explanation card** for a
shared eligibility aggregate. It should remain aggregate-only and explain which
class of configured rule could cause the overlap, without disclosing another
destination's policy terms or making a routing decision.
