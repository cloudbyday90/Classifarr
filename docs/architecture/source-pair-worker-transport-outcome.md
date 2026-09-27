# Source-pair worker transport outcome

## Implemented behavior

The [lossless transport design](source-pair-worker-transport-design.md) now serves
both automatic replay and quality-study worker entrypoints. A shared 117-line ESM
module owns validation, the vector manifest, acknowledged frames, and complete
reconstruction. The callers retain their own result contracts and fixed worker
entrypoints. Scheduler errors preserve only allowlisted failure reasons.

Transport completion precedes evaluation. Invalid sequence/order, duplicate or
missing vectors, non-finite values, wrong precision, early results, worker errors,
deadlines and cancellation fail closed. Settled callers stop sending frames and
always join the worker. Caller-owned buffers are never detached. Cohort selection,
numeric values, fingerprints, policies, routing and inference budgets are unchanged.

## Measured transport experiment

A real Node worker on the local Windows host transferred a synthetic corpus of
9,000 vectors with 1,024 dimensions plus 10 MB of metadata. This is larger than
the reported installation's 6,658-vector snapshot. The worker used the production
512 MB old-generation/32 MB young-generation limits and a credential-free
environment. It checked every reconstructed value against its original value.

| Measurement | Result |
| --- | --- |
| Original serialized snapshot | 93,601,084 bytes (above the old 64 MiB limit) |
| New metadata/manifest envelope | 10,594,202 bytes |
| Vector frames | 73, one unacknowledged frame at a time |
| Largest serialized frame | 1,025,166 bytes (below 1 MiB) |
| Exact numeric reconstruction | All 9,216,000 values passed |
| Transfer plus verification | 855 ms in this single run |
| Worker heap used at completion | 127,695,584 bytes |

Completion heap usage is **not** peak heap, external memory, or process RSS. This
single synthetic run is not an SLA, a full scoring benchmark, or a production
accuracy claim. The transfer changes the meaning of the 64 MiB check to the
non-vector envelope; the assembled snapshot is still bounded by existing corpus
and worker limits, not by 64 MiB total memory.

## Live diagnosis and limitations

Earlier read-only diagnostics identified `evidence_budget` and reproduced the
71,783,683-byte original payload against a 67,108,864-byte cap. No provider outage
is needed to explain that failure. A subsequent live transport-only probe was
deferred by the existing memory-pressure admission guard. A separate readout saw
1,051,226,112 available bytes against a 1,073,741,824-byte start requirement within
the 2 GiB container limit. That guard was not bypassed or lowered.

After other validation completed and headroom returned, the guarded read-only
transport probe passed: all **6,658 vectors** arrived in **54 frames**, largest
serialized frame **1,025,165 bytes**, with exact numeric equality, zero provider
calls and zero data writes. This used MessagePorts in a separate diagnostic
process against a read-only snapshot, not the live scheduler or a persisted
evaluation. The real-worker synthetic measurement above covers the worker boundary.

The live container was not rebuilt, restarted, hot-patched or given new authority.
Consequently, this change does not claim that its scheduled evaluation has already
recovered. After a separately authorized deployment, the existing due retry can
use the new transport, subject to memory admission and all other evidence checks.
Verified success clears existing failure state through the existing repository.

The follow-up report `83b4d6e2-e7bc-4fc2-9a25-a806ec9dc320` at 2026-09-27
10:42:03 UTC was checked read-only. Its persisted evaluation failure was again
`evidence_budget`, with the next eligible check at 11:42:03 UTC. The running
container still advertised revision `a93a1e34` and did not contain the chunked
transport or typed scheduler failure message committed in `91d870d1`. This
confirms the fix had not been deployed, not a demonstrated regression in the new
transport. The exact new payload was not recollected and no evaluation was forced.

## Validation and follow-up

Targeted tests cover numeric precision including signed zero, complete corpus
transfer, deterministic fingerprint/cohort/result equivalence, malformed input,
both worker lifecycles, and bounded scheduler messages. The 9,000-vector coverage
test has a 60-second test-only allowance because coverage instrumentation exceeded
the default 10 seconds; production deadlines were not increased.

The final full backend coverage run passed **1,479 suites / 44,008 tests**. The
coverage ratchet, backend type checks, test/security lint, dependency checks,
copyright, migration checks, static ESM imports, and workflow-contract checks
passed. Security lint retains one pre-existing non-literal-file-path warning in
`captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.
Frontend source was unchanged; its existing coverage report was used by the
workspace ratchet. The candidate Docker build also built the frontend, and the
[installation drill](runtime-installation-acceptance-outcome.md) passed all nine
runtime checks with verified cleanup.

The security-hardening review favored focused remediation within existing
authority boundaries; these incidents did not establish a need for a new
privileged service. This is not a full security audit or a worker sandbox claim.

Next: implement the [typed recovery-case policy](provider-identity-recovery-research.md)
on existing recovery records, with durable stage/reason/checkpoint evidence and
failure-specific recheck rules. That addresses recurring diagnosis and safe
backfill without guessing identities or hiding permanent failures. Separately,
measure end-to-end scoring near the existing corpus budget before considering
consistent-snapshot partitioning for larger installations.

## Subsequent deployment verification — 2026-09-27

The separately authorized no-cache rollout has now deployed the transport fix.
The normal scheduled attempt at 11:43 UTC completed 300 samples (150 movies and
150 TV items), cleared `evidence_budget` and reset the failure count to zero.
No memory guard or cooldown was bypassed. This supersedes the earlier delivery's
deployment limitation, not its historical measurements. See the
[local deployment outcome](provider-recovery-local-deployment-outcome.md) for the
exact image, validation and remaining limits. Typed recovery cases and bounded
external-ID diagnosis are now implemented; the next bounded application component
is the actionable administrator recovery view described in the
[revalidation outcome](inventory-identity-revalidation-outcome.md).
