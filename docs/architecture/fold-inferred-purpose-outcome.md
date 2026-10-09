# Fold-local inferred purpose evaluation: outcome

Date: 2026-10-09. See [design, sources and tradeoffs](fold-inferred-purpose-design.md).

## Implemented

The automatic offline replay now rebuilds recognized inferred-only native purpose
rules from the existing fold-local observation profile. Stored inferred values do
not enter the rebuilt purpose. Declared restrictions remain in force, while mixed,
unknown, invalid, sparse and profile-restricted cases keep the exclusion fallback.
The separately invoked prospective held-out study is unchanged.

Policy report v2 records `inferredPurpose: fold_training_only`; v1 remains readable.
New computation/history fingerprints separate this experiment from old results,
and a legacy policy report is never reused as the new result. Command Center copy
explains the new preparation and the remaining limitations. No schema change,
live policy rewrite, AI budget increase, provider request or routing write was
introduced. Fold caches are per-arm weak maps, not retained global state.

## Verification so far

- Focused final regressions: 38 tests passed across three suites. The real worker
  prepares movie and TV comparison requests from an ambiguous synthetic fixture,
  but makes no provider calls. A separate deterministic fixture exercises ordinary
  policy decisions. Stored inferred values do not appear in prepared requests.
- Training checks exclude corrected identities and their copied descriptions in
  every fold, preserve each arm's source-only exclusions, and compare regenerated
  purposes with the shared production builder. Input objects remain unchanged.
- Four PostgreSQL integration suites: 45 tests passed, covering source-pair
  execution, history persistence/readback, window progression and cached replay.
- Lint, server/client type checks, both Knip modes, 40 tooling checks, copyright,
  ESM checks, Markdown and ownership drift checks passed. Existing ownership
  analysis debt is unchanged; the audit is not blanket writer authorization.
- [PR 556](node-types-pr-556-outcome.md) was randomly selected from open PRs,
  applied locally and rejected by the existing Node-major check before install.
  Node 24 dependencies remain unchanged; no PR was merged.

Full coverage, no-cache local Docker rebuild and isolated schema verification are
pending at this source checkpoint. Final verification will be recorded below;
the checkpoint is not a release or a claim that deployed Unraid is fixed.

## Recommendation and next item

Keep this fold-trained evaluation with explicit provenance: it recovers useful
coverage without allowing the tested item to train its own purpose. The cost is
that it measures a retrained policy, not the exact stored policy, and insufficient
training remains unsupported. Coverage and observational corrections are not
independent accuracy measurements.

After deployment, measure the inferred-only cases again before considering any
administrator-approved capture budget. Obtain independent reference labels before
making quality claims. For the separate tooling queue, review Knip 6.41.0; do not
advance Node declarations to a different runtime major just to clear an open PR.
