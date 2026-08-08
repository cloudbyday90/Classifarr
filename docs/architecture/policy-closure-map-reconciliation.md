# Policy Closure-Map Reconciliation

Status: implemented by 8R.37.4.

## Intent

Policy storage closure produces two decisions with different evidence owners:

1. `implementationReadiness` establishes whether the checked-out repository
   contains the native policy implementation, documentation, tests, roadmap,
   release-note, and validation evidence.
2. `instanceCutover` establishes whether one installation has completed its
   compatibility-removal evidence and is safe to treat as fully cut over.

The earlier closure component catalog put installation-only compatibility
workflow identifiers in the repository implementation list. That made the
scope distinction visible in output but not fully enforced by the evidence
catalog. This task reconciles the catalog, checkpoint, artifacts, readout, and
current closure audit so each decision is evaluated from only the evidence it
owns.

## Research Basis

- NIST SSDF calls for secure development practices and verifiable provenance
  for release components. Repository readiness therefore needs a bounded,
  repeatable source-evidence catalog rather than deployment-specific state.
  [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
- NIST SP 800-18 Rev. 2 distinguishes operational status, responsible parties,
  and authorization boundaries. An installation's cutover result is an
  operational conclusion, not a claim about the source implementation.
  [NIST SP 800-18 Rev. 2](https://csrc.nist.gov/pubs/sp/800/18/r2/final)
- OWASP logging guidance favors bounded, meaningful audit fields. Closure
  artifacts retain only stable component IDs, scope, counts, status IDs, and
  risk IDs, not source text, secrets, database rows, or media details.
  [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- GitHub artifact attestations require verification before provenance is
  trusted. Classifarr continues to bind the closure map into its replayable
  SHA-256 artifact projections; a future signed CI-attestation integration can
  add authenticity without changing the scope contract.
  [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations)

## Options Considered

### One Combined Component Catalog

Pros:

- a single list is initially easy to enumerate.

Cons:

- installation-only compatibility workflow evidence is treated as repository
  implementation work;
- release readiness becomes dependent on an operator-specific cutover state;
- the output can show two scopes while the input contract still conflates them.

Decision: rejected.

### Infer Installation Cutover From Repository Files

Pros:

- repository checks remain simple to run in CI.

Cons:

- source files cannot prove one database's conversion, approval, backup,
  rollback, or compatibility-removal state;
- would weaken the fail-closed destructive-operation boundary.

Decision: rejected.

### Scoped Repository Catalog And Installation Cutover Map

Pros:

- repository readiness is portable and environment-agnostic;
- installation cutover remains mandatory for final storage closure;
- validators and fingerprints can reject a relabeled or incomplete map;
- runtime automation remains independent of source retirement.

Cons:

- consumers must use the explicit two-scope result instead of assuming one
  readiness value proves final closure.

Decision: selected.

## Final Recommendation Stack

1. Maintain a pure scope-map service with a static list of installation-only
   compatibility workflow identifiers.
2. Derive repository implementation components by excluding those identifiers
   from the full historical closure catalog.
3. Accept only repository-scoped artifact-map entries in the source evidence
   evaluator, including when a caller supplies a custom map.
4. Require the checkpoint and evidence-run validators to compare component IDs,
   counts, scopes, and the required-for-final-closure flag exactly.
5. Carry the same component scope map through the checkpoint artifact, final
   closure readout, and current closure audit.
6. Bind the map in checkpoint and current-audit fingerprint projections.
7. Keep final storage closure strict: repository readiness plus active
   installation cutover are both required, while neither normal policy
   conversion nor runtime automation consumes the closure artifact.

## Implementation Outcome

- Added `policyStorageClosureComponentScopeMap.mjs`, a pure ES module that
  classifies the nine compatibility-removal workflow identifiers as
  `active_installation` evidence and all other catalog entries as `repository`
  evidence.
- `policyStorageCompletionCheckpoint.mjs` now exposes only repository
  components as its implementation contract and rejects a malformed scope map.
- `policyStorageClosureEvidenceRun.mjs` filters active-installation entries
  from custom and built-in repository artifact maps, emits scoped component
  evidence, and verifies exact map membership before accepting output.
- Versioned checkpoint, evidence-run, artifact, final-readout, collector, and
  current-audit contracts now retain the component scope map and bind it into
  replayable fingerprint projections.
- Focused tests prove that installation-only identifiers cannot enter
  implementation readiness, cannot be omitted from final cutover scope, and
  cannot be relabeled after fingerprinting.

## Security Outcome

The reconciliation adds no route, scheduler, browser action, database write,
filesystem write, Git operation, or source-mutation capability. It uses only
fixed identifiers and bounded counts in its map. Automatic native policy
conversion remains server-owned, transactional, and installation-agnostic;
repository retirement remains a reviewed release concern.
