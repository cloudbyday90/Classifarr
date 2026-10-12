# System Information simplification: design

Date: 2026-10-12. The operator requested system facts without internal startup
provenance explanations. This is a presentation change, not weaker health checks.

Keep application/runtime versions, uptime, platform, architecture and memory.
Replace the verbose pgvector section with compact version, build, selected
optimization and CPU-support values. Remove process references, timestamps and
explanatory paragraphs from this card. Preserve one short warning for an explicit
CPU mismatch; missing or stale evidence shows Unknown, never a healthy inference.

The authenticated API and stored diagnostics remain intact for troubleshooting.
Database/RAG health and service counts remain separate and unchanged. No new
requests, storage, dependencies or migrations are needed.

Recommendation: concise name/value pairs using semantic description lists. This
makes the page scannable; the tradeoff is that detailed provenance requires the
existing API/logs rather than appearing inline. A collapsed diagnostic block was
considered but rejected here because the user explicitly asked for system facts.

Research discovered through MCP and opened on 2026-10-12:
[MDN description lists](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dl)
documents metadata name/value pairs as an appropriate use of `dl`, `dt` and `dd`.

Verify current, stale, malformed and missing evidence, text-safe rendering,
unchanged service-health totals, and mobile/desktop layout. Next: review other
operator-facing diagnostics for the same distinction between a useful status and
internal implementation details, without hiding actionable failures.
