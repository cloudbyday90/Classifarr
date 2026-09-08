# Library Observed Trait Prevalence Outcome

Status: implemented locally on 2026-09-08; unreleased.

## Delivered behavior

Libraries now derives an automatic local-versus-peer trait prevalence view from
the existing bounded overlap snapshot. A native disclosure shows the top five
observed values for each trait, the local observed-identity denominator, the
same-type selected-peer denominator and the percentage-point difference.

The view withholds source-conflicted rows before it builds identities, traits,
peer baselines or visible values. It reports the withheld row count in the
existing coverage notes. A missing trait, a duplicate conflict or a library
outside the active-library selection remains an explicit limitation.

This change adds no provider call, database mutation, model input, classifier
score, policy edit, learning action, review task or automatic route. The browser
never receives catalog titles, descriptions, external IDs, raw provider data,
policy terms or AI output through this addition.

## Validation

- Focused backend unit tests passed: 26 tests across the prevalence and
  overlap suites. They cover same-type peer baselines, incomplete local and
  selected scope, deterministic top-five bounds, malformed identities and
  route safety.
- PostgreSQL integration tests passed: 8 tests. The new case creates a current
  source-identity conflict and verifies that the conflicted genre is absent
  from overlap and prevalence while the exclusion count remains visible.
- Focused client tests passed: 15 tests across the overlap disclosure and its
  presentation normalizer. They cover automatic loading, accessible disclosures,
  raw-text escaping, source-conflict explanation, malformed projection rejection
  and the absence of policy or route controls.
- The full backend verification passed with the bounded runner: 1,121 unit
  suites / 32,115 tests and 132 PostgreSQL integration suites / 1,580 tests,
  plus one intentional integration skip. The final full client suite passed 344
  files / 4,819 tests; the later presentation-boundary hardening also passed its 16
  focused client tests.
- Server/client lint, TypeScript/Vue type checks and static ESM import/mock
  checks passed.

The provenance-verified `npm run docker:smart:provenance-rebuild` completed
from implementation commit `2c90a12b5d062bd433ba9140f5de102fe4feeee1` with a
no-cache image build, recreated Compose service and healthy `classifarr`
container. This outcome does not claim semantic classification accuracy or
readiness for semantic counter-evidence.

## Resulting recommendations

| Layer | Result | Recommendation |
| --- | --- | --- |
| Inventory understanding | Common and locally distinctive patterns are now measurable without routine operator input | Use the automatic view as observed context only |
| Authority | Source conflicts and missing coverage are visible instead of silently becoming evidence | Keep source-conflict exclusion fail-closed |
| Future AI context | Bounded, named prevalence can inform compatibility analysis | Keep raw values server-controlled and provider-minimized |
| Semantic automation | No independently labelled 24–32-case cohort exists because the real frame has no eligible broad-policy comparisons | Do not add semantic counter-evidence yet |

## Next item

The remaining high-value task is to make the broad-policy candidate-comparison
population observable enough to produce a real, automatically selected
24–32-case cohort. It must preserve the current source-conflict exclusion and
candidate ownership rules, collect no labels itself and create no policy or
routing effect. Only genuine independent labels plus the existing readiness and
frozen-study preflight can authorize a separate review-only semantic
counter-evidence design.
