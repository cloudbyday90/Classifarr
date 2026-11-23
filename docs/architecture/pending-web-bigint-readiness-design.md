# Exact History IDs in web pending-answer transport

November 23, 2026 Eastern. Follow-up to the
[learning receipt identity change](learning-answer-receipt-identity-outcome.md).

## Contract and scope

Confirm All sends a sequential series of single-answer requests. The same
client API function assembles the URL for both single and bulk answers.
Validate the complete History ID before building that path, retaining exact
decimal text for larger values. When the card contract carries a candidate
History ID, require it to match the displayed row by canonical identity.
Historical contract projections without a candidate ID keep their existing
handling. The shared outcome writer validates the exact ID before SQL and
passes the original valid scalar to the parameterized lookup and write.

The existing safe-ID admission boundary remains in force across pending
answer web, bulk and Discord paths. Keep the existing fingerprint, request
body, database locks, completed receipt check, routing, learning, and
response shapes. Confirm All still completes one request at a time. A later
failure can leave earlier writes committed, and completed replay retains the
existing receipt semantics without routing again. The admin cleanup action
has its own batch semantics and needs a separate exact sorting review.

## Official guidance and tradeoffs

Keep canonical identifiers distinct in path segments and use JSON strings
for precision beyond binary64. W3C Web Architecture supports consistent
resource identity. The Classifarr path parameter and the candidate reference
identify the same History row.
[RFC 8785, section 3.1](https://www.rfc-editor.org/rfc/rfc8785.html#section-3.1),
[W3C Web Architecture, Identification](https://www.w3.org/TR/webarch/#identification)

Retain explicit receipt replay semantics for writes and avoid introducing
automatic retries of an uncertain POST.
[RFC 9110, section 9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

The recommended stack is the existing canonical ID helpers, exact card
matching, and the existing transactional writer and row-bound replay. It
improves target integrity while preserving existing safe responses. Two
representations still require coordinated transport tests. Enabling larger
answers now would also require a deliberate web-only admission and projection
change across the shared resolver boundary.

## Verification

Prove exact single and sequential Confirm All transport, invalid and
mismatched ID refusal, and partial completion. Exercise the stored outcome
writer against adjacent BIGINT rows in isolated PostgreSQL, including unsafe
numeric input. Verify the existing HTTP admission cap and completed replay
with one route call and no duplicate exact-item learning. Use fresh backend
and client coverage and normal quality gates.
