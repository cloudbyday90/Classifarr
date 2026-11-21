# Server runtime PR 592 assessment design

November 21, 2026 Eastern. Approved design assessed at `1b86aa04d`.
The random draw from the one open PR selected
[PR #592](https://github.com/cloudbyday90/Classifarr/pull/592) at head
`c6e2a7d09de6934b1a39b645807ad4a5624d9e75`. It applies cleanly to `main`.

## Recommendation

Qualify the PR's exact dotenv 18.0.10 update. In this version the module
export stays at `dist/index.cjs`, while `bin.dotenv` points to `dist/cli.cjs`.
The old tests called the module export as if it were the executable. Use the
installed manifest's declared executable in those fixtures. Keep the existing
environment precedence, quiet mode and library assertions.

Qualify exact express-rate-limit 8.7.5 in the same batch. The publisher's
November 18 advisory lists 8.7.4 and earlier versions as affected and 8.7.5
as patched. This supersedes the PR's limiter version. Baseline npm audit
returned zero findings despite the applicable publisher range. Use the
publisher record alongside scanner reports. The direct server dependency is
used by authentication, API and library routes. This package assessment
does not establish a Classifarr exploit path. Verify ordinary quota, error
handling, reset and expiry behavior in isolated tests.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Qualify dotenv and the superseding patched limiter | Retains the useful PR change and covers the publisher's current fixed range | Requires independent runtime checks for both packages |
| Take the PR pins verbatim | Matches the bot commit exactly | Leaves the limiter inside the affected range |
| Defer the runtime batch | Preserves the current tree | Leaves the current limiter inside the affected range too |

Review the exact lock records and verify unchanged transitive dependencies,
install script decisions, limiter configuration and application env loading.
Run strict install, full tree and audit checks. Preserve existing synthetic
env fixtures and real HTTP guards. Verify the exposed store expiry contract
with a bounded clock-controlled test. Run focused authorization and database
checks, full affected coverage and standard quality gates. Keep the candidate
only when the gates pass. Leave the PR unmerged and changes on `main`.

## Official references

- [Dotenv changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md)
- [npm package executable declaration](https://docs.npmjs.com/cli/v9/configuring-npm/package-json/#bin)
- [Express rate-limit 8.7.5 release](https://github.com/express-rate-limit/express-rate-limit/releases/tag/v8.7.5)
- [Publisher version range and patch](https://github.com/express-rate-limit/express-rate-limit/security/advisories/GHSA-cppf-2hm6-mrvm)
