# Automatic Exact-Item Learning Outcome

## Delivered behavior

- `PolicyRuntimeExactItemMemoryAutoLearningService` invokes the existing
  guarded exact-item-memory command after a successful, authenticated runtime
  confirmation or destination change.
- The final outcome commits first. Learning is a separate, best-effort
  follow-up, so a rejected or unavailable learning operation cannot undo the
  resolved route.
- The result returns one bounded status: `recorded`, `already_recorded`,
  `not_applicable`, `not_eligible`, or `unavailable`.
- Manual correction learning is unchanged; it already records exact-item
  memory as part of its authorized correction transaction.
- The normal web flow gains no additional control or acknowledgement.

## Verification

Focused server tests cover:

- authenticated confirmation recording;
- replay/idempotency;
- exclusion of unauthenticated and non-routing actions;
- guarded admission rejection without route failure;
- unexpected persistence-failure containment; and
- integration from runtime-question resolution to the automatic-learning
  service.

## Expected operator experience

Confirming an eligible runtime suggestion—or choosing a different eligible
destination—remains one action. Classifarr captures the outcome for future
exact identity evidence automatically. If it cannot safely learn, the route
still completes and no new acknowledgement is requested.

## Limitations

- Learning requires a stable TMDB identity and a final runtime outcome.
- It improves exact reclassification of that media item; it does not make a
  genre, keyword, or library-profile rule.
- It does not make AI or RAG route media independently. Semantic retrieval
  remains advisory and policy safeguards remain in force.

## Pull-request check

The repository had zero open pull requests when this work was researched on
2026-09-02, so no random external PR was available to implement locally. This
change was implemented directly on the current branch and is not a merge of an
external PR.
