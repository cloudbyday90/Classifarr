# Learned-evidence live routing outcome

## Result

Ordinary `manual` and `prompt_select` soft-evidence reviews can now resolve through
fresh learned-library evidence and a validated local AI proposal. The selected
policy score is preserved, even below the normal automatic threshold. The server
issues the existing short-lived consensus receipt only after qualification and
revalidation; model confidence and serialized assessments cannot authorize routes.

The separate [design document](learned-evidence-live-routing-design.md) records
the official-source research, options, pros/cons and recommended stack.

## Implementation

- `learnedEvidenceRoutingService.mjs` captures a private, one-use pre-generation
  context and checks current policies, destinations, configuration and full-pool
  evidence. It rejects changed requests, results and proposals during awaits.
- `learnedEvidenceRoutingAssessment.mjs` combines the existing learned review
  assessment with library-specific familiarity, full-pool exact-identity checks
  and consistency with the descriptions supplied to the model.
- `liveLibraryMatchBaseline.mjs` fits only the proposed destination using cached
  vectors in the same read-only snapshot as its inventory evidence. Query copies
  and shared-library description groups do not count as training observations.
- `libraryMatchGroupSplit.mjs` is shared by live fitting and held-out evaluation;
  `policyCandidateRevalidation.mjs` shares fresh policy evaluation with the existing
  threshold-qualified consensus path. No dependency, schema or API change.
- The live classification path uses its existing AI call. Explicit confirmation
  paths and verification fallback do not gain learned routing authority.

Existing constraints, RAG opt-outs, unknown review reasons, sparse/degenerate
baselines, ambiguous neighbors, competing exact identities and administrative
confirmation requirements retain review. Automatic routes retain the existing
method and remain excluded from trusted outcome-label learning. Inventory
membership itself is observational, not independently confirmed truth.

## Local Compose findings

The running instance has `require_all_confirmations` set to `true`. The default
service correctly refused preparation. This setting was not changed.

A second test used a confirmation-disabled configuration only inside its own
read-only process. It used real retained metadata, fresh policy evaluation,
current PostgreSQL inventory/cache reads, the installed local model, production
prompt/parser and the new resolver. It never called a media-routing function.
PostgreSQL `default_transaction_read_only=on` was checked before proceeding.

| Retained case | Media | Policy score | Learned evidence agrees | Familiar baseline | Fresh receipt |
| --- | --- | --- | --- | --- | --- |
| 1 | Movie | 45 | No | Yes | No |
| 2 | Movie | 38.72 | Yes | Yes | Yes |
| 3 | TV | 48 | No | Yes | No |
| 4 | Movie | 44 | No | Yes | No |

The final rebuilt image repeated all four outcomes: case 1 retained review for
competing description neighbors; cases 3 and 4 retained review for metadata
disagreement. Each run made four local AI calls (eight across the two runs).
No media was routed or classification history written by the tests, and no
settings were changed. These four retained cases
are an integration smoke test, not a representative benchmark, accuracy claim
or a new independent-label evaluation. The earlier 300-item replay's 126 familiar
agreements must not be described as 126 live automatic routes.

The qualifying case took approximately 4.9 seconds in evidence revalidation in
the first smoke run, versus 1.7 seconds for its local generation. Revalidation
for the three non-qualifying cases took approximately 1.5–3.0 seconds. These are
single observations, not throughput or percentile benchmarks.
The final repeat measured 4.5 seconds of revalidation for the qualifying case.

## Verification

- Broad policy regression: 570 suites / 3,776 tests passed.
- Targeted coverage: 20 suites / 429 tests passed. The eight measured services
  reached 98.72% statements/lines, 96.67% branches and 82.05% functions. Reports
  are isolated under `.tmp/coverage-learned-live-final`; they do not replace
  global coverage reports or establish the global coverage ratchet.
- Database integration: five suites / 61 tests passed, including real vector
  ranking, live baseline fitting, qualification, membership drift, existing
  consensus recovery and policy/route outcome contracts.
- Routing/code-health regression: 26 suites / 24,353 checks passed.
- Backend typecheck, changed-file ESLint, static-import and ESM mock-shape checks
  passed. Tests cover low-score qualification, all-pool comparison, explicit
  restrictions, configuration/policy/folder drift, proposal/result tampering,
  cancellation, expiry, copy exclusion and baseline/evaluation parity.
- Final Compose is healthy; all 11 affected service hashes match the host.
  Markdown lint and whitespace checks passed. The unchanged frontend build was
  reused by Docker; no new frontend test results are claimed for this backend
  component.
- The pre-existing production-naming gate remains blocked by 26 references
  against its zero-reference baseline. This change does not increase that count
  or relax the gate. These results do not claim an entirely green CI.

Repeat the focused suites from `server/`:

```powershell
$testPatterns = 'learnedEvidence|liveLibraryMatchBaseline|libraryMatchBaseline|inventoryMatchCalibration|liveInventoryDescription|classificationPolicyPathAdjudication|policyCandidateConsensus'
node scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns=$testPatterns
```

Database checks:

```powershell
$testPatterns = 'live-inventory-description|consensus-review-recovery|policy-shortlist-replay|deterministic-policy-route-outcome-acceptance|policyEngine.test'
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --testPathPatterns=$testPatterns
```

## Next high-value component

The [model-reuse design](live-library-model-reuse-design.md) implements the next
step as demand-driven refresh against fresh snapshots. It defers background
prewarming until latency measurements justify extra idle work; see the separate
[model-reuse outcome](live-library-model-reuse-outcome.md).

Reduce repeated library-profile and baseline work with snapshot-keyed reuse and
automatic background refresh. Measure cold/warm validation latency and review
coverage across all movie/TV libraries before and after the optimization. Cache
identity must include representation, membership, metadata and query exclusions;
stale entries must never gain routing authority. Do not relax ambiguity checks
or inflate confidence to improve a throughput number.

For the local instance specifically, automatic routing also requires turning off
the existing global confirm-everything preference. That is an operator preference,
not a new acknowledgement introduced by this implementation.

## PR, documentation and release scope

GitHub MCP returned no open Classifarr PRs on 12 September 2026. No unrelated or
closed PR was substituted and no PR was merged. Design and outcome are separate
documents; the previous component links to this follow-up. Changelog changes are
under Unreleased only. No version bump, release or release tag is created.
