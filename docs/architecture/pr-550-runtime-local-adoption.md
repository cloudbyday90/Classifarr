# PR 550: local server-runtime adoption

Date: 2026-09-28. Outcome: changes implemented locally; validation is recorded
in [the handoff outcome](inventory-backfill-handoff-outcome.md). No PR merge or release.

## Selection and changes

The connected GitHub search returned open PRs 549 and 550. A random draw selected
[PR 550](https://github.com/cloudbyday90/Classifarr/pull/550), confirmed open and
unmerged at head `2c0ba8a3eafcfe5c9334f035a8120a70c0706bb9`.

Reproduce its two manifest and lockfile changes without checking out or merging
the PR branch:

- dotenv 18.0.1 → 18.0.3; keep the manifest range `^18.0.3`.
- Undici 8.10.2 → 8.11.2; keep the manifest range `^8.11.2`.

The registry integrity values match the fetched PR. Installation and lockfile
updates disable lifecycle scripts. All new application code remains ESM.

## Official evidence and tradeoffs

- [dotenv changelog](https://github.com/motdotla/dotenv/blob/master/CHANGELOG.md):
  18.0.2 fixes fast-parser edge cases; 18.0.3 fixes the quiet setting loaded from
  an environment file. The subsequently published 18.0.4 is outside this PR's
  selected change; the lockfile deliberately tests 18.0.3, not an implicit upgrade.
- [Undici releases](https://github.com/nodejs/undici/releases): 8.11.2 fixes aborted
  request reconnection and rejected HTTP/2 WebSocket stream cleanup. The included
  minor update also changes transport internals, so compilation alone is insufficient.

Benefits: maintained runtime fixes with a reproducible lockfile. Costs: transport
and environment-loading regressions are possible. Recommendation: retain these
specific updates only with the full backend suite, real synthetic HTTP recovery
tests and isolated container startup/schema checks. No real credentials, provider
spending, routing changes or live deployment are part of validation.
