# Dotenv PR 571 design

Date: 2026-10-27. Current open PRs, ordered by creation, were 569, 570, 571 and
573. A PowerShell `Get-Random -Minimum 0 -Maximum 4` draw returned index 2,
selecting [PR 571](https://github.com/cloudbyday90/Classifarr/pull/571).

The inspected immutable head is a663d7bb92ca7086cbd97e692a2e69f263f2c239,
based on b484ce770fdbc5459c232507b80ff36aea8d873c. The provider diff changes
only dotenv 18.0.8 to 18.0.9 in the server manifest and its root/package lock
records. Implement locally with the exact pin, test, then close without merging.

The [official changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md),
discovered from the GitHub MCP PR body, documents the empty DOTENV_PATH CLI fix.
Registry metadata confirms Node >=12, no runtime dependencies and no install
lifecycle hook. The existing Node 24.22.1 baseline satisfies it. Packing/build
scripts are not installation hooks and do not justify new script permissions.

The patch keeps environment loading in its existing module. Benefits are the
upstream CLI correction and a small dependency change; costs are regression risk
in environment precedence and secret loading. Keep synthetic temporary env files,
scrub child DOTENV settings, and reuse the existing isolated dotenv runtime suite.
Add its missing empty-path CLI regression, with externally supplied value
precedence and quiet-output controls. Never load the repository .env in the test.

Apply this independent patch after the parser-only graph has been reviewed so
failures remain attributable. Preserve strict script decisions and all overrides.
Run the server's full required checks alongside the parser batch. Keep stale
Dependabot rebases distinct from completion of asynchronous bot work.

Recommendation: exact 18.0.9, regression coverage, reviewed lock, no new config
loader, no version bump, PR merge, release or deployment. Observed results belong
in [the outcome](dotenv-pr571-outcome.md).
