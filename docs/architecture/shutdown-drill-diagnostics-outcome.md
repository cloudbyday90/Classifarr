# Shutdown drill diagnostics — implementation outcome

## Scope

Implemented on `main`, without a release or production deployment. The
[design](shutdown-drill-diagnostics-design.md) records research, alternatives and
the recommendation stack. The release-evidence workflow kept diagnostics separate
from acceptance evidence and required exact-image synthetic rehearsals.

The original run's hidden child errors remain unknown. New diagnostics cannot
prove whether that earlier failure was a Docker timeout, an in-use volume, or an
earlier scenario failure. No timeout, memory safeguard, application recovery
policy or production database was changed.

## Changes

- Modular ESM error projection and atomic diagnostic persistence, wired through
  both existing real-image runners. Original scenario failures and cleanup
  failures are separate; nested details and recent operations are bounded.
- Cleanup verifies each exact generated resource is absent, including after
  ambiguous command errors. Names plus ownership labels still precede removal.
- CI always attempts a bounded upload of two exact safe JSON files, retained for
  seven days. Neither file is consumed as release acceptance or an attestation.
  A missing file warns because an earlier step may have prevented the drill from
  starting; it does not override the required job's failure.
- Workflow mutation tests protect blocking drill commands, exact paths, the
  pinned artifact action, failure upload and retention settings.

The ownership manifest was re-reviewed only for `embeddedQueueRecoveryChecks.mjs`:
its SQL, synthetic data and claim assertions are unchanged. The file now forwards
scenario identity and the diagnostic callback. Existing ownership debt is not waived.

## Validation

Lint, server/client type checks and Markdown validation passed. The first broader
tooling run found one expected action-count assertion (13 uploads became 14);
that assertion was updated without weakening action pinning. The first preflight
also required the specific reviewed-source digest update described above.

Final tooling run: **170 suites / 2,643 tests passed**. Copyright, narrowly
re-reviewed ownership, development/production dependency checks, workflow contract,
lint, server/client type checks, Markdown (2,182 documents) and whitespace checks
passed. No application schema or API changed; the full runtime, database and
frontend suites were not repeated locally for this infrastructure-only patch.

### No-cache image and real scenarios

The protected Compose build used clean source
`7398cda89bd4fe92dfae928e631801b170168abb`, `--no-cache` and
`--require-provenance`. Docker resolved the tested local image to
`sha256:5ded1881fdb79e2bcb2db8c639bae59f401b99b76806186b0c84fbf4c96fae32`.
The exported platform configuration digest was
`sha256:a171bfafe093d9776fd5ec8275f5702207f5fcf3986618256318f38dd35fd7dd`.
These are local build identities, not independently verified published registry
provenance. The final documentation-only follow-up does not change image inputs.

Both runners used that immutable image ID, synthetic data, no external network,
no published ports and disposable labeled volumes. On 13 October 2026:

| Real-image scenario | Result |
| --- | --- |
| Queue graceful stop and restart | Passed: two tasks replayed, stale writes rejected, one metadata effect |
| Queue forced host kill and restart | Passed: claims/budgets survived; two tasks replayed; stale writes rejected |
| Loaded drain, 10-second deadline | Passed: exit 0, clean database, data preserved |
| Loaded drain, 60-second deadline | Passed: exit 0, clean database, data preserved |
| Frozen workload, 10-second deadline | Passed: expected exit 137, crash recovery, data preserved |
| Frozen workload, 60-second deadline | Passed: expected exit 1, clean database, data preserved |

Queue checks completed at **19:18:04 UTC**; loaded checks at **19:20:36 UTC**.
Fixture claim deadlines are deliberately advanced by the existing queue drill;
this does not prove production cooldown time elapsed. All cleanup checks passed.
An independent read-only check confirmed all 18 generated resource names absent
(six application containers, six offline helper names, six volumes).

The two generated JSON reports were 12,633 and 24,966 bytes, respectively, and
contained the matching source and image identities. They remain under ignored
`.tmp/ci`; CI will retain the corresponding reports in its own run artifact.

### Local deployment evaluation

The local Compose service was replaced only after these rehearsals, using
`--no-build --no-deps --pull never --force-recreate --wait` and rollback protection.
The running container is
`642051ce12b26067af28166f30b95fdbe499108899ec138e160e62d8f392ec3c`,
and its image matches the tested ID above. Health returned HTTP 200; unauthenticated
queue API access returned 401. Startup checks confirmed UID/GID `1000:1000`,
read-only root, `no-new-privileges`, the unchanged 2 GiB limit, no OOM and zero
restarts. An early sample used 415.7 MiB; this is not a long-duration memory study.

The previous local image remains retained as
`classifarr-local-rollback:d51b678ea50d8335c2c87a982f26a132545954b92787cd1302b40dc7e1336ff4`
with image ID
`sha256:7cca7f4f9f4d58b27b0be9b129bcd953251cafb9cca6239c66851ecbaff03da7`.
A fresh 76,258,260-byte custom-format database backup is retained in ignored
`data/backups/shutdown-diagnostics-before-20261013.dump` and `.tmp`, SHA-256
`e9e1461b3aabe88f3b3c48431b17bc10de5e6a8b69e3b16facc0522281cc756a`.
Its table of contents was readable; this was not a full restore rehearsal.
Unraid, Plex and the shared Ollama service were not changed.

### CI limits

The preceding commit's [CI run 38450580620](https://github.com/cloudbyday90/Classifarr/actions/runs/38450580620)
passed, including both old runners, database tests and installation acceptance.
That is evidence for `35f83f83d043c50668d31c0d7d0dc0c7b2b8fa12`, not this patch,
and does not explain the older lost error. New CI must validate this patch after
push. No remote failure artifact for the new format has yet been observed; its
failure paths are covered by fault-injection and workflow mutation tests locally.

## Open PR check and next item

The repository had zero open PRs when checked on 13 October 2026, so there was no
eligible random PR to implement. No PR was merged or closed.

Next: first address any reproducible defect exposed by these diagnostics. Then
continue evidence-backed replacement-ID recovery for genuinely removed provider
records. Same-ID recovery already exists; automatically choosing a similar title
would not establish identity and remains unsafe. Leave Unraid and Plex unchanged.
