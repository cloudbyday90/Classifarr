# Native arm64 scheduled crash recovery

November 22, 2026 Eastern.

The package-manager image qualification reproduced a PostgreSQL PID-lock
refusal in both the previous and new images under local arm64 emulation.
The standard installation job runs on x64. The existing native arm64 job
runs after tagging and tests published routing. A native run of the fresh
scheduled crash case is the missing observation.
[Packaging outcome](production-image-package-manager-outcome.md)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Repeat emulation | Uses the existing local setup | Cannot separate host/emulation effects from behavior on native arm64 |
| One native rehearsal | Qualifies one source and image with little ongoing cost | Gives no coverage for subsequent changes |
| Automatically run a scoped native check on main | Qualifies relevant changes before a release is tagged | Adds a native production image build to those pushes |

Use one GitHub-hosted `ubuntu-24.04-arm` job on pushes to `main` that touch
image, runtime or rehearsal inputs. Keep this check independent of release
and branch-protection gates. Verify Linux arm64 in Node, the Docker daemon
and the inspected image. Use a fresh checkout bound to the workflow's SHA,
and record the run, attempt and exact local image ID. A newly built image
qualifies that build. Published multi-platform artifacts have their own gate.
[GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
· [Workflow filters](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
· [Docker platform builds](https://docs.docker.com/build/building/multi-platform/)

## Verification stack

1. Use SHA-pinned checkout, Node setup and artifact upload with `contents: read`.
   Disable checkout credential persistence. Build locally without a registry
   write or release dependency. [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
2. Build the existing production target with the frozen image helper. Run the
   existing fresh-only Unraid-profile case against that image ID. Keep its
   synthetic data, isolated network, disposable volume and existing deadlines.
3. Require the durable checkpoint, exit 137 without OOM, resumed backfill and
   zero routing tasks from the current crash contract. Verify fixture and
   candidate tag cleanup before recording success. Save a small allowlisted
   receipt and retain the existing sanitized startup diagnostic on failure.
4. If the native PID-lock refusal recurs, the existing pre-teardown diagnostic
   retains fixed lifecycle and log markers. It cannot establish the conflicting
   task's identity after the container exits. Use a separate diagnostic replay
   with a bounded read-only observer armed before recreation if that evidence
   is needed. Report unknown identity if the task vanishes, omit raw lock
   contents, native IDs and command lines from CI artifacts, and preserve
   PostgreSQL's interlock.
   [PostgreSQL startup](https://www.postgresql.org/docs/18/server-start.html)
   · [Lock file layout](https://www.postgresql.org/docs/18/storage-file-layout.html)
   · [Linux process identity](https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html)

The test exercises an installation fixture. It does not change the product
interface or establish web accessibility conformance.
[W3C evaluation scope](https://www.w3.org/TR/WCAG-EM/)
