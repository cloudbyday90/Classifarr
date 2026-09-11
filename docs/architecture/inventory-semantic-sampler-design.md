# Inventory Semantic Sampler — Design

Status: implementation design, 11 September 2026. Unreleased; no version change.

## Problem and decision

The previous recovery commit repaired retry handling, but the real Compose
study still produced no comparisons: all ten policies had inferred purposes,
not qualifying declared evidence. Evaluation admission was coupled to routing
admission. Requiring more declarations would not measure library understanding.

Add an offline, evaluation-only inventory sampler. Reuse the deterministic
inventory frame and its source-identity conflict filter, without consulting
policy admission. Compare stored semantic representations across active
same-media-type libraries. Keep descriptions and neighbor examples in memory
for an eventual evaluator; print only aggregate coverage and agreement counts.
Library membership is an observation, never a correctness label or declaration.

## Options

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Require purpose declarations first | Reuses routing-qualified study | Recreates manual work; excludes this installation | Reject for sampling |
| Immediately let AI rewrite policy | Fast visible automation | Can reinforce wrong placements without measured accuracy | Reject |
| Sample inventory with existing embeddings | No provider cost; real cross-library neighbors now | Stored embeddings may encode labels; coverage can be incomplete | Implement |
| Regenerate label-free description embeddings | Tests semantic fit independently of old label text | Provider cost and representation-version work | Next component |

## Implementation stack

1. Existing deterministic stratified inventory source, scoped to active libraries;
   fixed default seed,
   optional bounded seed and sample size, maximum 32 identities.
2. Small injected sampler service and separate PostgreSQL query module.
   One repeatable-read, read-only snapshot; statement, lock and transaction
   timeouts. At most 64 active libraries, three neighbors per library per item.
3. Exact cosine retrieval using a stored non-stale query embedding. Require
   matching provider, model and dimensions; reject zero-norm vectors. Select
   the latest compatible representation per identity, not the best historical
   score. Exclude every sampled identity from every neighbor library.
   Materialize the compatible set before cosine ranking, preserving ordinary
   relational indexes. Load descriptions and receipts only after selecting
   the nearest items, not for every possible match.
4. Aggregate-only ESM command. No schema, API, settings, browser controls,
   provider calls, policy changes, learning writes, or route attempts.

Missing embeddings, descriptions and neighbors remain in the denominator.
Do not replace difficult examples after retrieving them. The strata improve
coverage, but a small balanced sample is not a population accuracy estimate.
Current membership may span multiple libraries. Tied library scores do not
count as either agreement or disagreement. An observed library with no usable
neighbors cannot count as a disagreement. Similarity is not confidence.

An existing authorized-outcome receipt can be counted as provenance, but does
not prove independent semantic correctness. This first sampler has no verified
independent-label adapter: all samples remain unlabeled, and accuracy is null.
It is not interchangeable with the policy-qualified held-out reviewer packet.

## Security and privacy

SQL is parameterized. Vectors stay inside PostgreSQL. Titles, descriptions,
stable identities, library names and receipts never enter the CLI report.
Descriptions are untrusted data, not instructions. No model or downstream
action is invoked. Read-only startup settings suppress database-backed logging;
the service enforces read-only transactions independently of the CLI. Errors
produce generic CLI diagnostics, and the connection is always closed.

Stored embedding input text cannot currently be authenticated as label-free
or up to date with the current description. Mark its provenance explicitly;
do not present high agreement as evidence of learning or improved accuracy.

## Official research and date boundary

URLs were discovered through search and read with the web/MCP service on
11 September 2026. The requested baseline is August 2026. These are living
documents, not verified archived August snapshots; no September-specific
feature is required by this design.

- [pgvector documentation](https://github.com/pgvector/pgvector) distinguishes
  exact retrieval from approximate indexes. Use exact retrieval as the bounded
  diagnostic baseline; measure before optimizing with approximate search.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains consistent repeatable-read snapshots. Inventory and embeddings must
  not change halfway through a sample.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  supports documented measurement methods, limitations and independent
  evaluation. Separate coverage and observed agreement from correctness.
- [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  addresses retrieval poisoning and provenance. Existing placements and
  retrieved text must not grant authority to alter policy or execute actions.
- [W3C status messages guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  cautions against overly chatty announcements. No additional UI is justified
  for this offline component. Future Command Center integration should expose
  one concise, automatically refreshed status, with diagnostic detail optional.

## Validation and next step

Unit-test limits, missing evidence, tie handling, privacy, transaction settings
and CLI cleanup. Exercise actual pgvector SQL in isolated integration tests,
including cross-library held-out exclusion, duplicated histories, conflicting
source identities and incompatible embedding models. Run against local Compose
read-only and record real coverage separately from synthetic test outcomes.

Next: a label-free description-embedding comparison on these same identities.
That experiment can determine whether library names or historic labels are
overpowering actual content before any change to autonomous routing.
