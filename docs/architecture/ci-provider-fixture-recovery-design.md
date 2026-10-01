# Provider integration fixture recovery design

## Evidence

[Run 36927804801](https://github.com/cloudbyday90/Classifarr/actions/runs/36927804801)
tested revision `2a03f906bdaaafebc15151d10ba63435036aa394`. Build/unit validation and
fresh/published upgrade installation passed. Three database suites failed 31 tests;
the release acceptance readout correctly remained blocked.

The same three suites reproduced all 31 failures locally before changes:

- `inventoryTmdbObservation`: its temporary OMDb table lacks `id`, now needed by
  newest-active-configuration selection. SQL resolves the absent unqualified name
  against the surrounding join, where it is ambiguous.
- `inventoryObservationRepair`: its OMDb fixture lacks `api_key` as well as `id`.
- `metadataProviderConsolidation`: its historical replay removes credential columns
  but does not first remove the newer `enrichment_retry_provider_contexts` dependent
  view. PostgreSQL correctly refuses the column drop.

## Decision and tradeoffs

Update the minimal current-schema fixtures to include the columns the real query
uses. Add a newest-active-key regression so they test selection semantics, not merely
parse SQL. For historical replay, explicitly remove the additional known dependent
view inside the existing rollback-only transaction.

Benefits: preserves production SQL, immutable migrations, assertions and release
gates. Cost: hand-maintained historical fixtures still need review when later schema
dependencies appear. Do not add `CASCADE`, skip failing tests, raise timeouts or
alter the actual migration to make this historical fixture pass. A dedicated
historical schema fixture could reduce future drift but would be a broader test
infrastructure change, not needed to repair this run.

Only the disposable integration database is mutated. No production column or view
is removed. See the separate [outcome](ci-provider-fixture-recovery-outcome.md).
