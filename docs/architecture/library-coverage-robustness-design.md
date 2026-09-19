# Library coverage robustness benchmark

Date: 2026-09-19. Status: implementation design; no routing promotion.

## Decision and boundary

Evaluate the previous coverage-aware profile change before changing its 90%
readiness threshold. Reuse the existing read-only description benchmark, cached
embeddings, grouped hold-outs and bounded profile worker. No provider generation,
model training endpoint, database writes, profile-cache publication or routing.
This learns representative geometry locally; it does not fine-tune an LLM.

## Protocol

Run the original two disjoint 300-description cohorts across movie and TV
libraries, with five library-balanced folds. Remove every copy of each fold's
held-out description, including cross-media copies, before fitting or choosing
missingness. Each arm retains the complete training membership and candidate
scope; only embedding availability changes. Require a fully cached baseline.

Compare six fixed arms: complete coverage, random 10% and 20% loss, concentrated
10% and 20% loss, and loss of the smallest learned group in each library.
Percentage masks remove floor(n * percent / 100) distinct exclusive descriptions
per library. Concentrated masks rank training vectors by similarity to a
deterministically seeded training-only anchor. The group-loss arm assigns training
vectors to the complete fold's selected centroids and removes the smallest
nonempty group. These are embedding neighborhoods, not verified human genres.
All masks remove a selected hash globally; shared descriptions cannot acquire
exclusive support when a vector goes missing. Actual coverage is reported.

Use the same three-start, bounded-recovery fitter and conservative comparison
checks as the runtime. An under-covered candidate blocks comparison; do not
silently drop it. Report abstention reasons, historical-placement agreement,
changed destinations, lost/gained agreement and new/recovered comparisons against
the complete arm. Reports contain aggregate movie/TV and anonymous-library
strata, not individual records. Check source and representation again at the end;
invalidate the result if either changed.

## Research and tradeoffs

Official sources were located through search/GitHub services and read on
2026-09-19:

- [scikit-learn leakage guidance](https://scikit-learn.org/1.8/common_pitfalls.html):
  split before fitting; keep evaluation data out of preprocessing. Group-level
  hold-outs prevent duplicate leakage. Fixed seeds reproduce tests, but one
  snapshot and seed family cannot establish general robustness.
- [NIST AI RMF trustworthiness](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/):
  document evaluation conditions and limitations. Placement agreement is a proxy,
  not verified semantic accuracy or permission to route automatically.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  bounded, fixed-category diagnostics; never emit source descriptions, titles,
  identifiers, vectors, credentials or arbitrary provider exception text.
- [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  retain the existing refresh-pause control. This offline benchmark adds no UI,
  extra review steps or status panels and makes no WCAG-conformance claim.

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Raise coverage to 100% immediately | Simple availability safeguard | A few broken records block healthy libraries; semantic benefit unmeasured |
| Lower the threshold immediately | More comparisons while backfilling | Could hide missing content neighborhoods |
| Benchmark fixed missingness first | Measures both coverage and selection effects without routing risk | Additional offline compute; placement labels can be wrong |

Recommended stack: complete cached source validation -> grouped hold-out ->
training-only missingness -> existing bounded fitter and comparison guards ->
aggregate paired metrics -> source revalidation. Keep the threshold and live
routing unchanged until results justify a separately tested proposal. Do not
tune on these repeatedly reused controls; validate any future proposal on fresh
samples and independently checked difficult cases.

## Security and resource limits

Run one fixed-code profile worker at a time with its existing 512 MiB limit,
empty environment and cancellation/termination contract. Enforce existing
snapshot limits, at most 300 cases, 2-10 folds and a total planned-work budget.
Use read-only database transactions. The benchmark neither repairs metadata nor
publishes held-out models into runtime caches. No new dependencies are required.

## Validation plan

Test duplicate/cross-media hold-outs, masking determinism and name independence,
retained membership, sparse/under-covered candidates, paired metric accounting,
abort and work limits, zero-generation CLI admission, source invalidation,
redacted output and actual worker fitting. Execute both 300-case cohorts on local
Compose. Record results and limitations in the separate outcome document.
