# Initial verification advice provenance outcome

November 11, 2026 Eastern. Baseline main
`b039b2b4a45ef3ccbc297fc2fd9b8c98d55a3408`. The operator confirmed the
consumer in Q1 and complete contract in Q2 before runtime implementation.
The [investigation](verification-advice-provenance-investigation.md) records
official research and alternatives; the separate
[design](verification-advice-provenance-design.md) records the agreed contract.

## Implemented behavior

The initial policy owner's verification call now explicitly selects a dedicated
advice session, including when live proof is missing. The session composes the
existing private live selection witness with its own closed projection; no
public object shape or diagnostic payload becomes provenance.

For that call, the optional policy section contains only the held display label
and original overall confidence. Raw breakdown, diagnostics, related text and
an explicit policy-section override cannot bypass it. The separately selected
verification target and instructions still appear: this batch does not require
private provenance for verification admission or claim the entire prompt is
qualified.

The existing profile lookup runs only for a proven selection and is associated
with its exact requested library. Its accepted result is projected into immutable
existing display prefixes and coverage, with strict fields/labels and the agreed
encoded data cap. Invalid profiles omit only that attachment. Inventory placement
remains observational evidence, not a label, declared purpose or exclusion rule.

The session rechecks selection after awaited work and builds optional sections
after the provider-lock wait at each existing generation attempt. Mutation during
assembly causes one omission rebuild. Observed invalidation is permanent for
that session; restoring fields cannot refill its gap. Assembly rejection is
kept outside transport retry/refusal/capability handling, while the existing lock
is released. The regression first demonstrated the unwanted capability-handling
path before the final fix.

Small `policyVerificationAdvice` and `policyVerificationAdviceProjection` leaves
hold this behavior. The shared signal builder/formatter, original parsing
context, verification admission, scoring and route/learning authority remain
unchanged. Adjudication, its purpose sidecar/fallback, RAG rechecks, legacy/generic
and direct unscoped callers, and private replay retain their existing contracts.

## Verification

Qualified local checks:

- Eight focused suites: 268 tests passed, including actual evaluator fixtures,
  production-owner loopback Ollama/OpenAI-compatible HTTP, genuine/copied proof,
  provider/config/admission/profile/formatter/lock mutations, bounded stream
  retry, unsupported-provider early refusal and strict response validation.
- Three production-factory PostgreSQL suites: 21 tests passed, including actual
  native/compatibility loading, one later library-specific profile observation,
  missing-proof zero extra reads, changed selection and existing pending
  resolution/stale/current-destination/exact-replay controls.
- Fresh backend coverage: 1,943 suites passed; 63,230 tests passed, one skipped.
  Statements/lines 89.32%, branches 86.79%, functions 90.86%. The coverage ratchet
  passed with the qualified client report; all 7,439 frozen non-document inputs
  remained unchanged through verification.
- Eleven browser checks passed: three existing pending-review cases and eight
  production-asset cases, including a fresh client production build.
- Type checks, backend/client lint, both backend dependency analyses, ownership,
  production naming/language/removal/maintenance, ESM import/mock-shape and
  copyright gates passed. Final-source backend lint/type and ownership checks
  also passed; the console-spy check and staged secret scan passed.

The initial PostgreSQL fixture incorrectly supplied JSONB for a `text[]` column;
correcting the owned fixture produced the qualified pass. The first remote
fixture used the published fixed endpoint rather than its intended local
resolver; the final fixture explicitly redirects only its endpoint resolver to
loopback while preserving actual authority, schema, HTTP body and transport.
No authenticated or paid provider was used. The interrupted initial backend
coverage run is unqualified and retained separately from the final run.

Client reuse checks show all 1,160 recorded inputs unchanged, an identical full
installed graph and the same qualified coverage hash
`f505af45709e9e34ed021f7209a43304e445a05b9e07f63cfd91df9d4804579d`.
That report retains 7,569 passing tests in 488 files. No package, lock, toolchain, client source or
scanner policy changed. Fresh full audits show zero root/client findings and
the same five low server tooling findings. Existing rejected-CVE triage still
expires November 16 UTC; neither it nor the separate runtime security limitations
was extended or remediated by this batch.

## PR, maintenance and delivery

The only open PR is 589; its unchanged, previously failing compiler artifact
remains [deferred](client-compiler-pr-589-outcome.md). Delivery recheck still
shows head `c6137f1467319a048e2d6babfe27dc6bb9859ffa`, mergeable with unstable
checks. No new applicable subset or genuinely stale/conflicted branch was
established. No PR was merged or rebased.

Artifact inspection preserves recent/current evidence, toolchains, worktrees,
recovery assets, all other services/projects, volumes and shared build cache.
External restarts and unrelated stopped containers observed at intake predate
this task's Docker activity; they are not cleanup outcomes. No stale artifact
was newly verified for deletion and no image was built for this scoped change.
Final comparison confirms all seven preexisting container identities, images,
start times and health/status values unchanged. No files/images were removed;
about 1.05 TB of host space remained free. Global space movement is not attributed
to this no-op cleanup. Private receipts remain under
`.tmp/verification-advice-assessment`.

The authorized commit/push follows these local checks. Hosted workflow receipts
are checked separately against the exact pushed revision; local results do not
qualify a different commit, image, release or deployment.

## Limits and next recommendation

This proves loaded selection/profile association at the application generation
boundary, not current database configuration, profile accuracy or correct
classification. It adds no freshness query or bound on the existing inventory
query. Projection rejects hostile data descriptors after the trusted lookup
resolves; it does not replace native Promise/thenable assimilation or bound
the entire prompt, provider lock or transport.

Assess RAG recheck verification next. That path reevaluates expanded metadata
but can spread earlier breakdown/diagnostics while replacing the destination
and confidence. Give the second pass coherent same-evaluation context before
qualifying its optional advice; do not silently expand this initial-call adapter.

Routine work remains automatic through existing application paths. This batch
adds no page, endpoint, schema, setting, job, operator CLI trigger, provider call,
live configuration write, historical backfill, release or deployment.
