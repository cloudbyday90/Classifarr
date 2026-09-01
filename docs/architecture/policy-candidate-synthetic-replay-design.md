# Synthetic Policy-Candidate Replay Design

## Decision

Classifarr retains a fixed-fixture, command-line-only synthetic replay for
reviewing deterministic candidate scope and calibration changes before those
changes are accepted into the codebase. It does not restore the retired
live-history or browser replay paths.

The replay exercises the same pure calibration, ranking, ambiguity, weak
evidence, and score-band projection used by policy classification. It accepts
only committed, opaque synthetic states. It never receives a media title,
library name, policy text, metadata ID, provider data, prompt, model response,
RAG text, threshold, runtime path, or user-provided payload.

## Why this boundary

The candidate screens showed that a broad contextual signal can appear
plausible while not constituting enough independent evidence to route media.
The right next control is a repeatable test of deterministic ranking behavior,
not a new AI call, live inventory query, or policy-changing preview.

This follows the NIST AI RMF emphasis on documented scope, measurement, and
human oversight, and the NIST SSDF practice of building repeatable security
checks into normal development. The check intentionally has no UI. That avoids
introducing another busy status surface or an inaccessible dynamic status
message; if a future UI is proposed, it must follow WCAG 2.2 status-message
semantics and be usability-tested for unnecessary announcements.

Sources consulted on 2026-09-01:

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Architecture

```text
checked-in synthetic corpus
        |
strict fixture contract (allow-list + bounds)
        |
pure candidate calibration and ranking projection
        |
pure candidate decision projection
        |
aggregate pass/fail report
```

The source modules are deliberately small and separate:

- `policyCandidateRankingProjection.mjs` calibrates and deterministically
  orders candidate records without logging or persistence.
- `policyCandidateDecisionProjection.mjs` derives an action projection and
  weak-evidence/ambiguity diagnostics without finalizing a decision.
- `policyCandidateSyntheticReplayFixtureContract.mjs` rejects unknown,
  unbounded, media-shaped, and incompatible synthetic fields.
- `policyCandidateSyntheticReplayEvaluation.mjs` runs the fixed corpus and
  emits aggregate-only results.
- `run-policy-candidate-synthetic-replay-evaluation.mjs` is the only runner;
  its fixture path is fixed in code and it accepts no CLI input.

The production `PolicyCandidateRanker` consumes the same projection modules,
then remains solely responsible for warning telemetry and finalized decision
metrics. This prevents the replay from becoming a subtly different scoring
implementation.

## Safety invariants

- The fixture contract has a bounded corpus size (6–16 scenarios) and a
  maximum of four opaque candidates per state.
- Synthetic candidates expose only small integer tokens, a bounded score,
  allow-listed evidence class, allow-listed viability, and an eligibility
  boolean. Unknown fields fail closed.
- The evaluator uses no database, HTTP, AI, RAG, file path supplied by a user,
  policy mutation, retry, routing, learning, or persistence service.
- Reports include only versions, aggregate counts, and risk IDs. They omit
  fixture IDs, candidate IDs, source data, and mismatch detail.
- A projected `auto_classify` action is a regression-test result only. Route
  safety remains separately required and is the sole authority that can admit
  an actual automatic route.
- The replay evaluator is inventoried as a non-browser, non-HTTP,
  side-effect-free evidence reducer in the preview/replay cutline.

## Operator procedure

1. Identify the deterministic scope or calibration change from aggregate
   correction evidence; do not infer it from a single pending item.
2. Add or revise an opaque synthetic scenario that represents the intended
   before/after evidence class and viability state. Do not copy production
   media, names, policy terms, metadata, or provider output into the fixture.
3. Review expected leader/action projection with another maintainer.
4. Run `npm run test:offline:policy-candidate-synthetic-replay` and the
   relevant ranker/unit tests.
5. Review the normal policy and route-safety tests separately. A passing replay
   is evidence for a code review; it neither approves nor applies a change.

## Alternatives considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Fixed synthetic CLI replay | Deterministic, safe, fast, repeatable, no new operator burden | Needs curated scenarios; cannot estimate live prevalence | Selected |
| Browser replay of live data | Familiar visual workflow | Recreates retired authorization/data-exposure risks and adds UI complexity | Rejected |
| AI/RAG evaluation of every change | Can reason over rich descriptions | Nondeterministic, provider-dependent, and unsuitable as routing authority | Rejected |
| Automatic policy tuning from corrections | Low manual effort | Unsafe causal assumptions and difficult rollback | Rejected |

## Exit criterion

Remove or replace this harness only after it has no active policy-rebuild
binding and a more secure, equivalently bounded replacement has been accepted.
It must not be promoted into normal policy authoring, a dedicated HTTP endpoint,
or a browser diagnostic.
