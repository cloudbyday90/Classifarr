# Published arm64 recovery gate outcome

November 22, 2026 Eastern.

The [approved design](published-arm64-recovery-gate-design.md) is implemented
at `ce8cf12ef25f1a44090ab0dd4b87e96df93f401b`. The tag workflow now runs the
scheduled crash fixture on the same verified image ID as the arm64 routing
job. Its receipt is required for v4 assembly and covers the exact release
tag, index, child, config, source, run, attempt and cleanup. The read-only
rehearsal continues to accept signed historical v3 releases.

## Local verification

- Passed 502 focused release, workflow, installation and diagnostics tests
  and 32 Node contract tests. The production workflow validator rejected
  stage bypasses and cross-run artifact retrieval. Mutation tests rejected
  prior attempts, wrong image identities, bad counts and incomplete cleanup.
- The release-only entry point refused the local x64 host and returned a
  blocked preflight receipt. The assembler rejected missing and stale
  scheduled receipts before writing release assets in disposable tests.
- The genuine immutable `v0.49.4-beta` asset passed signature and historical
  validation. The current promotion authority refused that same v3 asset.
- Workflow lint, Markdown lint, static imports, repository preflight, server
  test lint and the coverage ratchet passed. The application coverage reports
  retained their previously verified hashes. GitHub listed no open PRs.

## Native compatibility check

Read-only run `45064150215`, attempt `1`, passed on `ubuntu-24.04-arm` at
15:04 Eastern. The downloaded receipt matched the implementation revision,
the signed historical release and the exact arm64 manifest and config.
The existing beta again preserved its checkpoint, completed four backfill
tasks, queued zero routing tasks and completed cleanup.
[Native historical run](https://github.com/cloudbyday90/Classifarr/actions/runs/45064150215)

The automatic native branch run also passed at the implementation revision
with a separately built local image and a verified cleanup receipt.
[Native branch run](https://github.com/cloudbyday90/Classifarr/actions/runs/45064139892)

## Boundary

The tagged v4 publication and promotion path requires a future authorized
release to exercise end to end. The changed workflow definition was checked
locally. No release, promotion or deployment was performed in this batch.
The versioned images are uploaded before the native gate can test their
digest. A failed gate blocks the GitHub release, `latest` promotion, and
automatic retention, while the versioned images remain pullable.

## Next recommended item

On the first approved v4 release, verify the exact run and attempt from
native routing and scheduled recovery through the signed evidence asset and
the promotion results for both aliases. If an earlier attempt is the only
evidence available, rerun the full tag workflow under the existing approval
rules.
