# Live inventory description evidence: design

## Decision and scope

The previous refresh commit (`e3471f73`) maintains the synopsis-only vector cache
but does not consume it in live candidate adjudication. Connect that cache to the
existing closed candidate comparison, including competing libraries. This is one
backend component, not another settings or review screen.

## Recommendations and tradeoffs

| Option | Benefits | Costs / limitations | Decision |
| --- | --- | --- | --- |
| Keep historical embedding neighbors only | No new runtime work | Does not search all currently indexed inventory descriptions | Fallback only |
| Re-embed inventory for every request | Fresh representation | Repeated inference, queue contention, poor latency | Reject |
| Reuse maintained vectors; exact per-library cosine search | No inventory inference; explicit coverage; rival evidence | Bounded SQL work and at most one query embedding; incomplete caches remain incomplete | Adopt |
| Increase policy score when AI agrees | More automatic routes immediately | Agreement is not calibrated correctness; reinforces bad placements | Defer pending measured routing evaluation |

## Recommended stack

1. Reuse the versioned synopsis-only projection and local embedding transport.
2. Read current, active inventory membership and vectors in a short read-only
   repeatable-read snapshot. Match content hash, projection, model digest and
   dimensions exactly, and ignore expired vectors.
3. Exclude the query identity across libraries and identical query descriptions.
   Deduplicate identical descriptions within each candidate. Retrieve at most
   three examples per candidate, for at most three existing policy candidates.
4. Search inside PostgreSQL; do not transfer the entire vector corpus to Node.
   Do not build or write the inventory cache on a classification request.
5. Supply bounded JSON-quoted snippets only to the existing trusted-local Ollama
   provider boundary. Remote providers get counts/status only. Treat snippets as
   untrusted observations, not instructions or confirmed routing labels.
6. Prefer complete description evidence over the historical semantic retriever;
   retain that retriever when description evidence is unavailable or incomplete.
   Failure must not broaden candidates, block classification indefinitely, or
   change automatic routing authority.

## Security, efficiency and accessibility

Use parameterized SQL, existing source-conflict exclusions, explicit corpus caps,
statement/lock timeouts, a request deadline, and model/config rechecks. No network
calls while holding the inventory snapshot. No raw snippets in persisted result
projections, logs, or new API/UI payloads. Cached vectors remain private derived
data. Delimiting untrusted text reduces confusion but is not an injection-proof
boundary; the existing candidate validation and routing authorization remain
essential. Missing examples are missing evidence, not proof against a library.
Shared descriptions across libraries are not independent votes.

No new UI interaction or live region is needed. Existing compact recommendations
remain the user-facing result; technical retrieval detail belongs in diagnostics.
This avoids another acknowledgement or a noisy automatically updating panel.

## Official research

Requested baseline: August 2026. Sources were discovered through search tools and
read on September 11, 2026. These are living documents, not verified August
snapshots; no later feature is required by this design.

- [Ollama embeddings](https://docs.ollama.com/capabilities/embeddings): use the same
  embedding model for indexing and queries and cosine similarity for comparison.
  This implementation additionally pins digest, dimensions and projection.
- [OWASP RAG security cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  bounded retrieval, access boundaries, integrity, and untrusted-context handling.
- [OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/):
  RAG does not eliminate prompt injection; deterministic output boundaries remain.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  accessible status semantics when messages are shown, without unnecessarily
  chatty updates or a requirement to introduce new messages.

## Validation and follow-up

Test query/self exclusion, conflicting descriptions, representation/expiry
boundaries, per-candidate coverage, duplicate text, partial cache, failure,
cancellation, remote redaction, and prompt assembly. Exercise real PostgreSQL
ranking and the rebuilt local Compose retrieval path without routing media.
Record actual results in the separate outcome document.

Next: evaluate the description-backed candidate decisions against reviewed
outcomes, then enable automatic routing only for a demonstrably reliable cohort.
This component improves what AI can compare; it is not itself a calibration study.
