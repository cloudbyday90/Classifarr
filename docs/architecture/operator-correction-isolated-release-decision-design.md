# Isolated release decision replay — design

## Scope and problem

The prior release-pair comparator accepted artifacts but could not prove that
the published `v0.48.4-beta` code ran. The release evaluator also calls a
candidate ranker that can persist overlap telemetry. Importing it in the live
server, or running it in a regular local process, would cross the no-write
study boundary. This increment runs the pinned release's **policy decision
subpath** and the current subpath separately on identical, frozen, bounded
candidate scores. It does not run source scoring, inventory evidence, retrieval,
AI adjudication, authoritative signals, routing, or learning. Thus it is not a
full classifier comparison.

## Contract and isolation

The operator supplies a project-contained JSON input of 1–300 movie/TV cases.
Each case contains only its corrected destination library and 1–64 candidates
with policy/library IDs, a bounded score, viability category, and thresholds.
The exact schema rejects unknown fields and duplicate policy IDs. It contains
no title, media/provider ID, description, prompt, or free-text correction.
The parent computes the SHA-256 fingerprint from the validated input and
generates fresh opaque tokens. Labels and tokens stay in the parent; workers
receive only candidate inputs. Each worker returns indexed, typed dispositions,
which the parent validates before producing the existing private release-pair
artifacts and aggregate comparison. The private artifacts are written under
ignored `.tmp/`, never to logs or a public API.

The runner requires a clean checkout and verifies that the release tag resolves
to the pinned commit. It archives only `server/src` from that commit into a
temporary directory and runs the archived and current evaluators in **separate
containers** using the same locally present image ID. Docker runs have no
network, a read-only root filesystem and source mounts, no added capabilities,
no privilege escalation, a non-root UID, and CPU/memory/PID limits. No Docker
socket, live database, provider address, credentials, or writable host data is
mounted or forwarded. Release telemetry persistence is additionally disabled
by `NODE_ENV=test`; container isolation remains the hard boundary. The
temporary release source is removed after execution. Container stderr is
bounded and suppressed on failure to avoid private-content leakage.

The runner requires a locally installed `classifarr:test` image; it will not
pull or build one automatically. The image is resolved to its immutable ID at
run time. Its dependency set is
not attested against the published release, so the report keeps
`dependencyProvenanceVerified: false`. The outer report can attest that these
two decision subpaths executed, but the existing structure comparator still
keeps `releaseCodeExecutionVerified: false`,
`policyAndTrainingProvenanceVerified: false`, `fullPipelineAccuracy: null`, and
`promotionAllowed: false`. Only an `auto_classify` decision counts as a
destination; confirmation and selection prompts count as safety blocks, not
correct routes. Even these automatic decisions are **not** a full-route
success metric because later classifier stages are omitted.

Run the synthetic fixture after committing a clean checkout:

```text
node scripts/run-isolated-release-decision-pair.mjs \
  --input-file=scripts/fixtures/release-decision-pair.synthetic-example.json
```

Only use private, provenance-screened cases in a real run. Never commit its
input or `.tmp/release-pair-*` outputs. The previously added comparator can
re-read the generated artifacts independently.

## Alternatives and recommendation stack

| Option | Benefit | Limitation / decision |
| --- | --- | --- |
| Execute archived evaluator in live server | Simple | Can persist telemetry and reach live services; reject. |
| Node 24 permission flags alone | Restrict files and child processes | Does not establish network isolation on Node 24; reject as sole boundary. |
| Reimplement old ranking in current code | Easy unit tests | No longer executes the released code; reject. |
| Isolated archived decision replay (selected) | Executes real release decision logic, controls side effects, pairs cases exactly | Accepts precomputed scores; cannot estimate full classifier quality. |
| Full pinned-release classifier and evidence replay | Deployment-like comparison | Requires versioned evidence adapters, release dependencies, policy/training provenance and provider controls; next gate. |

Recommended stack: exact published commit → isolated/no-network release source
→ one frozen, provenance-screened input → label-blind workers → strict paired
artifact validation → aggregate movie/TV reporting → independent review.
Do not promote routing thresholds from this subpath result.

## Official sources checked in September 2026

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, metrics, limitations and deployment-like
  evaluation; omitted classifier stages must remain visible.
- [Git archive documentation](https://git-scm.com/docs/git-archive) describes
  extracting an exact commit tree, rather than trusting a mutable branch.
- [Docker run reference](https://docs.docker.com/reference/cli/docker/container/run)
  documents read-only mounts, network and resource controls, capabilities and
  `no-new-privileges`.
- [Docker seccomp guidance](https://docs.docker.com/engine/security/seccomp/)
  recommends retaining the default seccomp profile; this runner does not
  disable it.
- [Node.js CLI permission documentation](https://nodejs.org/download/release/v25.9.0/docs/api/cli.html)
  identifies network restriction via `--allow-net` as added in Node 25, so
  Node 24 permission mode is not the network boundary here.
- [W3C WCAG 2.2 status messages](https://www.w3.org/TR/wcag/) matter if this
  offline result is later surfaced in the Command Center. No UI changed in
  this increment; any future status text should be programmatically
  determinable without moving focus.
