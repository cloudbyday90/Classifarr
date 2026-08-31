# Policy-Scoped Evidence Digest Outcome

## Delivered

On 2026-08-31, Classifarr added a read-only evidence digest for one explicitly
selected policy.

- The policy-maintenance action now opens the digest for that policy instead of
  leaving the operator at an aggregate review only.
- The aggregate purpose-coverage view provides a **Review evidence** action
  for each policy row.
- The reconciliation view loads the selected digest automatically and focuses
  it only for the explicit evidence handoff.
- The digest reports declared-intent authority, stored-profile provenance and
  freshness, and a fixed 90-day summary of policy-authorized identity
  admissions.
- The response is admin-only, validates the policy ID, returns 404 for a
  missing policy, and is non-cacheable.

## Non-goals retained

The implementation does not:

- use AI, Ollama, RAG, embeddings, or model reasoning;
- read a current media-server library or rescan content;
- return titles, classification IDs, rule values, profile payloads,
  fingerprints, event IDs, evidence keys, or model text;
- adjust policy scores, policy configuration, learning, candidate selection,
  or routing.

## Verification

Focused checks passed before broader verification:

| Check | Result |
| --- | --- |
| Server digest contract, persistence, service, and protected route tests | 14 passing |
| Client API, policy handoff, reconciliation view, purpose-coverage action, and digest component tests | 46 passing |

The route tests exercise no-store caching, administrator-only access, invalid
identifier rejection, and missing-policy behavior. Contract and persistence
tests assert that prohibited raw fields cannot appear in the response or query
projections.

## Pull-request evaluation

GitHub was queried for open pull requests in `cloudbyday90/Classifarr` on
2026-08-31. It returned zero open pull requests. Therefore no unrelated or
stale pull request was implemented locally; this outcome is deliberate rather
than a skipped code-quality task.

## Follow-up

The next high-value component is a candidate-level explanation panel for the
specific pending classification the operator is already reviewing. It should
correlate the deterministic score bands and each admitted evidence category
with the selected candidate, preserve the same redaction limits, and keep AI
or RAG advisory rather than authoritative.
