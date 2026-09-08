# Prospective held-out semantic cohort design

Status: Implemented, unreleased. Research checked 7 September 2026 against
the linked primary sources.

## Problem

The existing held-out capture correctly froze a 24–32-case request and excluded
every cohort identity from retrieval. Its real inventory check stopped at the
first case without an eligible pending comparison, however. The only earlier
28-case replay also selected current-library items and then assessed semantic
output, which risks making semantic evidence influence who enters the study.

The study needs an automatically selected, prospective candidate-comparison
cohort. It must still remain distinct from human labelling, readiness, frozen
preflight, policy configuration, and routing.

## Decision

Add a private `study:capture:held-out-cohort` command composed from small ESM
services.

```text
read-only, identity-verified inventory frame
  -> broad-policy-only eligible comparison screening
  -> fixed balanced 24–32-case cohort and opaque IDs
  -> existing held-out retrieval capture over the whole exclusion set
  -> redacted fixture/snapshot/manifest bundle
  -> external double-blind human labels
  -> existing readiness and frozen-study preflight
```

The inventory reader starts from a canonical `(media_type, tmdb_id)` identity,
filters current source-conflict observations, and uses a per-run cryptographic
seed for deterministic ranking within the run. It samples up to 96 candidates
per documentary, genre-overlap, ordinary, and reality stratum. The receipt
contains only aggregate eligibility and selected counts, a secret-free
selection commitment, and fixed false authority flags.

Before any semantic lookup, the preparation service evaluates only the active
policy's broad signals. It supplies an empty RAG cache and bypasses assignment
authority, direct history, learned profiles, patterns, and inferred
profile-sourced rules. A case is eligible only when that policy path returns a
server-owned two- or three-candidate comparison contract with status `ready`.
For the default 28-case study, the planner requires seven eligible cases in
each stratum. If any quota is unavailable, it emits no partial request,
snapshot, or fixture bundle.

Only after selection does the existing capture freeze the full cohort and run
held-out semantic retrieval. It continues to exclude every identity before
ordering and limits, uses exact offline query settings, and checks the policy
and embedding configuration before, during, and after capture. The bundle
contains opaque fixture IDs, stratum tags, status-only snapshots, and content
fingerprints. Its placeholder fixture reference is `abstain` only so the
offline artifact is structurally valid; it cannot be used as a label or make
readiness pass.

The private process enables PostgreSQL's `default_transaction_read_only` before
loading the runtime and suppresses normal and file logging. It accepts no file
arguments, adds no HTTP route, writes no database record, and returns no media
title, identity, library, description, vector, candidate ID, model output, or
selection seed.

## Research basis

NIST AI RMF calls for documented test sets, metrics, measurement conditions,
and independent assessment appropriate to deployment. The policy-only cohort
screen and the separate human-label stage keep the measurement set from being
chosen by the signal under evaluation. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

W3C's data-quality guidance recommends clear provenance, quality information,
and version history. The versioned receipt, immutable configuration and
exclusion-set commitments, and fingerprinted status-only artifacts implement
that guidance without retaining content. [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

OWASP's RAG guidance recommends treating retrieved information as untrusted,
minimising retained data, isolating access, and enforcing trust boundaries.
The implementation keeps semantic retrieval after cohort selection and emits
only bounded aggregate/status artifacts. [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)

The read-only process and the parameterized source query fit PostgreSQL's
transaction model and `SELECT` evaluation rules. They do not make a live
inventory snapshot immutable, so configuration and exclusion commitments remain
explicit limitations. [PostgreSQL Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
and [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Select cases after semantic retrieval | Finds apparently informative cases quickly | The evaluated signal selects the sample and biases its error profile | Reject |
| Manually select every study item | Allows case-by-case judgement | Adds recurring operational work and cannot prove selection independence | Reject |
| Broad-policy screen, then freeze and retrieve | Separates comparator eligibility from semantic evidence; gives balanced, repeatable strata | May correctly report that the current policy configuration has no eligible comparisons | Adopt |
| Copy an isolated inventory/index for each study | Better full-system isolation | Creates a sensitive duplicate corpus and substantial lifecycle work | Defer |

## Final recommendation stack

1. Use the private planner to measure whether broad-policy candidate pairs
   exist before collecting any human labels.
2. When it captures a complete cohort, collect two blinded human labels and a
   third adjudication only for disagreements using the existing independent
   reference-set contract.
3. Run the existing semantic readiness and frozen-study preflight against the
   complete fingerprint-bound bundle.
4. If and only if the measured profile passes, design a separate
   counter-evidence feature that sends ambiguous comparisons to human review.
   It must not auto-route, learn, or change policy.

## Non-goals

- This is not an independent-label system or proof that reviewers were blind.
- This is not a production policy configuration editor or a way to manufacture
  candidate comparisons.
- This does not enable semantic routing, policy changes, retries, learning, or
  a release.
