# Vue compiler backport adoption outcome

November 13, 2026 (America/New_York). Adopted locally after all local gates pass.
Design:
[conditional native-patch adoption](vue-compiler-backport-adoption-design.md).

## Candidate and concrete fixes

The change adopts PR 589's exact vue-tsc/language-core 3.3.14 graph with
its eleven reviewed compiler/protocol artifacts. TypeScript remains 6.0.3 and
Vue remains 3.5.45. Application syntax, type scopes, all other overrides,
dependency-script decisions and runtime dependencies are unchanged. The root
manifest only adds the new patch-installation control to the existing tooling
test command. No PR is merged.

One native npm patch changes the component generator and slot generator and adds
a small comment-conversion leaf inside language-core. The slot change backports
merged upstream commit
[`31e5f342f9b505056e807b97c478c366df9d2eee`](https://github.com/vuejs/language-tools/commit/31e5f342f9b505056e807b97c478c366df9d2eee).
The component change replaces string-unaware comment conversion with TypeScript
parser-backed line-comment ranges, preserving the existing one-line inference
copy. That portion is a local fix informed by unmerged
[PR 6241](https://github.com/vuejs/language-tools/pull/6241), not a claim that an
unmodified fixed upstream release exists. The upstream MIT license is preserved.

The real vue-tsc CLI exposes a restricted TypeScript facade. Initial prototypes
using enum objects/token instance helpers failed startup; the final leaf uses
the existing source-file pattern and public traversal/comment functions available
through that facade. No extra compiler instance or dependency is introduced.

## Differential evidence

| Execution | Observed result |
| --- | --- |
| Original 3.3.13 baseline, twelve existing controls | 12 pass |
| Unpatched 3.3.14, original and added lexical controls | 13 pass, 11 fail out of 24 |
| Merged slot fix plus exact unmerged URL proposal | 18 pass, 6 fail out of 24 |
| Parser-aware local fix plus merged slot fix | 24 pass |
| Final Linux frontend image, including two added slot-default pairs | 28 pass |

The upstream patches clear the original five regressions but leave positive and
negative controls failing for nested templates, regex literals and comments
inside template interpolation. The local fix passes those cases as well as
ordinary URL/non-URL bindings, exact invalid numeric-event operations, real/block
comments, escaped quotes, slot defaults and the unrelated semantic-error sentinel.
The same assertions retain exact source-mapped diagnostics; syntax errors,
implicit-any degradation or missing semantic checking cannot satisfy negatives.

The final Linux image is a disposable frontend-builder test subject built from
the current client inputs. It executes the real 28-control suite without network,
with bounded CPU/memory/PIDs and a read-only mount of synthetic test source.
This is local frontend installation/compiler evidence, not a published production
image, deployment or multi-platform release attestation. Its private identity
receipt records the exact local Docker image reference and input snapshot.

## Reproducible automatic installation

Client `patchedDependencies` selects only language-core 3.3.14. The checked-in
unified diff and its content hash are recorded in client lockfile format 4.
Root/server lock formats and dependencies remain unchanged. Docker copies the
patch before its existing frontend `npm ci`; no custom installer, fork or
additional dependency is required. Patch headers are normalized to avoid trailing
whitespace, and the lock hash records those exact bytes.

A scoped Git attribute keeps client patch bytes as LF on every platform. A
forced Windows checkout-filter rehearsal preserves the exact recorded hash;
automatic CRLF conversion would otherwise invalidate native patch installation.

Real native npm controls reinstall a synthetic patched registry package twice
with scripts disabled, then refuse missing, changed, unused and inapplicable
patches. `npm ci` also rejects both patch-relaxation flags. The tests use an
owned loopback registry and preserve the actual npm source/remote/script policy.
Strict client installation succeeds with a valid complete tree and no audit
findings. Developer/CI installs perform patching automatically; operators have
no new command or trigger.

## Security, final verification and retirement

Fresh full audits report root zero, client zero and the same five known low
server tooling affected-node entries. No scanner exception or severity changed.
Source inspection confirms the exact OSV 2.7.0 extractor and Trivy's actual CI
default parser enumerate the format-4 packages map and ignore unknown patch
metadata. This establishes parser compatibility; the pushed commit's actual
scans remain required evidence.
[Exact OSV extractor](https://github.com/google/osv-scalibr/blob/5be78a00e3c2/extractor/filesystem/language/javascript/packagelockjson/packagelockjson.go),
[Trivy CI-default parser](https://github.com/aquasecurity/trivy/blob/v0.70.0/pkg/dependency/parser/nodejs/npm/parse.go).

The dependency/tooling suite passes 119 tests with one existing Windows skip
for the Linux WASI control. Client configuration controls pass 13 tests. Fresh
client coverage passes 488 files / 7,585 tests in 177.60 seconds, at S/B/F/L
87.92 / 82.17 / 87.70 / 89.60 percent. Fresh backend coverage passes 1,948 suites /
63,623 tests with one existing skip, at 89.35 / 86.83 / 90.90 / 89.35 percent.
The joint ratchet, normal lint/type/ownership/policy/ESM gates, production build
and all thirteen production/pending-review browser checks pass. No coverage
baseline, expected diagnostic, type scope or timeout is relaxed.

These results satisfy the local adoption conditions. Source identities and
retained frontend image inputs are checked separately from coverage reports;
the [runtime outcome](adopted-rag-verification-input-outcome.md) explains the
backend-only fixture correction and scoped Git-attribute protection. Current
assessment images are preserved and all baseline container/image/worktree
identities remain unchanged. No shared cache or recovery asset is removed.

The only open Dependabot PR at intake is 589, whose assessed versions are now
implemented locally with the required patch. It remains unmerged. Delivery
checks that the pushed commit's own scans consume the client lock and preserve
existing gates; remote results are reported with that commit. No release or
deployment is made.

Remove this patch and its manifest/lock/Docker-copy references once a coherent
published fixed compiler passes the same controls. The temporary maintenance
cost is explicit. Recommendation stack: exact coherent graph, attributable
small patch, native fatal install checks, genuine semantic regression tests,
full application/build/scanner evidence, then tested upstream retirement.
