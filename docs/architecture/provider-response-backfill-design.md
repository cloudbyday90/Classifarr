# Provider-response diagnosis and automatic backfill design

Date: 2026-09-13. Component: automatic inventory-description refresh.

## Findings and scope

Commit `31aeabca` repaired derived profile caches, not malformed responses from
the embedding provider. Its six GitHub workflows passed. The next boundary is
the local description embedder: malformed JSON, an unexpected model, incorrect
batch cardinality and invalid vectors currently become generic failures. The
refresh worker also resets its failure backoff when it merely yields to foreground
work. Neither observation proves why a provider generated a bad response.

Use precise observed failure categories and explicit operator steps, without
claiming an unobserved provider defect. Implement this first in the existing local
Ollama description-refresh path; do not change cloud inference or live routing.
The validation vocabulary remains independent of library names and content types.

## Recommendation stack

1. Preserve strict vector validation, adding fixed diagnostic reason codes.
2. Classify transport, HTTP, JSON, model, batch and vector failures at receipt.
3. Let only the refresh worker schedule retries; keep transport retries disabled.
4. Reuse the existing content/model-keyed PostgreSQL cache as the restart-safe
   checkpoint. Missing descriptions are rediscovered from current inventory.
5. Preserve failure state across busy/disabled/contended passes. Use capped
   exponential backoff with jitter; persistent configuration/request failures
   receive a longer delay. Reinspect the installed model on every admitted pass.
6. Validate every returned vector and recheck model identity and admission before
   writing a batch. Never pad, truncate, guess, coerce or silently switch models.
7. Deduplicate fixed warnings, record progress only after committed writes and
   report backlog completion separately from proof of provider health.

No new queue table, API endpoint, settings screen, release or routing authority.
The existing refresh budget remains eight embedding requests of up to eight descriptions
and a two-minute pass deadline. Recovery state and warning deduplication are
process-local; cache checkpoints survive restart. Persistent bad responses remain
excluded and periodically retried, not treated as successful learning.

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Repair invalid vectors in place | Appears immediately available | Invents evidence; incompatible geometry can contaminate learning | Reject |
| Retry inside every adapter | Small local change | Multiplies requests and hides delays from the scheduler | Reject |
| Add another durable queue | Durable per-item attempt history | Duplicates the cache-derived worklist and adds migration/retention complexity | Defer |
| Typed diagnosis plus existing checkpoint recovery | Bounded, restart-safe work discovery; fewer duplicate warnings | Provider defects cannot be repaired locally; retry timing resets on restart | Adopt |

## Official research, September 2026

Sources were discovered through search tools and opened, not constructed from
assumed URLs. These are engineering applications of the guidance, not claims of
certification or guaranteed recovery.

- [Ollama embedding API](https://docs.ollama.com/api/embed): responses name the
  model and contain an array of vectors; `truncate: false` rejects oversized
  inputs. Keep the existing no-truncation request and validate the response.
- [AWS retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html): bound retries, back off
  with jitter, distinguish persistent errors and avoid retries at multiple layers.
  Apply this to background reconciliation, not an unbounded inner retry loop.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): log validation failures with useful context while
  avoiding sensitive payloads and excessive noise. Use fixed codes, explanations
  and steps; never log response bodies, descriptions, vectors, endpoints or tokens.
- [W3C status-message technique](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22): status updates should be available to assistive technology without
  taking focus. This backend slice adds no UI; retain existing quiet SWR surfaces
  rather than adding pop-ups or repeated acknowledgements. Future status work must
  preserve polite announcements and existing refresh controls.

## Verification plan

Exercise malformed JSON, HTTP failures, mismatched model and batch responses,
vector dimensions/numbers/float32 limits, cancellation, oversized bodies, logger
failure, deduplication, busy passes, model drift and partial checkpoints. Run a
real HTTP mock provider through the worker, then recover it and verify missing
descriptions backfill without regenerating completed descriptions. Verify restart
resumption with real PostgreSQL checkpoints. Keep synthetic probes separate from
real library data and do not claim classification accuracy from recovery tests.
