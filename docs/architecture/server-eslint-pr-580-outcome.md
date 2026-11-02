# Server ESLint PR 580 assessment outcome

Date: 2026-11-02 (America/New_York).
Design, alternatives and official research: [assessment design](server-eslint-pr-580-design.md).
Base: a8f3d431b2d5a054915d1e097252847a4af1626c on main.

## Adopted patch and real-tooling behavior

Locally adopted [PR 580](https://github.com/cloudbyday90/Classifarr/pull/580),
head 46ba6518b0bca0ddc8a19da52ba8ee7a2e080f52, after one uniform random selection
from open PRs 580 and 581. Exact server ESLint is now 10.14.0. The PR is unmerged.
The previously assessed PR 581 compiler update remains deferred; vue-tsc 3.3.13,
TypeScript 6.0.3 and the client compiler graph stay unchanged.

The old installed real Linter crashed on both valid property-value regressions
and the restricted-self shorthand control. With 10.14.0 the valid object/class
cases produce no messages; self produces the exact no-restricted-globals
defaultMessage, severity 2, line 1, columns 15 through 19. All twelve real-tooling
controls pass, including existing security rules, ESM/import behavior,
international text and focused-test prohibition. Production rules did not change.

## Reviewed graph, installation and ownership analysis

The generated lock delta contains only the root declaration and ESLint record:
no added or removed packages. The artifact SRI matches published registry
metadata. The humanfs/node and minimatch minima rise, but installed 0.16.8 and
10.2.6 already satisfy them. Espree 11.2.0, Acorn 8.16.0, Acorn JSX 5.3.2,
eslint-scope 9.1.2 and visitor keys 5.0.1 remain unchanged.

Node engines remain ^20.19.0, ^22.13.0 or >=24; jiti stays an optional peer and
no install lifecycle script is introduced. Node 24.22.1 and npm 12.2.1 remain
pinned. Strict server npm ci passed (630 packages), and npm ls --all reports no
invalid graph. Existing bcrypt-only installer authority and scanner policy remain
intact. Independent root/client manifest, lock and installed-lock hashes match
the intake receipt; no global tool or npm bundled dependency was edited.

Before the runtime edit, full inventories from identical source under ESLint
10.13.0 and 10.14.0 matched in every field except parser version: 3,499 scanned
files, 890 entries, candidates, digests, analyses, gaps, triggers and cascade
relationships. Source fingerprint was
4bfc17bccc901632733a0374b50c9586144e0492be8c16062ff58e7565748d78.
Only then was the explicit parser pin updated to 10.14.0. The review manifest
otherwise matches exactly: all 890 entry bindings, 100 reviews, baseline
882cfa1ab4a8ca735039bc4123aaef221019710d, classifications and unresolved debt
are unchanged. No source/analysis digest or classification was regenerated.

The ownership gate passes while productionCompatible remains false. A reviewed
parser change and passing local checks do not grant global writer compatibility.
The later worker-only stop check changes its source fingerprint normally and
has no ownership inventory entry or SQL; the final gate also passes.

## Full audit scope and remaining findings

Fresh November 2 audits include development dependencies, not only runtime trees.

| Project | Low | Moderate | High | Critical |
| --- | --- | --- | --- | --- |
| Root | 0 | 0 | 0 | 0 |
| Server | 3 | 29 | 0 | 0 |
| Client | 0 | 11 | 0 | 0 |

These are affected package-node counts, not counts of unique advisories. Existing
server findings span ESLint/minimatch, Jest/glob and Testcontainers/archive graphs;
client findings span ESLint/minimatch and Vue test-tool/editorconfig/glob graphs.
Several npm suggestions are major downgrades or report no available fix. This
batch neither applies forced audit fixes nor claims an exploitable application
path or an advisory-free dependency graph. Keep those findings visible for
separate compatible tooling assessments; the held npm bundled parser update
remains a separate toolchain decision.

Separate server/client runtime-only audits report zero affected nodes. Those
additional results do not replace or reduce the full tooling counts above.

## Validation and delivery

Strict installation, full graph check, twelve real ESLint controls, ownership
negative tests, lint, types, both Knip gates, 72 dependency-policy tests and the
source/policy gates pass. Fresh full backend coverage passes: 1,927 suites,
62,402 passed tests, one existing skip, 809.47 seconds. Statements/branches/
functions/lines are 89.25/86.65/90.80/89.25 percent. The joint ratchet passes with
the verified unchanged client report (484 files / 7,521 tests); no fresh client
coverage, build or browser run is claimed. Markdown, staged secret and whitespace
checks pass. No coverage baseline was changed.

Delivery review finds both Dependabot heads open, unmerged and mergeable. Neither
is genuinely stale or needs another rebase; PR 580's applicable patch is adopted
locally while PR 581's settled compiler deferral remains. Scoped artifact
maintenance confirms unchanged daemon/container/image identities and preserves
all recovery assets, current evidence, shared caches and other projects; see the
[runtime outcome](capture-outer-read-stop-outcome.md) for the detailed receipt.

No root/client update, rule weakening, UI/W3C markup change, operator CLI trigger,
release or deployment. Exact version pins, reviewed manifests and separate
runtime/outcome documents keep the recommendation stack reviewable on main.
