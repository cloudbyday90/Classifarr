# Policy-Candidate Synthetic Replay CI Design

## Decision

Run the existing fixed synthetic policy-candidate replay as a separate
pull-request CI job in the main CI workflow. The job checks out the pull
request merge result with persisted credentials disabled, provisions the
repository's pinned Node version, and invokes the fixed ESM runner directly.

It deliberately does not install packages, read live library data, call a
provider, use a secret, write a cache or artifact, mutate policy, or route
media. Its only output is the runner's existing aggregate pass/fail report.

## Why a separate pull-request job

The replay is fast and exercises the deterministic candidate calibration,
ranking, ambiguity, weak-evidence, and decision projection shared with normal
classification. Giving it a distinct check makes a regression visible at the
review boundary without coupling it to the slow build, browser, database, or
release work.

The job runs on `pull_request`, not `pull_request_target`, because it runs code
from the proposed change. It has only `contents: read`, persists no checkout
credential, accepts no user-controlled arguments, and uses the repository's
full-SHA action pins. Those controls follow GitHub's guidance to use explicit
least-privilege permissions and immutable action revisions.

## Execution boundary

```text
pull request targeting main
        |
read-only checkout, credentials disabled
        |
Node version from .nvmrc
        |
fixed local ESM replay runner
        |
aggregate pass/fail CI check
```

The runner's fixture path is fixed in source. Its strict fixture contract
rejects media-shaped or unexpected inputs, and the resulting report contains
only version, aggregate counts, and safe risk identifiers. A passing check is
review evidence only; it cannot authorize a policy, provider, AI/RAG, learning,
or media-routing action.

## Alternatives considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Separate pull-request replay job | Fast, independently visible, least privilege, no release coupling | One additional required-check candidate | Selected |
| Add the replay to the full build-and-test job | No new check name | Slow feedback and the replay result is easy to miss | Rejected |
| Run a live library or AI/RAG replay in CI | Could exercise runtime context | Exposes data, adds nondeterminism and credentials, and is not a safe review authority | Rejected |
| Path-filter the job | Avoids some executions | A relevant shared-module change could skip the regression check; skipped required checks can also block merging | Rejected |

## Recommendation stack

1. Run the fixed replay on every pull request to `main` with no inputs,
   secrets, caches, or artifacts.
2. Keep action revisions pinned to full commit SHAs and job permissions limited
   to `contents: read`.
3. Validate workflow syntax locally and run the replay command before commit.
4. After the first successful production pull-request run, configure this
   check as required for `main` through repository branch protection or a
   ruleset.

## Accessibility and W3C consideration

This change has no rendered interface, interaction, status message, or
accessible name. Therefore no W3C/WCAG implementation change is appropriate:
adding UI solely for a CI-only contract would reintroduce the busy diagnostic
surface the product is deliberately reducing. The existing operator UI remains
unchanged.

## Sources consulted

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub guidance on hardening Actions workflows](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats)
- [GitHub pull-request event guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
