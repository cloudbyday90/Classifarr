# Purpose authority consistency outcome

Date: 2026-10-27. The [design](purpose-authority-consistency-design.md) records
the problem, official research, alternatives, safeguards and recommendation
stack. Implementation and local verification are complete. No release or
production deployment is included.

## Implemented behavior

- `policyDeclaredPurposeProvenance.mjs` owns both the existing per-rule
  classification and the fixed aggregate builder/validator. The purpose-change
  read retains its existing interface as a small delegating wrapper.
- `policySpecializedDestinationIdentityEvidence.mjs` uses the canonical
  declaration classifier before considering content-bearing required terms.
  Unverified template and profile-derived rules retain their existing scoring
  and scope roles but cannot supply specialized declared-purpose proof.
- `policyIntentAuthorityContract.mjs` adds `purpose_provenance` to its v1
  projection, preserving native storage authority separately. Only a nonempty,
  fully declared native purpose marks its declaration section declared. Mixed
  purpose retains its declared subset and a declaration requirement. Observed
  and unverified hints are excluded from the declared helpful-match section.
- The aggregate contains only `id`, `declarationRequired` and
  `rawRuleProvenanceExposed: false`. Contract validation rejects inconsistent
  claims, malformed aggregates and raw per-rule provenance in the declared
  projection. No client runtime consumer interprets this generic field; no
  extra client authority parser or new HTTP endpoint was introduced.

Existing native headers, database relationships, writers, thresholds, base
candidate restrictions, observational ranking, zero-score comparison, hard
limits, exact-item memory and routing receipts are preserved. The native header's
`inferred` value continues to describe the storage contract; it is not used as
proof that an operator did or did not declare a rule.

## Offline audit replay

Replaying the captured read-only database snapshot through the actual local
attachment, mapper, runtime evidence and calibration modules produced:

| Measure | Before | After |
| --- | --- | --- |
| Native storage-authoritative policies | 9 | 9 |
| Generic API purposes reported declared | 9 | 0 |
| Native purposes classified profile-derived | 7 | 7 |
| Native purposes classified unverified | 2 | 2 |

All nine resulting authority contracts validate. The remaining policy continues
to use its compatibility fallback. No stored rules were rewritten or promoted.

Using recorded raw scores and the existing candidate pool, the two retained
scripted-TV examples now rank the general destination above the inferred-template
comedy destination. One has an independently retained operator selection for
that general destination. The documentary and seasonal-movie error controls
remain unchanged; the agreement control also remains unchanged.

This replay makes no model call and does not repeat policy evaluation, learned
routing qualification or routing. It is directional evidence for this exact
classification seam, not a representative accuracy benchmark. Private titles,
snapshots and replay artifacts remain in ignored `.tmp/`.

## Verification

- Focused pinned-runtime regression: nine suites, 147 tests passed, including
  canonical provenance, mixed/unknown sources, source-preserving mapper reads,
  real route projections, Anime scope, calibration/ranking and TLS compatibility.
- Real disposable PostgreSQL integration: six suites, 60 tests passed, covering
  policy evaluation, active-intent integrity, purpose changes, shortlist replay,
  route-outcome acceptance and consensus review recovery.
- Backend TypeScript checking, full test/source ESLint, static-import checking
  and ESM mock-shape checking passed. Dependency/install-policy tooling passed
  all 59 tests. Repository Markdown lint reported zero errors across 2,364 files
  before the final outcome update; final document validation is repeated below.
- Independent static reviews of runtime and API changes found no substantive
  issue. These reviews do not constitute a repository-wide security scan.
- Full backend unit coverage: 1,880 suites passed; 60,444 tests passed and one
  existing test remained skipped. The run took 1,149.921 seconds on the local
  host; this is test-suite duration, not an application performance benchmark.
- Fresh backend coverage: 89.19% statements/lines, 86.48% branches and 90.75%
  functions. Both current backend and frontend reports passed the repository
  coverage ratchet; its older baseline was not changed.
- Client API/component typechecking and the production Vite build passed.
  Final Markdown, whitespace and staged secret checks are retained with the
  other ignored local verification receipts.

The complete frontend coverage run passed 477 files and 7,374 tests. Coverage
is 87.79% statements, 81.84% branches, 87.50% functions and 89.47% lines. Both
updated Knip full and production dependency scans passed.

An initial concurrent frontend run hit scanner timeouts and was stopped; the
replacement passed after the initial backend run was stopped. That initial
backend run found that the shell lacked OpenSSL for unrelated TLS fixtures. The
existing Git OpenSSL executable was supplied through the fixture's established
`OPENSSL_BIN` option; the six TLS compatibility cases and the final complete
backend run pass. No timeout or assertion was relaxed.

## Remaining work and next item

Broader inferred destination fit still fails the retained documentary and
seasonal-movie examples. Eleven authorized operator confirmations are retained
as exact-item memories, but existing quality readers do not include those newer
outcome receipts. Connect them to evaluation with typed identity, snapshot and
conflict checks before claiming broad improvement; preserve their explicit
limits on generalized policy learning. Retain per-item learned-routing stopping
reasons so later changes can distinguish weak evidence from unavailable checks.

Before a future release, prioritize the pre-existing HTTP-parser advisories
documented in the [separate tooling outcome](server-tooling-pr572-outcome.md).
That security batch is independent of the purpose refactor and does not justify
an advisory-free claim for this commit.

The subsequent [parser security outcome](runtime-parser-security-outcome.md)
records that bounded follow-up. Operator correction outcome evaluation remains
the next classification refactor; parser updates do not establish better library
fit or a classification accuracy rate.

The 2026-10-28 [authorized outcome evaluation outcome](authorized-outcome-evaluation-outcome.md)
records the agreed prospective snapshot implementation in the first two shared
reader seams. Historical gaps remain explicit. Its next bounded item is the
prospective inventory reader; it does not establish improved library fit.
