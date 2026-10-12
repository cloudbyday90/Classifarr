# Pgvector compatibility and health: design

Date: 2026-10-12. Follow-up to the [startup report](pgvector-startup-report-design.md).

## Finding and scope

System fabricated a pgvector service-health result from saved variant and CPU
flags. An optimized variant with unknown CPU support, or any other nonempty
variant (including `unknown`), could count as healthy. Neither check queried the
database. Two independent API responses could insert this synthetic service into
the totals. This is a presentation error, not evidence of a database failure.

Keep Database connectivity and RAG readiness as the existing operational checks.
RAG inspects the vector type, embeddings table, required indexes and prewarm
extension. Its catalog checks do not prove a particular native binary loaded,
provider availability, completed backfill, or successful end-to-end retrieval.

## Options and decision

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Rename the existing health badge | Small edit | Still counts compatibility as an operational service |
| Separate startup compatibility from health (chosen) | Accurate scope, no extra database or provider work | Operators consult Database/RAG separately |
| Add a native vector execution probe | Can test a specific operation | Introduces load and unsafe-native-code failure risks; needs a separate design |

Recommendation stack:

1. Remove the synthetic pgvector health card from initialization and both API
   response paths. Do not change backend health checks or aggregate rules here.
2. Extract the startup panel and a pure ESM presenter. Only a current embedded
   version-1 report can support a compatibility comparison. Explicit CPU support
   permits an optimized match; explicit lack of support shows a mismatch; missing,
   old, unverified or unsupported evidence stays unknown. Generic selection is
   described neutrally, never as database health.
3. Preserve fixed advice, application-run reference, scope and UTC timestamps.
   Allowlist displayed variant/CPU values. Use text labels, not color alone.
4. Keep the existing API contracts, privileges, memory limits, noexec checks,
   staging policy, recovery behavior and provider configuration unchanged.

No migration/backfill is needed: existing status data is sufficient. Legacy and
external-database reports remain visible without being promoted to current CPU
evidence. This panel is the status observation loaded with the page; it is not a
continuous binary monitor. Health polling remains independent.

## Official research

Sources discovered and read through MCP on 2026-10-12:

- [PostgreSQL 18 system information functions](https://www.postgresql.org/docs/18/functions-info.html)
  define `to_regtype` as a catalog name-to-OID lookup with null for absent types.
  Our conclusion: catalog presence must not be presented as binary attestation.
- [Kubernetes probe guidance](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
  distinguishes startup, liveness and readiness. We apply that separation of
  meanings to the UI; no Kubernetes deployment change is proposed.
- [W3C WCAG use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
  supports visible textual distinctions instead of color-only status cues.

## Verification and boundaries

Test known, unknown, stale, external, mismatched and malformed observations;
both API response orders; database failure, RAG disabled/unavailable/degraded;
and unchanged service totals regardless of startup compatibility. Browser fixtures
cover the real extracted component at mobile width, safe labels and zero API
requests. Run client coverage, lint/typechecks, focused existing backend contracts,
and a no-cache local image rebuild followed by schema dump and read-only checks.
Record observed results in a separate outcome document.

GitHub MCP initially returned zero open PRs; no random candidate was available.
Work stays on main. No release, version bump, production deployment, provider
mutation or identity approval. Separately investigate aggregate health's existing
unknown/stale-service semantics next; do not fold that cross-cutting change into
this compatibility fix.
