# Exact History IDs in web pending-answer transport outcome

November 23, 2026 Eastern. See the
[design](pending-web-bigint-readiness-design.md) for guidance and tradeoffs.

## Implementation

Single answers and Confirm All use the existing classification API function.
It validates the History ID before constructing the path and preserves the
exact decimal digits through PostgreSQL's positive BIGINT maximum. The
shared client contract reader checks a supplied candidate History ID against
the displayed row. Historical projections without that field still work.

The shared outcome writer uses the canonical database ID validator before
issuing SQL. It passes the original admitted scalar into the existing
parameterized operations. The ownership review changed only that source
digest. Its analysis digest, existing indirect-query gap and classification
were unchanged.

The server's safe-integer cap still governs pending answers, including bulk
and Discord. Confirm All stops at the first failed request and preserves
earlier completed writes. Cleanup retains its own selector boundary.

## Verification

- Astra traced the single and bulk entry points and confirmed that the
  latter sends the same per-item request. Client tests verify exact adjacent
  IDs, the BIGINT maximum, invalid selectors, mismatched row binding, partial
  completion and no request when the supplied binding belongs to another row.
- All 31 scoped PostgreSQL tests passed. The writer updated only the exact
  large row and refused an unsafe numeric selector. HTTP admission kept the
  safe-integer cap. A completed replay kept the same learning receipt and
  issued one total route call. A foreign receipt binding produced no replay.
- All 11 Chromium pending-review tests passed, including single and bulk
  confirmation, explicit choices and keyboard controls. The 42 ownership
  tests and the full preflight passed after the digest review.
- Fresh client coverage passed all 7,613 tests across 490 suites. The
  production client build, lint, and type checks passed.
- Fresh backend coverage passed 64,304 tests across 1,957 suites, with one
  test skipped. The coverage ratchet and the ESM, policy, tooling and
  Markdown gates passed.

## Next recommended item

Qualify a web-only BIGINT admission path through the route and shared
resolver. Verify the response, historical safe-ID receipts, exact replay and
learning in the same batch. Review Discord component IDs and cleanup sorting
as separate boundaries.
