# Creation journal image rehearsal outcome

## Result: passed

The complete approved frozen rehearsal passed on 22 October 2026, finishing at
08:15:06 America/New_York (receipt 12:15:06.240 UTC). It rebuilt with no cache,
then used one immutable local image for the sustained soak and all three saved
installation profiles. Docker Engine 29.8.2 and Compose 5.6.0 were observed.
See the [design](study-vm-creation-journal-design.md) for scope and tradeoffs.

- Tested clean source: 5629ee9d0a70ee5c5a72a56bd62a883294a24013 on main.
- Local Linux/AMD64 image ID:
  sha256:b03b6555f11a4e11f981dd0c9defac1aabe297f6fe76d5cdba019e30d218eb65.
- Pinned published baseline: v0.48.4-beta, manifest digest
  sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f,
  source a0e417fd714919bb4ca30e20f9cd2380136ca74e.

The final v2 receipt records passed, disabled build cache, clean/stable source,
the same candidate ID in every phase and verified candidate-tag cleanup.
Subsequent documentation commits are not the image's recorded source revision.
This local image ID is not a published candidate manifest digest or attestation.

## Admission history and credential boundary

The initial attempt on a6724e0d2d902903bd82f609a58ef7101649c7e1 stopped before
build: the inherited GITHUB_TOKEN override was rejected. No candidate/project
ownership was acquired. Its false worktreeClean field was an unfinished final
qualification flag, not evidence that initial Git admission was dirty.

The user then explicitly approved using the existing stored CLI login while
omitting that override only for the rehearsal child process. A bounded active
login check succeeded. The first full attempt with stored credentials returned
generic verification_failed before build; its underlying cause was not retained
and is not assigned retrospectively. A bounded read-only check with the exact
same digest, source, signer and self-hosted-runner policy then passed. A new full
rehearsal subsequently performed and passed its own required verification gates;
the diagnostic pass was not substituted for missing rehearsal evidence.

No login/logout, account switch, persistent environment edit or policy relaxation
was performed. No token, account identity or raw CLI response was exported.
The CLI's repository, signer-workflow, source-digest and deny-self-hosted checks
remained enabled, with no alternate baseline or offline-bundle fallback.

Private receipt/summary are under .tmp/release-rehearsal. Earlier receipts were
copied to separate ignored backup directories before subsequent invocations.
No old VM binding/receipt was read or changed.
Final receipt SHA256:
1f95e5231f8944fe6f3ec4eacdc9409583ac9f702a18a2f8afe52a21af1e0115.
This identifies the local receipt bytes, not a signed attestation.

## Same-image soak evidence

The workload requested 30 minutes and completed in 1,927,139 ms including drain
and two-minute settled idle. Both startup modes and the sustained run verified
the unchanged 2 CPU / 2 GiB / 128 PID budget.

| Observation | Result |
| --- | --- |
| Unique completed inventory | 1,600 / 1,600 |
| Pressure recovery cohort | 20 / 20 |
| Synthetic HTTP-provider recovery cohort | 8 / 8 |
| Final pending / failed / routing tasks | 0 / 0 / 0 |
| Sampled container memory peak | 460.14 MiB |
| Sampled PID peak | 60 |
| Initial / final cgroup OOM kills | 0 / 0 |
| Owned soak-project cleanup | Passed |

Injected provider outages and telemetry pressure are intentional. Zero failed
tasks does not mean the fault-injection workload had no refused HTTP requests.
Sampled peaks are not instantaneous maxima, production capacity, latency SLOs
or proof of no long-term memory leak.

## Saved-template installation matrix

| Profile | Named gates | Fresh recovery budget | Upgrade recovery budget | Cleanup |
| --- | --- | --- | --- | --- |
| Standard | 12 / 12 | Passed | Passed | Passed |
| Local Unraid-style fixture | 12 / 12 | Passed | Passed | Passed |
| Custom UID/GID fixture | 12 / 12 | Passed | Passed | Passed |

Each profile exercised fresh operational seeds, real startup scheduling,
published-baseline export, persisted-volume migrations, interrupted restore,
unverified normal-startup rejection, rollback and explicit verified retry,
movie/TV recovery and normal restart. Saved configuration digests stayed
unchanged across each upgrade; music and routing work remained excluded.
Database version 180006 was consistent across profiles; the baseline had 222
migrations and the fresh/candidate database 330.

Fresh and upgraded budget checks include real connection pressure at 32 maximum
connections, expected SQLSTATE 53300 admission refusal, continued health and
connection recovery. Each of the six 600-item backlog scenarios preserved task
IDs and committed ingestion, completed all 600 items once, reclaimed exactly the
five interrupted tasks, and recorded zero duplicate completions/early reclaims.
Sibling progress before original lease expiry and an actual database restart
were verified. Original visibility remained 600,000 ms; the post-restart
observations took 588,760–590,985 ms because part of each lease elapsed earlier.
No claim timestamps or retry counters were reset to accelerate recovery.

Fixtures use synthetic sources, an eight-second SQL gate and audit triggers in
their disposable database to observe the crash boundary. These are deliberate
test instruments, not production migrations or actual provider/model quality.

## Cleanup, limits and next item

After completion, a separate bounded read-only check confirmed zero containers,
volumes and networks for all four exact generated projects, and absence of the
owned candidate tag. No global prune or baseline-image deletion was used.
Deleted synthetic fixture state can be recreated by the runner; it is not live
application data. The original local Classifarr container remained running and
healthy. No normal service was replaced, VM started/stopped, release created,
image published or actual Unraid/shared Ollama target accessed.

Final receipt identity/check lists, consistent database evidence and fresh/
upgrade budget evidence were rechecked with the existing contract helpers;
the raw soak result also revalidated to the exact recorded aggregate. This is
one local shared Docker engine/platform, not hardware isolation, Windows journal
durability, the four-arm archiving study or multi-platform release acceptance.

The documentation-only follow-up passed Markdown validation (2,352 files, zero
errors) and diff whitespace checks. No runtime code changed during this rerun.

Next platform recommendation remains
[bounded representative-refresh failure diagnostics](representative-refresh-failure-diagnostics-design.md).
The reported scheduler incident's original cause is still unknown; this image
rehearsal neither reproduces nor fixes it. Future VM integration and on-demand
power control remain separate gates, not authority to reuse an old cleanup.
