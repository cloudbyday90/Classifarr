# Background-prepared context for ambiguous destination comparison

## Decision and scope

September 19, 2026. Consume the previous multi-scale retrieval component in the
existing local candidate-comparison evidence path. Preserve the three ordinary
nearest-description examples and append at most three distinct representative
examples per candidate. No new setting, acknowledgement, score, routing grant,
API or UI panel. Existing policy eligibility and response validation still apply.

The previous commit measured retrieval coverage, not semantic accuracy. This
change must not describe extra correlated examples as independent confirmation.
It changes advisory local comparison input, not automatic-routing thresholds.

## Architecture and recovery

- A scheduler-owned ESM service builds one complete inventory profile outside
  classification requests. It reuses the existing read-only repository, bounded
  worker fit and optional content-community discovery.
- Validate source, model identity, configuration and refresh revision before
  publication. Reuse an unchanged profile; coalesce overlapping refreshes. Bound
  fitting to six minutes, cached weight to 256 MiB and serving age to ten minutes.
- Check every minute; reconcile every five minutes. Failed attempts use capped,
  jittered exponential backoff. No provider generation, model download, database
  write or user action is required to warm or recover this cache.
- Serve only against freshly read same-media corpus membership, matching model
  and configuration, and unchanged refresh revision. Recheck after asynchronous
  retrieval. Expired, changed or failed context falls back to existing evidence.
  Optional retrieval has its own 500 ms deadline inside the existing request
  budget. Redacted retry/recovery logs are deduplicated by health transition.
- Full-inventory fitting is permitted only for genuinely unseen identities and
  descriptions. Known identities (including conflicted/descriptionless source
  identities) and hashes use today's self-excluding raw path, without refitting
  on the request. Offline holdout requirements remain strict and separate.
- Retain no plaintext in the model cache. Hydrate selected hashes from the fresh
  query corpus, and only for policy-eligible candidates. Keep shared descriptions
  out of exclusive representative evidence. Deduplicate against raw examples.
- Local providers alone receive bounded text; remote-provider projection strips
  it. Treat every example as untrusted data, not an instruction or policy vote.

This is bounded stale-while-revalidate behavior: unchanged, still-valid context
can serve during refresh, but changed membership/configuration/revision cannot.
It is not permission to serve arbitrarily stale evidence. Vector contents are
revalidated on background reconciliation; per-request checks do not reload all
vectors. This trade-off is limited to advisory examples and the ten-minute TTL.

## Official research and alternatives

Sources were discovered with search and opened, not constructed from guessed
paths. Consulted September 19, 2026; sources are living documentation.

- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports bounded retrieved context, explicit untrusted-data boundaries,
  cache invalidation and downstream validation. Delimiters alone cannot eliminate
  prompt injection; candidate allowlists and existing routing checks remain key.
- [AWS backoff and jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
  supports bounded retries with jitter to avoid synchronized retry traffic.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires accessible identification when status messages are displayed, not
  more messages. No UI announcement or panel is needed for routine refreshes.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Fit on every comparison | Query-specific holdout | Expensive latency/load; reject |
| Background context with unseen-item admission | Reusable, automatic, no self-placement leakage | Known items retain raw fallback; recommend |
| Add representatives to raw evidence | Wider context without losing nearest examples | More prompt text; cap and deduplicate |
| Replace raw evidence or add confidence bonuses | Simpler-looking selection | Unproven and correlated evidence; reject |

Recommended stack: validated inventory → automatically refreshed vectors →
background content-only profiles → fresh-scope bounded local comparison context
→ existing policy/response/routing safeguards. No new dependency or schema.

## Validation plan

Test cold/warm behavior, source and model drift, known identities and duplicated
descriptions, movie/TV separation, cancellation, coalescing, timeout/backoff,
shutdown, memory expiry, malformed results, remote redaction, prompt bounds and
unchanged raw fallback. Exercise the actual services against local Compose with
read-only database access; never route test items or claim placement agreement is
ground-truth accuracy. Record outcomes separately after verification.
