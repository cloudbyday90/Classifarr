# Retry target admission outcome

November 15, 2026 (America/New_York). Implements the confirmed
[design](retry-target-admission-design.md) from main
`c6ed9348d1e04a78afc17a5aeafe68ef0e41a7d3`. No release, deployment, production
cleanup or live configuration change is included.

## Result and compatibility

One pure leaf reuses canonical primitive validation and applies the existing
retry INTEGER range, 1 through 2147483647. The public route, batch normalizer,
direct retry and historic-refresh selection use it before target-specific work.
The historic check precedes receipt creation; a later common-service refusal
cannot leave a new requested receipt for these invalid selections.

Only positive integer Number primitives and canonical ASCII decimal strings in
that range are admitted. Alternate string spellings, containers, fractional,
unsafe and out-of-range values are refused without scalar coercion hooks. Numeric
JSON `1e2` is already Number 100 and remains valid; string `"1e2"` is invalid.
Upstream client conversion can still lose that distinction and is outside this
batch. The client API leaf forwards values unchanged and documents the contract.

Whole-batch validation preserves the raw 100-entry bound, input order and numeric
deduplication. Historic selection retains its 50-entry bound, duplicate rejection
and actor rules. Dense iteration rejects sparse holes before receipt work.
Admitted direct targets retain their raw number/string type in bindings, results
and freshly captured lineage. Invalid direct targets return the existing
retry_failed envelope before lookup/transaction/callback; admitted absent IDs
still return not_found. Fixed range-aware messages retain existing HTTP error
statuses and envelopes.

Valid execution keeps locks, eligibility/readiness, duplicate-task protection,
cleanup SQL, budgets, receipts, task construction and postcommit follow-up. A lost
COMMIT reply can still leave committed state and a failure result. No uncertain
attempt is replayed. The no-retry-write boundary does not include upstream
authentication, diagnostic logging or provider-probe coordination.

No UI, transport, dependency, schema, endpoint, job, operator CLI trigger,
provider call, scoring, routing or learning authority changed. No historical
record was rewritten. Optional developer test commands are not operator workflows.

## Verification

The baseline passed 59 existing unit tests and 14 private isolated diagnostics.
Those diagnostics reproduced wrong-row queueing through the real HTTP router and
production database factory: string exponent, oversized numeric exponent and
nested-array requests queued row 1 while row 100 remained unchanged. Four new
focused regressions failed against the old implementation before the fix.

The new production-factory PostgreSQL suite passes 39 tests. Together with retry
notification matching, retry execution, historic receipt reconciliation, automatic
recovery, provider deferral and notification lifecycle suites, seven suites pass
233 tests. They cover wrong-row/no-write refusal, INTEGER boundaries, raw direct
types, valid historic receipts, authorization, sparse selections, concurrency,
rollback, delayed/lost COMMIT acknowledgement and existing no-replay controls.
HTTP tests inject a synthetic authenticated principal; they do not exercise
credential issuance or login. Databases and rows are disposable owned fixtures.

The pure parser/command controls cover hostile coercion hooks, revoked proxies,
grammar, range, batch order/count/deduplication and pretransaction refusal. Client
API tests cover raw scalar forwarding and unchanged error propagation without
helper replay. Fresh client coverage passes 488 files / 7,587 tests, with
87.93% statements, 82.17% branches, 87.71% functions and 89.61% lines. All 105
Chromium browser cases pass; the fresh production build and eight production
policy browser cases also pass. Assertions, retries, deadlines and skips were
not relaxed.

Fresh backend coverage passes 1,955 suites / 64,058 tests with one existing skip:
89.36% statements, 86.86% branches, 90.91% functions and 89.36% lines. Both
coverage reports were regenerated for this batch and the unchanged coverage
ratchet passes. The final non-Markdown source manifest matches the tested
snapshot; no earlier task's coverage is substituted.

All fourteen normal quality gates pass: typechecking, backend/client lint,
dependency analysis, ownership, npm flags, policy naming/language/maintenance,
static imports, mock shapes and copyright. Markdown lint checks 2,563 files
without errors.

Astra independently reviewed the agreed boundary and implementation. It found a
sparse-array traversal gap and then a table-driven test argument mistake; both
were corrected before final validation. No review blockers remain. The current
ownership gate passes and the changed admission sources introduce no reported
protected-write candidate or analysis gap. Its manifest, parser, baseline,
classifications, unresolved debt and 100-review cap remain unchanged.

Root/client audits have zero findings. The server retains five known LOW findings
in the Jest/deepmerge chain. No scanner exception, severity, expiry, dependency or
installation policy changed.

## Research, alternatives and final recommendation

The [design's official research](retry-target-admission-design.md#official-research-and-independent-review)
was discovered and opened through MCP on November 15, 2026. ECMAScript's prefix
parsing and safe-integer rules, PostgreSQL's INTEGER range and OWASP's early typed
validation support one exact server contract before target-specific side effects.
W3C representation guidance supports documenting decoded numbers separately from
canonical string IDs; this is not a UI or conformance claim.

| Approach | Benefit | Cost or limitation |
| --- | --- | --- |
| Public route guard only | Smallest surface | Internal/direct calls and historic receipt ordering remain inconsistent |
| Shared bounded parser at all four boundaries | Repairs established wrong-row and pre-write gaps | Rejects former alternate spellings and changes earlier refusal timing |
| Widen to BIGINT now | Broader target support | Cleanup, lineage and downstream contracts remain unready |
| UUID migration now | Different representation for new identities | Broad migration; does not repair current parsing and ownership |

Recommended stack: canonical primitive parsing, existing INTEGER bounds, complete
pre-write admission, preserved execution/replay authority, then fresh exact
lineage before range expansion or UUID assessment.

## Delivery and maintenance

No PR was open at intake or the delivery recheck. No closed PR was reused, PR
merged or fresh/unrelated Dependabot branch rebased. Design/outcome documents and
Unreleased notes accompany delivery on main; exact-source CI is inspected after
push. This change creates no release or deployment.

Maintenance used a fresh metadata inventory without following reparse points;
protected asset trees remained unexpanded. Current evidence, toolchains, recovery
assets and four worktrees were preserved. Three older logs remain excluded
because ownership is not established. No files, images, containers, volumes or
shared caches were removed by this batch, and no reclaimed-capacity claim is made.

On the pinned daemon, all 39 original containers retained their exact identity,
image, start time, state and observed health. Shared Docker activity added three
stopped containers; image/tag entries changed from 493 to 478, with fifteen
previous entries absent. These observations were reconciled privately and are
not attributed to this task. Shared resources remain outside cleanup authority.

## Next item

Investigate fresh retry lineage ownership and explicit absence. A null capture
can currently leave an inherited metadata.retry_lineage object that payload
construction forwards. Later rebinding still uses permissive parsing and separate
writes. Exact target admission does not establish those references' ownership.

Settle absent references versus capture failure, original classification
provenance versus reassignment authority, and atomic completion before changing
runtime behavior. In particular, decide whether a reference-free fresh lineage
must retain original classification provenance or explicitly omit lineage. Keep
historical queued payloads, wider BIGINT support and UUID migration separate.
