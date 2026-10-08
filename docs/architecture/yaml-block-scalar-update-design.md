# YAML block-scalar patch design

Research date: 2026-10-08. Scope: server js-yaml 5.4.2 to 5.4.3 on Node
24.21.0/npm 12.2.0; no release, database change or production deployment.

## Evidence and affected boundary

The [upstream changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md)
records the October 6 patch for whitespace-only block scalars followed by a less
indented line. [Issue 802](https://github.com/nodeca/js-yaml/issues/802) supplies
the failing nested example. The
[immutable source comparison](https://github.com/nodeca/js-yaml/compare/494400bd45cad078123cfc057e674a9a0a8d9983...78326247fa2cec0d2c7ed553353d554e039ee7c8)
also includes parsing the first block-mapping key once, rather than twice.
Both behaviors require regression coverage; the version number alone is not
evidence of compatibility.

Classifarr's runtime consumer is `server/src/utils/swaggerSpec.mjs`, which reads
trusted repository annotations. A parser exception currently discards that
annotation, so this bug can omit a valid documented operation or schema. Other
consumers validate repository workflow/Compose YAML. No user-facing YAML import
was found. Root and client lockfiles contain no js-yaml installation.

The server override already shares this package with eslint-plugin-n and
`@istanbuljs/load-nyc-config` through Jest. The latter requests an older major;
exercise its real YAML configuration loader, not just the direct ESM import.
Keep the existing override and schemas unchanged.

## Standards and safety

[YAML 1.2.2 section 8.1](https://yaml.org/spec/1.2.2/index.html) distinguishes
empty-only scalars from nonempty ones: keep (`+`) preserves the empty line while
clip/default and strip (`-`) produce an empty string. Test literal and folded
styles, nested indentation, subsequent mapping entries and invalid indentation.

The [official safety guidance](https://github.com/nodeca/js-yaml/blob/master/docs/safety.md)
recommends bounded input and traversal before materializing untrusted alias
graphs, with exceptions treated as rejection. The
[usage guide](https://github.com/nodeca/js-yaml/blob/master/docs/usage.md)
documents explicit schema customization and separate single/multi-document APIs.
Do not introduce executable tags, enable merges globally, accept malformed
documents or remove the existing cumulative merge-budget tests. This patch does
not make the trusted annotation generator suitable for untrusted uploads.

Registry metadata for 5.4.3 retains only `argparse ^2.0.1` as a runtime
dependency, with no install hook, native component, peer or engine requirement.
Initial server audit reported zero advisories including development packages;
this is a correctness patch, not a newly claimed vulnerability remediation.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Update the existing parser | Small patch; correct valid annotations; existing consumers retained | Parser optimization and overridden tooling need tests | First choice |
| Replace the parser | Opportunity to redesign parsing policy | Broad AST/schema/API and tooling migration for a narrow bug | Defer |
| Stay on 5.4.2 | No dependency churn | Valid annotations may still disappear | Reject after reproduction |

1. Reproduce the installed-parser and real annotation failures before updating.
2. Upgrade only js-yaml; preserve merge budgets, lifecycle policy and Node 24.
3. Verify parser controls, tooling consumers, backend tests and the actual image.
4. Review Knip 6.40.0 as the next separate tooling batch; no automatic major
   updates or memory-safeguard adjustments.

## Random open PR trial

A fresh enumeration contained PRs 555 and 556. `Get-Random` selected
[PR 556](https://github.com/cloudbyday90/Classifarr/pull/556) again, at head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. It changes server Node declarations
24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0. Apply its exact two-file
patch locally, run the existing runtime-major gate before/after, then reverse
only that patch if incompatible. Do not merge, install a knowingly incompatible
toolchain or weaken the gate. Record the actual trial in the outcome.

## Validation and rollback

Generate the server lockfile with scripts disabled, review every changed package,
then run normal strict-policy `npm ci`, dependency-tree validation and full audit.
Run focused tests, all backend unit tests, lint/typecheck/Knip and repository
tooling/preflight checks. Add only ESM tests; reuse the existing generator.

Commit implementation before the provenance-checked no-cache local Compose build.
Test synthetic YAML through the built image without application data or network.
Dump and compare schema using the existing disposable database runner. Back up
the local test database and pin its old image before replacing local Compose;
observe health and sanitized logs for a bounded period. Unraid remains untouched.
Separate the observed outcome from this design; a short observation is not a
memory-retention study or published multi-platform release acceptance.
