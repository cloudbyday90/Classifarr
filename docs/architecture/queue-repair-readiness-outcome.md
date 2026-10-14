# Reviewed-repair readiness outcome

Date: 13 October 2026 (Eastern). No release, version bump or live repair approval.

## Delivered behavior

The explicitly loaded reviewed-repair list now explains why each item is ready
or blocked. Reasons cover changed settings or requests, conflicting/invalid IDs,
unsupported request formats, unavailable retry budgets, ineligible task state and
prior work. The page records when the snapshot was taken. It does not claim TMDb
availability or successful classification.

A small shared ESM eligibility module serves both the readiness reader and the
locked retry writer. A separate read model uses PostgreSQL read-only repeatable-read
transactions, up to 20 items, sequential checks, existing timeouts and one active
read per service instance. Unknown failures abort the read instead of returning
ready items. The HTTP route propagates client disconnection, returns no-store
responses and retains ordinary admin-session restrictions and rate limits.

Fixed client copy describes blockers, associated checkbox descriptions expose
the reasons to assistive technology, and loaded counts use a status region. Missing,
unknown or inconsistent readiness cannot be selected. Reload clears selection and
consent. Every explicit retry still revalidates under the original write locks;
readiness is never a reservation or authorization token.

No schema, scheduler, automatic enrollment, source-library mutation, memory-safeguard
change or budget reset. Existing consumed receipts, individual retries and generic
Retry All retain their prior behavior. No actual task was approved or retried.

## Verification

- Focused backend unit/real HTTP: 93 tests across five suites passed, including
  cookie CSRF, access-token scope, shared limits, safe response projection and
  actual HTTP disconnect cancellation.
- Full frontend: all 473 suites and 7,325 tests passed with exit zero, including
  the final API projection assertion. Coverage: statements 87.72%, branches
  81.69%, functions 87.44%, lines 89.42%.
- Isolated PostgreSQL: 140 tests across six suites passed. New cases cover all
  common blocker reasons, read/write gate agreement, unchanged task rows, no
  provider requests, consistent snapshots during a separate committed write,
  stale-ready refusal, database-enforced write prohibition, cancellation without
  partial results, lock timeouts and revoked administrators.
- Type checks, final lint, preflight, ESM import/mock shape, migration/schema
  integrity and Markdown checks passed. One Vue formatting warning and a test-only
  Promise executor lint error were corrected; focused tests and final lint passed
  again. Markdown covered 2,194 files without errors.
  The ownership gate passed without baseline changes but retains its existing
  unresolved writer-isolation debt (`productionCompatible: false`).

Full backend coverage passed all 1,833 suites: 57,968 tests passed and the existing
Linux directory-fsync test was skipped on Windows. Coverage: statements/lines
89.71%, branches 86.33%, functions 91.08%. Runtime code remained unchanged during
full coverage; the test-only Promise formatting correction was separately rerun
with all 93 focused backend tests. The combined coverage ratchet passed with fresh
backend JSON and frontend HTML reports. No baseline changed.

## Packaged image and local evaluation

No-cache Compose build succeeded from clean source
`e8028f7af1522b45accd2d7e3e8cd9cd39b01928`:

- Image/index: `sha256:b9dca60fc922a77900fe349c4ba2ec7017760f9ee13601d9e8826a4cd9fd263b`.
- Platform manifest: `sha256:57306587485a667a0f963a0c9c955240b339707636ccca4e82a238a63840d011`.
- Config: `sha256:2e65f1bb0d953103e15c30e227db4989940c76c991e3f16d351d61d6106d5f6c`.

An isolated fresh container used that exact image with no external network or
published ports, bounded CPU/memory/PIDs, and unchanged entrypoint, authentication,
migrations and scheduler. Schema matched. Packaged checks verified ready and
changed-settings results without task writes or provider HTTP, preserved nested
identity aliases and a large unrelated integer, and retained repair/retry receipts
across two same-image restarts. Replaying a saved retry left the whole task row
unchanged and remained safe after synthetic task deletion. The task was still
pending at one attempt; this is not evidence of successful classification/routing.

The owned container `classifarr-schema-check-998cdd11-9639-4d49-8a64-0331a1488330`
and its matching temporary data directory were removed and absence verified. This
is same-image restart evidence, not a published-version upgrade or a crash during
commit. PostgreSQL tests separately exercised transaction interruption.

Before local replacement, a custom-format backup was made and its 1,928-line
archive listing checked: `queue-readiness-before-20261013-2116.dump`, 76,260,444
bytes, SHA-256
`cc839f777aff5738f32473f75d71a486f44bc41b3b7b034728e8aa372f0c39cb`.
It was not restored. The prior image
`sha256:9af929e5ecfdad6127b201b7d377149ea5630640d23d7e69a14ef60503690b4e`
remains tagged for rollback.

The local container started at 01:20:56 UTC on 14 October (21:20 Eastern on
13 October) using the tested image and became healthy. `/health` reported the
database connected, UI returned HTTP 200 and unauthenticated readiness returned
HTTP 401. Read-only queries found 1,955 completed tasks, no failed tasks, zero
repair receipts and no error-log rows since startup, using the database timezone
conversion. No real backfill ran. UID/GID 1000, read-only root filesystem,
no-new-privileges and the 2 GiB memory limit were retained. OOM was false, restart
count zero; a startup sample was 311.8 MiB. This is not a memory-retention study.
Unraid, Plex, shared Ollama and the unrelated local container were not modified.

## Recommendation and scope

The [design](queue-repair-readiness-design.md) records verified official sources,
alternatives, pros/cons and the final recommendation stack. The benefit is an
explanation before submission; the cost is bounded extra local queries and a
snapshot that can become stale. Final write checks remain authoritative.

GitHub MCP enumeration and final recheck found zero open Classifarr PRs. None could be randomly
selected or implemented; no closed PR was substituted and none was merged. All
seven workflows on preceding main commit `7d8bd280e` passed.

Next: design explicit unattended retry enrollment per repair receipt, including
durable consent/revocation, cooldowns and remaining-attempt checks. Do not enroll
existing approvals automatically. Investigate any new failures before expanding
recovery scope; current local/Unraid data is not assumed eligible.
