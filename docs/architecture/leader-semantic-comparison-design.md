# Library-agnostic semantic comparison design

## Scope and finding

The preceding rejection experiment left 25 exact-neighbor nominations without a
distinct destination and three TV library-withheld probes with alternative support.
Vector proximity alone does not establish content meaning. This experiment asks
the installed local model to compare the query's description and allowlisted
metadata against real, provenance-clean examples from every candidate in scope.
It does not teach library names as genre rules or change live routing.

## Selected design

1. Add an exclusive `--leader-semantic` mode to the existing inventory benchmark.
   Reuse its frozen snapshot, grouped exclusions, exact baseline, integrity controls,
   resource admission and end-of-run verification. Zero generation remains the
   default; generation is capped at 32 cases / 64 calls per run.
2. Select unresolved `not_distinguished` nominations and supported library-withheld
   probes before observing model output. Keep the complete candidate scope; never
   silently reduce it to fit an existing three-candidate prompt. Bound retained
   private plans and select across probe kind and media type.
3. Show anonymous numbered libraries, query description/traits and up to three
   retrieved descriptions per candidate. Exclude names, titles, provider IDs,
   observed destination, policy scores and previous decisions. Treat all content
   as untrusted JSON data, not instructions. Sparse or oversized evidence abstains.
4. Reuse the local-only client with a separate bounded comparison schema. Require
   one integer candidate index, with zero for abstention; strictly reject duplicate
   keys, prose, unknown indices and additional fields. Preserve existing narrow
   live/adjudication contracts.
5. Compare each case twice, reversing candidate and example order and remapping
   indices. Only consistent nonzero proposals count as stable support. Stop on
   transport/protocol/limit errors without repair loops or provider fallback.
6. Keep model digests, source verification, no-write behavior, cancellation and
   redacted aggregate reports. A fresh invocation can retry after failure; partial
   output never becomes a routing receipt or training label.
7. Evaluate a second, disjoint description cohort using existing prior-sample
   exclusion. Report placement agreement and withheld-library behavior separately;
   neither supplies independently verified semantic accuracy.

## Options and final recommendation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Loosen vector thresholds | Fast, fewer reviews | Does not resolve meaning; reject |
| One named-library model choice | Cheap | Name/order bias and hidden shortlist loss; reject |
| Anonymous full-scope paired comparison | Uses organic content with measurable abstention | Two bounded local calls; implement offline |
| Immediate model-driven routing | Less user involvement | No independent correctness evidence; defer |

Recommended stack: validated inventory → clean grouped retrieval → context-bound
exact baseline → anonymous semantic comparison → order-consistency/abstention →
source-verified aggregate evaluation → existing routing safeguards. No settings,
acknowledgement screen or additional user task is added.

## Official sources checked on 20 September 2026

URLs were discovered by search and opened, not guessed.

- [Ollama structured outputs](https://ollama.com/blog/structured-outputs) describes
  JSON-schema-constrained responses, application validation and deterministic
  generation settings. A valid schema is not evidence of semantic correctness.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  covers untrusted retrieved content, bounded context, output validation, provenance
  and fail-closed handling. The model gets no tools or routing authority here.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  supports concise accessible feedback without excessive announcements. This
  offline change adds no UI noise; any future surfaced summary should describe the
  actionable result rather than every internal check.

See the separate outcome document for implementation and measured results.
