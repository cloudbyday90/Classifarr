# Policy Compatibility Deletion Runtime Evidence Escalation

## Intent

Compatibility cleanup normally relies on the runtime-evidence reference already
bound into a fresh execution-plan artifact. Starting an embedded runtime helper
for every preflight would expand Docker and database access without improving a
current, valid reference. Conversely, a missing or stale reference must never
be replaced with a host assertion, a mutable image tag, or an unchecked
container claim.

This component adds a small, deterministic escalation contract to the
preflight evidence artifact. It decides whether retained evidence is sufficient,
a provenance-bound embedded probe is required, or the preflight must remain
blocked. It does not start Docker, contact PostgreSQL, approve a manifest, or
perform a deletion.

## Official-Source Research

- Docker documents read-only filesystems, dropped capabilities, security
  options, mounts, container networking, resource limits, and image references.
  The existing maintenance runner already applies those controls with an
  immutable local image ID, a revision-matched OCI label, a read-only source
  mount, and one narrow .tmp output mount. Docker also documents that digests
  are immutable whereas tags can move.
- PostgreSQL documents that read-only transactions disallow data-modification
  and schema-changing statements. The existing helper sets
  default_transaction_read_only=on and a bounded statement timeout through
  PGOPTIONS; an escalation does not introduce a writable database path.
- OWASP recommends least privilege, no Docker socket exposure, dropped
  capabilities, resource bounds, and read-only filesystems for containerized
  work. The escalation reuses the existing helper instead of duplicating a
  weaker runner.
- NIST SP 800-190 identifies runtime isolation, configuration management, and
  auditability as container-security concerns. The decision is retained in the
  fingerprinted preflight artifact as bounded state IDs, not as raw container
  metadata or an implicit host observation.

Sources:

- [Docker container run reference](https://docs.docker.com/reference/cli/docker/container/run/)
- [Docker image digests](https://docs.docker.com/dhi/core-concepts/digests/)
- [PostgreSQL client connection defaults](https://www.postgresql.org/docs/current/runtime-config-client.html)
- [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [NIST SP 800-190](https://csrc.nist.gov/pubs/sp/800/190/final)

## Options Considered

### Probe Every Preflight

Pros:

- maximally current runtime observation.

Cons:

- requires Docker and embedded database access when current bound evidence is
  already sufficient;
- increases operational failure modes and host privileges;
- turns a bounded exception path into routine behavior.

Decision: rejected.

### Trust Retained Evidence Indefinitely

Pros:

- no helper execution.

Cons:

- stale or missing runtime state can be mistaken for current evidence;
- cannot distinguish evidence freshness from an operator assertion.

Decision: rejected.

### Request A Provenance-Bound Probe Only For Safe Missing Or Stale Evidence

Pros:

- preserves the normal no-helper path for current retained evidence;
- limits runtime access to a known evidence gap;
- preserves the existing revision, containment, read-only database, and
  resource-bound runner;
- blocks invalid or unrelated preflight conditions rather than treating a probe
  as a generic repair tool.

Cons:

- an operator must run the existing maintenance evidence command before
  regenerating the execution-plan artifact;
- an image without a matching immutable revision label intentionally blocks.

Decision: selected.

## Decision Contract

policyCompatibilityDeletionRuntimeEvidenceEscalation.mjs consumes only the four
bounded preflight observation statuses: execution-plan artifact, checkout,
manifest, and runtime evidence.

| Preconditions | Runtime evidence | Decision |
| --- | --- | --- |
| Artifact, checkout, and manifest are observed | observed | retained_runtime_evidence_sufficient; continue to the normal execution gate. |
| Artifact, checkout, and manifest are observed | missing or stale | embedded_runtime_probe_required; collect new evidence through the existing hardened maintenance runner, then regenerate the execution-plan and preflight artifacts. |
| Any non-runtime prerequisite is not observed | Any | blocked; repair source, artifact, or manifest evidence first. |
| Runtime evidence is invalid or unrecognized | Any otherwise-valid prerequisite state | blocked; do not interpret it as safe-to-refresh evidence. |

The resulting record has a version, status ID, bounded reason IDs,
runtimeProbeRequired, and a semantic next-step ID. It contains no image tag,
container identifier, database URL, command, environment value, exception, or
raw runtime result. It is included in the preflight artifact fingerprint and
revalidated from the stored observation statuses. Altering it cannot create a
ready preflight claim.

An escalation is an instruction to collect evidence, not authority to execute
the helper automatically. The existing maintenance runner remains the only
supported embedded-runtime probe. It requires a clean reviewed checkout, a
running explicitly named container, a local immutable image ID whose OCI
revision label exactly matches HEAD, read-only source and filesystem, dropped
capabilities, no-new-privileges, resource limits, no Docker socket, and
read-only PostgreSQL defaults. If any check or the runtime query fails, it
returns a blocked or failed result and the execution gate remains closed.

## Implementation Outcome

Implemented:

- a versioned, deterministic runtime-evidence escalation contract with three
  explicit states: retained evidence sufficient, embedded probe required, and
  blocked;
- preflight artifact v2, which fingerprints and revalidates the bounded
  escalation result alongside existing artifact, checkout, manifest, and
  runtime-reference observations;
- semantic preflight next steps that distinguish normal gate completion,
  contained runtime-evidence collection, and non-runtime preflight repair;
- focused tests for current evidence, missing/stale escalation, invalid runtime
  evidence, unsafe prerequisite states, unknown status input, and serialized
  escalation tampering.

Not implemented:

- automatic helper execution, Docker-socket access, application-container
  execution, or host PostgreSQL access;
- runtime probes for invalid artifacts, dirty checkouts, or unsafe manifests;
- approval, recovery, stance, routing, migration, or deletion authority.

## Final Recommendation Stack

1. Reuse a current retained runtime-evidence reference whenever its bound
   artifact, checkout, and manifest observations are all valid.
2. Escalate only missing or stale retained runtime evidence with otherwise-safe
   preflight prerequisites.
3. Use the existing provenance-bound, read-only maintenance runner for every
   escalation; never substitute host, mutable-tag, or caller-provided claims.
4. Fail closed for invalid evidence, image-provenance failure, unavailable
   containment, runtime-query failure, or any unrelated preflight defect.
5. Regenerate the execution-plan and preflight evidence artifacts after a
   successful probe; retain the separate recovery, approval, and final-stance
   gate requirements.

## Next Step

Proceed with the next incomplete Phase 8R containment task only after this
contract is verified in the full execution-gate path. The next likely candidate
is an explicit evidence-lifecycle or recovery edge case, not a broader apply or
automation path.
