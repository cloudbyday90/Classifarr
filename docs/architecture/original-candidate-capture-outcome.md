# Original candidate capture outcome

Date: 2026-09-07.

## Delivered changes

Implemented the [capture design](original-candidate-capture-design.md) with a pure
ESM capture module and a separate SQL projection module. Capture occurs at the
start of classification persistence, before its asynchronous preparation and
before routing. The bounded record identifies its original method, source, stage,
status and library ID. It ignores caller-supplied evidence metadata and copies no
raw model response, prompt or free-text reason.

The audit found and fixed two concrete losses. AI-unavailable retry/fallback
results now retain their supplied policy and signal context. Persisted rankings
also keep null positions, so a missing first candidate cannot promote the second
candidate into an apparent original prediction. Ranked IDs are copied before
asynchronous preparation, alongside the capture. AI/signal-only proposals are
stored separately rather than converted into policy rankings.

The clarification writer changes current history method to manual classification.
The capture's original method survives this transition and the chosen destination
can change without replacing the original ID. Existing routing persistence already
merges only routing fields into classification details; it needed no rewrite.
Direct membership, remembered manual corrections and direct manual queue selection
do not manufacture classifier proposals. Legacy policy evidence can still survive
a later manual resolution.

`evidence.coverage.v2` explicitly broadens original-candidate availability to
pre-routing proposals and adds four missing-reason counts. All five categories
reconcile to history events, including capped groups. Unknown/malformed explicit
capture blocks fallback to legacy evidence. Older payloads show unavailable capture
reasons, not invented zeros. Native description lists expose nonzero reasons
globally and by recorded library/method, without additional controls or requests.

Prompt/standalone feedback still uses its policy-ranked evaluation contract. An
AI-only captured proposal does not become an evaluated outcome merely because
its library ID is now available. No schema migration, historical backfill,
automatic routing change, provider call or operator task was added.

## Read-only Compose observation

At `2026-09-07T11:32:23.851Z`, the updated aggregate query and status cross-check
ran against local PostgreSQL 18.6 in 342.525 ms:

| Candidate coverage | Count |
| --- | ---: |
| Recorded legacy policy candidate | 5 |
| Explicitly no proposal | 0 |
| Invalid candidate evidence | 0 |
| Not applicable: imported membership | 6,699 |
| Unrecorded | 68 |
| Total retained events | 6,772 |

This distinguishes historical missing capture from a classifier explicitly
returning no proposal. It does not prove why any of the 68 older records lack
evidence or validate classification accuracy. Feedback remains empty. The query
returned aggregates only and made zero database writes or provider requests.

The deployed Compose container predates feedback source/evaluation tables. The
ignored helper verified that feedback was empty before substituting empty
relations for this measurement only. Production has no such fallback. The helper
ran through stdin in the read-only container. The existing retained history was
not rewritten, and this measurement does not claim adoption by that older image.

## Validation and limits

- 164 focused server unit tests passed across eight suites, covering capture,
  persistence, AI-unavailable paths, classification orchestration, routing metadata
  and the aggregate service.
- 99 real PostgreSQL integration tests passed across three suites covering evidence
  coverage, evaluated-feedback coverage and source-bound feedback. The final
  5,000-event coverage fixture took 12.717 ms; the separate 5,000-feedback aggregate
  took 8.717 ms execution time. These local timings are not latency guarantees.
- Client tests passed: 38 tests across the breakdown, statistics integration and
  named API leaf. The browser regression passed native labels, totals/reasons,
  desktop and 390/320-pixel layout, keyboard scrolling, text contrast and GET-only
  activity. Desktop and mobile screenshots were inspected.
- Server/client typechecks, ESM static-import and test-mock-shape gates passed.
  Scoped ESLint and production Knip dependency analysis passed.
- `classifarr:candidate-capture-local` built from a staged Git archive, excluding
  ignored data and secrets. Fresh disposable-container startup and authoritative
  schema comparison passed; the checked-in schema remained unchanged.

Real PostgreSQL tests cover all capture sources, method/destination changes,
legacy evidence, invalid versions/stages/IDs, mutually exclusive missing reasons,
empty and 201-group populations, and unchanged feedback eligibility. These are
controlled regression fixtures, not an independently labelled real cohort.
Full repository suites and the combined coverage ratchet were not run; the change
extends an existing endpoint. Tests and SQL measurements do not certify every
security or accessibility property or predict production latency at larger scale.

## Recommendation stack and next item

Keep a pure ESM capture contract, transactional JSONB persistence, strict bounded
SQL projections, the named client API and native Vue semantics. Benefits are
passive operation, traceable proposals and explicit missingness. Costs are a
versioned availability change and continued inability to recover lost historical
predictions. The design records W3C, PostgreSQL and OWASP sources and alternatives.

**Next: distinguish original classification method from final resolution method
in evidence attribution.** Manual resolution currently moves a row into the
manual-classification group. The new capture already preserves the original
method; expose a bounded original-method/source breakdown without changing the
recorded-library view or requiring manual annotations. This will make the coverage
of policy, AI and signal proposals easier to assess after real new traffic.

Independent labels, readiness and frozen-study preflight still gate any future
review-only semantic counter-evidence. These changes do not enable semantic routing
or expand automated learning eligibility.

README, Unreleased and the previous recommendation were updated. The separate
[tooling outcome](server-tooling-530-outcome.md) covers the randomly selected PR.
No release, tag, version bump or deployment is included.
