# Candidate Semantic-Adjudication Outcome Evaluation Outcome

## Delivered

Candidate Retrieval Monitoring now separates bounded AI candidate comparisons
by whether candidate-scoped semantic similarity to current-library descriptions
was available, unavailable, or absent from a legacy record.

- The existing aggregate query projects only fixed category counts from
  persisted allow-listed metadata.
- A new pure ESM metrics module owns count bounding, bucket shaping, agreement
  rates, and fail-closed handling of malformed aggregate values.
- The Statistics view explains proposal, abstention, and contract-rejection
  counts first; semantic-context detail is hidden behind one accessible
  disclosure.
- Monitoring refreshes automatically every five minutes while the view is
  open. It has no manual refresh or acknowledgement control.
- No migration, title/description retention, new live model call, RAG read,
  provider/model identity, policy mutation, retry, learning, or routing path
  was added.

## What operators should infer

If **Semantic context available** has few or no observations, the deployment
has not yet exercised enough candidate-bound semantic comparisons to evaluate
that path. If it has a different operator-alignment rate from **Semantic
context unavailable**, that is a reason to inspect the bounded retrieval and
prompt configuration—not an automatic reason to trust, tune, or authorize AI.

An abstention or rejected response is useful operational evidence: it means the
model did not make a usable bounded proposal. It does not mean that the policy
or chosen destination was wrong.

## Verification

The change adds a pure-service test for fixed semantic buckets and malformed
aggregate bounds, extends the aggregate SQL contract test, extends the
telemetry projection test, and verifies the client disclosure filters unknown
server status IDs. The complete server/client, security, Compose, and schema
checks remain required before release.

## Open pull-request check

GitHub's public pull-request endpoint for `cloudbyday90/Classifarr` returned
no open pull requests on 2026-09-01. There was no PR to implement locally or
merge.

## Next recommendation

After enough aggregate observations, the next high-value component is the
separately designed **human-approved semantic-adjudication workbench**: an
explicitly bounded, time-limited evaluation set that compares a frozen
RAG/model proposal with a human reference decision. It must not auto-capture
raw descriptions or library context, and it must remain outside live routing.
