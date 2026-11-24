# Source-pair worker profile budget reporting

November 24, 2026. The automatic source-pair worker loses a genuine
learned-profile feature overflow when it returns its generic failure message.
An offline fixture built with the normal corpus and metadata projections used
4,500 unique descriptions and 32 distinct genre terms per description. It fit
under the parent snapshot, vector and envelope limits. Direct evaluation
raised `inventory_profile_feature_budget`, while the real worker reduced it
to `automatic_source_pair_worker_unavailable`. This verifies a diagnostic
defect without attributing a historical alert to that limit.

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep the generic message | Smallest worker protocol | Operators lose a measured failure condition |
| Forward the raw worker error | More debugging detail | Could disclose private input or error properties |
| Send one fixed failure code | Preserves the verified reason without raw details | Adds one validated worker message shape |

## Recommendation

1. Mark the error at the actual 250,000-feature fitting guard. Preserve the
   message for existing callers. The automatic worker may emit a one-field
   failure record for that exact private mark after it completes input
   receipt and checks the offline database guard.
2. Accept that record only on the automatic path after vector transfer.
   Validate the entire shape and recreate the private budget mark in the
   parent. Other worker errors remain generic. Preserve the capture-plan
   and quality-study paths, cancellation, deadline, and termination checks.
3. Verify the real worker and PostgreSQL scheduler path, including an
   in-budget result and rejected malformed, mixed, early and late replies.
   Keep resource limits, publication rules, cooldown and stored status
   formats. Test the requested clean-source no-cache local Compose rebuild.

Node uses structured cloning for worker messages. A fixed record avoids
depending on error prototypes or private properties surviving transport.
OpenTelemetry's predictable error attributes and W3C's provenance guidance
support carrying the smallest useful fact from the component that observed
it. Sources were verified using MCP.
[Node.js worker threads](https://nodejs.org/download/release/v24.22.2/docs/api/worker_threads.html)
[OpenTelemetry error attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/error/)
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)

Use the existing local Compose files and clean source revision. Retain the
previous image and a checked PostgreSQL archive before replacing the local
container. Verify the candidate's fresh schema, running image, HTTP health,
mounted data and startup diagnostics. The rebuild does not publish an image.
[Docker Compose build](https://docs.docker.com/reference/cli/docker/compose/build/)
[Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up)
[PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
