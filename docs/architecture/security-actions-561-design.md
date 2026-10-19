# Security action updates from PR 561

## Selection and scope

GitHub MCP found open PRs 561–566 on 2026-10-19. Random selection chose
[PR 561](https://github.com/cloudbyday90/Classifarr/pull/561), then its unchanged
open state and immutable head `ed943cbb0e07085552eb97614a0e237d1966079f` were
revalidated. Apply its three-workflow diff locally, not by merging the PR.
The baseline is `2149220bffe289803f8cf10942896a4e6b9894a0`.

Update all four CodeQL init/analyze/SARIF references from v4.38.3
`24c54180a607b1449ed407dd24f251e4e9147c8d` to v4.39.0
`6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee`. Update all four OSV action/reusable
workflow references from v2.6.0 `a345acffa64b0eaede81a3d9aae6141214d9c8fc`
to v2.7.0 `b1d267aea5211fa648d9d442fa64b90dbdcbdd36`.
No npm manifest/lockfile, application dependency, permission, trigger, secret,
scanner severity, vulnerability failure gate or release policy changes.

## Official research and risks

Retrieved through MCP on 2026-10-19:

- [CodeQL immutable changelog](https://github.com/github/codeql-action/blob/6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee/CHANGELOG.md)
  records v4.39.0 on October 15: minimum bundle 2.20.7, checkout-path validation
  and a cache restoration fix. Our default workspace-root checkout and default
  bundle need no compatibility override. Keep init/analyze/upload on one revision.
- [OSV action release](https://github.com/google/osv-scanner-action/releases)
  and [immutable action definition](https://github.com/google/osv-scanner-action/blob/b1d267aea5211fa648d9d442fa64b90dbdcbdd36/osv-scanner-action/action.yml)
  confirm v2.7.0. Its Docker image is still referenced by an upstream version tag:
  pinning the wrapper does not make every transitive artifact immutable.
- [GitHub dependency lockfiles](https://docs.github.com/en/enterprise-cloud@latest/actions/concepts/security/workflow-dependency-lockfiles)
  adds repository identity and transitive action locking, but is public preview.
  Reusable workflow internals use their defining repository's policy. Assess it
  separately rather than silently migrating the repository during a version bump.

Keeping old pins minimizes immediate change but misses maintained fixes. Floating
major tags reduce update effort but weaken review reproducibility. The selected
exact-SHA update preserves current least privilege and reviewable changes; it
still needs remote execution and does not prove scanner completeness or security.

Final stack: official immutable source review → exact coordinated SHA updates →
unchanged least-privilege/failure contracts → local YAML regression tests → exact
commit hosted scanner results. Never grant Dependabot secrets or SARIF write
access to make a scanner run. No manual workflow dispatch is needed for this work.

## Verification and handoff

Update the existing security-scan workflow tests to the reviewed identities while
retaining every trigger, permission, category, query and failure assertion. Run
those tests plus affected CI/code-health contracts. Inspect the full diff for only
the selected eight replacements. Local tests cannot execute hosted CodeQL/SARIF;
report hosted results separately after the authorized push, not as local proof.
Record results in a separate outcome, update Unreleased, stay on main. No release,
tag, scanner bypass, other dependency batch, or PR merge.
