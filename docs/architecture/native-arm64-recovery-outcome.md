# Native arm64 scheduled crash recovery outcome

November 22, 2026 Eastern.

The [approved design](native-arm64-recovery-design.md) adds an independent
native check to relevant pushes on `main`. The rehearsal uses the existing
fresh-only Unraid profile, synthetic data, production entrypoint, and owned
Compose resources. GitHub scheduled the first run from implementation
revision `74b6c8cdad84bd4abfc13f93cd5e6b2df9a8c462`.
[Native recovery run](https://github.com/cloudbyday90/Classifarr/actions/runs/45027220039)

## Local verification

- Node 24.22.3 passed all 27 focused Node contract and baseline checks.
  The actual entry point on the local x64 host exited nonzero with a blocked
  preflight receipt before building an image.
- The existing installation, crash, diagnostics and workflow suites passed
  all 337 tests. The immutable action inventory includes the new pinned steps.
- Workflow lint, server test lint, Markdown lint, static ESM validation and
  repository preflight passed. The coverage ratchet passed with the same
  verified reports and unchanged application inputs.
- GitHub returned no open PRs. The local Classifarr container remained on
  its existing running, healthy image. No release or deployment was made.

## Native qualification

GitHub Actions run `45027220039`, attempt `1`, passed on `ubuntu-24.04-arm`
at 08:25 Eastern. The downloaded receipt matched the run, attempt and
implementation revision. Its immutable local Docker image ID was
`sha256:5dfc771a278cc804a70f2f2087ff89ea4f20ceded2d57709d1eeac53aa4385cc`.

The job verified fresh installation, the durable checkpoint and container
exit 137 without OOM. The replacement container resumed the backfill on the
owned volume. Ingestion runs and inventory stayed unchanged, four tasks
completed, profiles were current, and no routing task was queued. The drill
verified cleanup of its resources and the frozen image helper removed its
temporary tag. [Native recovery job](https://github.com/cloudbyday90/Classifarr/actions/runs/45027220039/job/137222749405)

The earlier emulated PID-lock refusal did not recur in this native run.
Its cause remains unresolved. This receipt covers one locally built image
on the native runner and the synthetic Unraid profile. It does not qualify
a published digest, a full arm64 published-upgrade rehearsal, or live Unraid.

## Next recommended item

Keep this check on relevant `main` pushes. If it reports the PID-lock
refusal, retain the sanitized failure and observe process identity in a
separate isolated replay before proposing any change to startup behavior.
At the next authorized release, verify the published arm64 child using the
existing digest and provenance gates. Qualify a builder npm update once its
published bundle contains corrected Glob and Minimatch versions.
