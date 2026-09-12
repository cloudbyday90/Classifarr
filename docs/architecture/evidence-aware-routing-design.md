# Evidence-aware routing design

## Decision and scope

Commit `f6733e47` improved which libraries reach comparison. The remaining
finalizer always requests clarification, even when the selected destination
already meets its configured automatic threshold. Add one narrow automatic
path: resolve a threshold-qualified policy ambiguity using current inventory
evidence and a matching local AI proposal. Do not raise a policy score, change
thresholds, or infer a probability from a model's self-reported confidence.

This first component does not automatically route a 45-score candidate against
an 85 threshold. That requires a separately evaluated scoring improvement, not
an exception that silently bypasses configured thresholds.

## Admission rules

- Only current `prompt_select` outcomes without an explicit manual-review veto.
- The chosen library is active, same-media, in the policy ranking and comparison
  contract, and its finite current policy score meets its automatic threshold.
  The existing 70-point minimum also remains in force.
- Every other threshold-qualified policy candidate was included in comparison.
- A non-fallback local Ollama proposal with validated provider-authority metadata
  selects that destination; malformed, recovered or abstaining results cannot
  authorize anything. Model confidence and explanation are not admission inputs.
- All compared libraries have complete current description coverage and at least
  three examples. The winner has three distinct unshared examples, mean cosine
  similarity at least 0.80, minimum 0.75, and a mean lead of at least 0.05 over
  every alternative. These are conservative application heuristics, not
  calibrated probabilities or universal embedding-model thresholds.
- The winner has valid positive learned fit, without a better-fitting alternative
  or contradictory exact-identity evidence. Learning and examples are correlated
  observations, not independent votes or proof that historic placements are right.
- Re-read policy and evidence after generation. Changed, missing, partial or
  unavailable evidence keeps the ordinary review result.
- Recheck active library configuration and the local provider/model/RAG setting;
  do not use a destination or provider configuration changed during comparison.

## Architecture and security

Keep the existing advisory finalizer pure and unchanged. Add a pure consensus
assessment and a small orchestration service that can upgrade its result only
after revalidation. Both direct adjudication and verification-fallback
adjudication use the same service.

Automatic authority is a short-lived process-local receipt, not a JSON boolean
or a method label. Bind it to the selected destination, current policy snapshot
and item identity. Object spreads may carry it within this request; persisted
JSON and provider responses cannot recreate it. Both question construction and
the final Arr gate validate it. Administrative confirmation and provider recovery
continue to block routing. Missing, altered or expired receipts fail closed.
If a grant expires after initial history persistence, restore the ordinary review
question and `awaiting_decision` state without overwriting an already routed
record. The receipt expires after 60 seconds; it is not a durable queue token.

Do not convert the system's own automatic placements into reviewed labels.
History scoring excludes this new method; RAG quality assessment downweights it
even if its status says completed or routed. Existing inventory can still be
observed as context, so this is not a claim that all feedback loops are eliminated.

Retain the selected candidate's real policy score and existing policy result.
Do not disguise the result as deterministic `policy_auto`. No schema change,
dependency, provider permission expansion, acknowledgement or new UI panel is
needed. Metadata remains untrusted data and cannot supply executable actions.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Always confirm AI recommendations | Simple; existing behavior | Qualified ambiguities still require clicks | Fallback |
| Route whenever the model sounds confident | Broad automation | Uncalibrated confidence; injection and misrouting risk | Reject |
| Threshold-qualified, evidence-supported ambiguity resolution | Useful bounded automation; honors configuration | Limited reach; extra read; imperfect inventory observations | Implement first |
| Evidence-aware score calibration | Can eventually help low-score correct matches | Needs separate held-out correctness evidence | Follow-up |

Stack: hard eligibility and configured threshold → current library evidence →
bounded AI proposal → post-generation revalidation → transient server receipt →
administrative/provider/final routing guards.

## Verification and accessibility

Test success and every rejection boundary, both policy-path branches, receipt
forgery/serialization/expiry/mutation, administrative override and actual Arr
gate decisions. Replay a seeded 100-title local cohort without routing or
rewriting media, and report admission separately from accuracy and placement
agreement. Existing placements are not independently verified labels.

No new interaction is required. Existing status and history surfaces remain the
presentation path. W3C recommends programmatic, non-focus-taking status updates;
avoid additional warning panels or interrupting automatic refresh messages.

## Official research and date boundary

URLs were discovered through search and read September 12, 2026. Living pages
are not certified archived August 2026 snapshots.

- [scikit-learn 1.8 probability calibration](https://scikit-learn.org/1.8/modules/calibration.html):
  probabilities need calibration against independent data; redundant evidence
  can make naive confidence estimates overconfident.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  validate model output, enforce downstream authorization outside the model,
  preserve provenance, and fail closed on retrieval or authorization failures.
- [W3C ARIA22 status technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22):
  expose status without moving focus. This does not require a new UI control.
