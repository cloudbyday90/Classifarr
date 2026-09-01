# Future Redacted Reviewed-Corpus Evaluation Outcome

## Delivered

Classifarr now evaluates the readiness of its automatically captured,
future-only reviewed corpus without exposing a row or changing a runtime
decision.

- A new modular evaluator reads only fixed aggregate counts from the current
  automatic-capture revision. It starts with a safe 30-day default and does
  not require an administrator acknowledgement.
- It reports whether each deterministic score-margin band has reached the
  six-row baseline, for a total baseline of 24 retained future operator
  outcomes.
- It is administrator-only, rate-limited, `no-store`, parameterized, and
  rejects malformed aggregate strata instead of inferring missing data.
- It does not query historical classification rows, the historical projection,
  inventory, RAG, model configuration, prompts, responses, or embeddings.
- Security Settings now shows one compact automatic status and refreshes it
  every five minutes while the page is open. Optional retention
  and historical-snapshot settings are behind a disclosure; they are not a
  prerequisite for capture, Classifarr, AI, RAG, policy, or routing.

## What the status means

`Collecting redacted operator outcomes automatically` means that Classifarr is
waiting for more explicit future operator decisions in one or more
score-margin bands. It does **not** mean a job is stuck, that AI is unavailable,
or that the score is a confidence percentage.

`Redacted evaluation baseline is ready` means only that a future, separately
approved evaluation plan may be designed. It does not authorize a policy,
model, RAG, learning, retry, or routing change.

The optional retention acknowledgement is not a product-on switch. It permits
an administrator to replace the default 30-day retention with a bounded
choice and use the intentionally separate historical snapshot workflow.

## Verification

The implementation adds contract, persistence, service, API-layer, and client
presentation tests. Verification includes targeted contract, persistence,
service, API, and presentation tests; server/client type and lint gates;
full server/client test and build gates; migration/schema parity; documentation
lint; static ESM import checks; a fresh local Compose rebuild; and a
changed-code security review.

The local Compose database applied
`20260901_100000_add_policy_candidate_correction_review_corpus_capture_evaluation_index.sql`,
and an independently started disposable container passed schema-snapshot
validation against the generated snapshot.

## Open pull-request check

The GitHub pull-request query for `cloudbyday90/Classifarr` returned no open
pull requests at the time of implementation. There was therefore no candidate
PR to implement locally or test without merging; this change is wholly based on
the repository's current `main` worktree.

## Follow-up recommendation

The highest-value next component is a separately approved **semantic
adjudication workbench**. It should create a small, time-bounded evaluation
set that joins title/description and policy-eligible-library context only after
explicit administrator approval, uses permission-scoped retrieval, records a
human reference decision, and evaluates a frozen RAG/model proposal offline.
It must remain outside live routing and must not be auto-populated from this
redacted corpus.
