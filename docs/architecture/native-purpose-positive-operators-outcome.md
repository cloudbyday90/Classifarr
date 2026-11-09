# Native purpose positive-operator compatibility outcome

Date: 2026-11-09 Eastern. Status: implemented and locally verified under the
confirmed scope. No release or deployment. See the separate
[design, research and tradeoffs](native-purpose-positive-operators-design.md).

## Delivered behavior

One native-purpose semantics leaf now interprets canonical declared positive
rules. All sixteen positive signal/operator combinations have defined execution.
The eight repaired pairs are list include for genres/keywords/studios,
require_all for keywords/studios, and require_any/require_all/prefer for media type.
Existing supported scalar scores, confidence caps and combination math remain.
Identity preferences with no match remain zero; compatibility preferences remain
neutral 50. Content include behaves as required-any at 80; media include retains
100 and its existing missing-data behavior.

Recognition requires purpose role, known declaration provenance, explicit
semantics, a matching bounded operator list and an optional positive finite
numeric weight. Other shapes, compound values, unknown/observed origins,
missing semantics and other roles retain the original execution. No validator,
request fingerprint, receipt order, stored schema or historical data is changed.
Exclusion behavior is deliberately retained; this is positive compatibility,
not a complete negative/compound rule redesign.

The shared interpretation feeds scalar scoring, private bound contribution,
declared-match evidence and native specialization. Required content include terms
participate alongside require_any/require_all; media scope, compatibility and
preferences do not acquire specialized identity. Existing strict hard limits,
avoid behavior, inferred admission, ambiguity, calibration and final route/learning
authority remain separate. Repaired scores can change eligibility and threshold
bands without changing those authorization boundaries.

Both existing PostgreSQL overlap readers also needed stored include extraction.
A small shared SQL leaf extends their existing aggregate queries; it adds no query
or raw-term response. It uses the native term/count limits and validates known
declaration source, operator/value agreement, explicit identity semantics, numeric
weight and the complete canonical list. Its trim and UTF-16 length checks match
the JavaScript boundary, including nonbreaking spaces and astral characters.
Stored weights outside the serialized positive JavaScript number range are
conservatively excluded from new include evidence; PostgreSQL can retain a value
such as 1e-400 that would load as zero in JavaScript.
Old required-any/all extraction remains unchanged. No API/UI, schema, setting,
job, operator CLI trigger, provider call or live configuration write is added.

## Reproduced failures and verification

Before correction, the new unit matrix produced 23 failures with 32 passing
controls. All eight new production-factory PostgreSQL scoring cases failed,
while seven original controls passed. After the numeric correction, separate
stored-include regressions reproduced three missing-overlap failures with ten
passing exclusion/binding controls before the SQL correction.
A further database regression reproduced one underflow-weight admission failure
with fourteen passing controls before the serialized-number range correction.

Current passing verification:

- Eleven focused server suites / 309 tests, including the independent PR's
  workflow contracts and preserved failure mutations.
- Fresh full backend CI/coverage: 1,930 suites / 62,648 passed tests and one
  existing skip, in 751.735 seconds. All 5,734 frozen backend/workflow/tooling
  hashes remain unchanged; only the final completed run qualifies the report.
- Four disposable PostgreSQL suites / 44 tests. Stored explicit commands load
  and evaluate through the real engine, retain nondefault combination settings,
  reject mismatches and recover exact receipts without extra versions.
- Include's private binding rejects copied runtime objects and a different item.
  Real competing destinations distinguish unique from shared required terms;
  threshold checks cover 80 versus 80.01 and preserve display-name invariance.
- The complete positive matrix covers identity/compatibility, full/partial/
  missing/nonmatching metadata, existing text/name matching and JSON encodings.
  Exact legacy parity covers supported combinations, exclusions, malformed item
  data, unverified/compound rules and other roles, including the existing scalar
  floating-point normalization at minimum/maximum positive finite weights.
  Bounds include 50 versus 51
  terms, UTF-16 limits, unsupported keys and invalid weights.
- Real PostgreSQL aggregate reads exclude observed/unknown origins, mislabeled
  operators, compound values, compatibility, untrimmed terms and invalid weights;
  60 astral characters meet the 120-unit limit while 61 do not. Responses retain
  aggregate-only privacy. An underflowing raw database weight is excluded, while
  Number.MIN_VALUE serialized by JavaScript remains admitted.
- Fresh client purpose controls: three files / 14 tests. Existing complete client
  coverage (484 files / 7,537 tests) remains eligible for reuse after all 1,229
  recorded source, installed-graph and report hashes match.
- All eight CI preflight jobs, full lint, server/client typechecks, four policy
  gates and ESM import/mock-shape gates pass without changing ownership review,
  coverage or scanner baselines. Both release workflow contract commands pass.
- Fresh root/server/client installed trees validate. Root/client audits report
  zero findings; the server still reports five low affected-package nodes in the
  existing CNA-rejected deepmerge chain and no moderate/high/critical workspace
  findings. Existing exact server-local OSV triage expires November 16 UTC.
  No advisory entry or npm installation policy is changed.

The current [official CVE record](https://github.com/CVEProject/cvelistV5/blob/main/cves/2026/93xxx/CVE-2026-93753.json)
was rechecked through MCP on November 9 and remains REJECTED, unchanged since
November 2. This does not withdraw the downstream advisory or silently change
its reported severity.

The qualified report is copied byte-for-byte to the existing server coverage
location. The unchanged coverage ratchet passes: server statements/lines 89.27%,
branches 86.70%, functions 90.80%; client statements 87.93%, lines 89.60%, branches
82.16%, functions 87.72%. Aborted review runs supply no qualified coverage claim.
Markdown lint passes all 2,473 documents. Workspace audits do not verify remediation
of the separate npm-bundled ip-address image finding before another release.

## Maintenance and delivery boundary

The branch remains main. No PR is merged. The independent
[PR 582 outcome](github-actions-pr-582-outcome.md) records its action-pin scope.
The parent b41b019a9 has its own successful pipeline 42558387268; it is not a
substitute for the eventual new commit's checks.

Final maintenance confirms the pinned Docker context/daemon, all three protected
services' exact identity/image/status/start/health and four worktree paths.
All prior 444 image/tag records remain; one additional Runbrace image is outside
this project and untouched. Current reports, recovery assets, other projects and
shared cache are preserved; no file or image is removed. Commit/push uses main;
the exact new source's own remote check status is reported separately after push.
No release, publication login, promotion or deployment is performed.
Normal remote CI pull authentication remains on its existing separate path.

## Next recommendation stack

1. Keep this canonical positive interpretation shared across native consumers.
2. Design replay-safe new-write capability validation and explicit negative/
   compound meaning, preserving readable historical drafts and exact receipts.
3. Replace category-specific AI prompt assumptions with the common purpose and
   constraint contract; this batch does not establish full platform agnosticism.
4. Improve individual/bulk declaration review using the existing UI surfaces.
5. Evaluate calibration and source correlation using frozen prospective evidence.
