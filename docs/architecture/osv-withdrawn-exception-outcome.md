# Withdrawn OSV exception retirement outcome

November 21, 2026 Eastern. Implemented the
[approved retirement](osv-withdrawn-exception-design.md) against main
`3d3fd5f38796f9635d5d284fcd941954b1ab46eb`.

Removed the server configuration file, which held only the expired
`GHSA-gcqx-w48m-w2h4` exception. The root configuration, dependency locks,
workflow pins, permissions, SARIF reporting and failure settings are the
same. The original decision is recorded in the
[renewal outcome](deepmerge-triage-renewal-outcome.md).

## Verification

The comparison used OSV Scanner Action 2.7.1 and the same read-only
lockfile layout for both runs. The local Linux amd64 scanner image was
pinned to
`sha256:46564b2ffec78c2c668afbbb09ff1b6ed4605caeb27d02df9894809cb5b02653`.
SHA-256 comparisons confirmed identical lockfiles and root configuration.

| Check | Observed result |
| --- | --- |
| Scan with the expired file | Exit 0, zero findings, deprecated expiry field and unused exception reported |
| Scan after removal | Exit 0, zero findings, both warnings cleared |
| Discovery after removal | Root 98, server 710 and client 331 entries, 1,139 total |
| Active-advisory control | Exit 1, including `GHSA-35jh-r3h4-6jhm` for `lodash 4.17.20` in the synthetic server lockfile |

The active control used dependency metadata only, with no package
installation or execution. The existing six security workflow contract
tests passed before and after removal. The OSV workflow passed
`actionlint`. Astra confirmed discovery of all three lockfiles is part
of the acceptance evidence. [Active advisory record](https://osv.dev/vulnerability/GHSA-35jh-r3h4-6jhm)

GitHub listed zero open pull requests. There was no applicable PR or
stale Dependabot branch.

## Next recommended item

Assess which production image consumers require npm or npx. The application
startup uses its shell entrypoint, and the shared base also installs npm
for the build stages. First trace recovery, diagnostics and image
validation consumers. Then qualify a builder-only package-manager
boundary if the production image can omit the CLI.

This would address exposure from the shipped toolchain. The verified
npm 12.2.3 package still bundles the same affected Glob and Minimatch
versions, so builder-toolchain remediation also needs a published fix.
[Node runtime qualification outcome](node-24-22-3-runtime-outcome.md)
· [Docker multi-stage build guidance](https://docs.docker.com/build/building/multi-stage/)
