# Redirect dependency fix outcome

Date: 20 October 2026. Outcome: **fixed** for the two pinned dependency trees.
Code subject: `d190b5d79f1a84088e6228f73c3bf8bb8e258015`.
See the [design and alternatives](redirect-dependency-fix-design.md).

## Cause, patch and invariant

The [failed OSV run](https://github.com/cloudbyday90/Classifarr/actions/runs/39481981352)
scanned `70ea16cedb6f1ed639da8df610fd0f05700dd95e`. Its scanner completed;
the reporter failed on vulnerability findings, not scanner infrastructure.
Two advisories were duplicated across root/client follow-redirects 1.16.0 locks.

The broken boundary was direct follow-redirects request headers crossing an
origin boundary: regex-token custom sensitive names could evade the filter, and
flat-array names were not filtered correctly. Sensitive credentials must not
reach that redirected destination; ordinary headers and legitimate same-origin
behavior must remain. This did not establish an application credential leak.

Exact 1.16.1 overrides and the two lockfile updates are the narrow compatible
patch accepted by Axios 1.20.0. The server dependency tree/transport, install
policy, scanner thresholds and release version were not changed. New ESM tests
exercise both actual installed copies. Dependency-tooling CI now installs and
caches both required trees before running those tests.

## Ordered verification

### 1. Boundary reproduction and patch review

A bounded loopback-only probe with synthetic values reproduced both advisories
before updating: object headers leaked the custom `^`/`|` names; raw-array input
with an explicit Host header leaked those plus Authorization, Cookie and
Proxy-Authorization. It required HTTP 200 to avoid treating a rejected request
or an earlier capture as destination evidence. Same-origin and ordinary-header
controls succeeded. No actual credential or external provider was used.

The identical probe after strict clean installs of 1.16.1 showed empty leak
lists in both representations and both trees. Source review and a fresh
independent candidate review found no surviving advisory bypass. The reviewer
caught the root-only CI install mismatch; the patch and a CI-order test address
it. Review also identified upstream raw-array duplicate-header last-value
semantics; no affected Classifarr object-normalized caller was found. That
compatibility limitation remains explicitly documented, not silently generalized
into a claim of preserving every raw-array Node option.

### 2. Focused trigger, alternate representation and legitimate controls

`node --test scripts/__tests__/redirect-dependency-security.test.mjs` passed all
15 cases: exact installed/locked pins, object/array secrets, mixed-case standard
names and regex-token custom names, same-origin preservation, ordinary headers,
redirect limits, actual Axios Node GET behavior and CI install ordering.

Axios integration controls retain its standard credential boundary and show that
custom headers not configured as sensitive remain ordinary headers. The direct
library reproduction is not misrepresented as an application Axios exploit.

### 3. Installation, package checks and CI

- Pinned Node 24.21.0/npm 12.2.0 generated only the two expected package-node
  version/URL/integrity lock changes using scripts-disabled lock review.
- Policy-enforced `npm ci` and `npm --prefix client ci` passed; no installer
  allowance or engine policy was relaxed.
- Full-scope `npm ls --all` passed independently in root/client; full-scope
  `npm audit --json` returned zero findings in each.
- `npm run test:tooling:dependencies`: 58/58 passed.
- `npm run lint`, `npm run typecheck`, static-import, migration naming and schema
  integrity checks passed. Client production build passed.
- Client coverage run: 477 files and 7,374 tests passed; no API contract changed.
- Fresh backend unit coverage run: 1,877 suites and 60,292 tests passed, with one
  skipped test. `node scripts/check-coverage-ratchet.mjs` passed using current
  client/server reports; no baseline or threshold was changed. Database
  integration was not rerun locally for this dependency/tooling-only change.
- [OSV scan](https://github.com/cloudbyday90/Classifarr/actions/runs/39488609687),
  [dependency-tooling CI](https://github.com/cloudbyday90/Classifarr/actions/runs/39488608931),
  [Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/39488608915) and
  [Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/39488608916)
  succeeded for the exact code subject. This is not a claim that every repository
  CI job has finished or that the entire platform is vulnerability-free.
- [CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/39488608953) and
  [resource-capacity regression](https://github.com/cloudbyday90/Classifarr/actions/runs/39488609044)
  also succeeded for that same code subject.

Documentation lint passed 2,321 files with zero errors. The broader CI/CD
pipeline was still in progress when these notes were assembled; its fresh
installation/published-upgrade job had succeeded. Local validation above is not
a substitute for its remaining database-integration and build/test results.

The [separate VM outcome](on-demand-study-vm-outcome.md) records the successful
protected no-cache Compose build and exact native test artifacts. No normal
container replacement, Unraid/shared-Ollama mutation, tag or release occurred.

## Open PR selection

MCP enumeration returned only [PR #568](https://github.com/cloudbyday90/Classifarr/pull/568).
Its proposed server ESLint 10.13.0 change is already present in the manifest and
lockfile on main, and current lint passed. There was no unapplied open PR change
to implement. It was not merged, closed, reapplied or counted as a new feature.
