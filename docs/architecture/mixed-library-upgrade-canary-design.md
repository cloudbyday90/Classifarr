# Mixed-library upgrade canary — design

## Decision

The last-release schema replay protects structural compatibility, and the
earlier profile rehearsal proved one movie and one TV record can be refreshed.
Neither proved that several same-type libraries retain distinct inventory
profiles after migration, retry, restart, and inactive-library reactivation.

Extend that existing disposable rehearsal, rather than add a second migration
runner. Seed four synthetic libraries (two movie, two TV) with six inventory
items each into the pinned published-release schema. Leave one TV library
inactive until the active libraries have recovered from a transient worker
failure. Then run the production planner, outbox worker, profile observation,
publication, and profile-score paths against the migrated database.

Keep eight synthetic probes out of all inventory rows. Each probe must score
its expected same-media library strictly above the alternative. Two probes
with no differentiating traits must remain tied. Failure exits nonzero in
the database CI job, upstream of release acceptance. The output reports
revision-verified profile refresh, probe separation, and real-world
classification quality as **different** measurements. A successful synthetic
probe is not an operator correction, an end-to-end policy classification, or
evidence to lower automatic-routing safeguards.

## Alternatives and tradeoffs

| Option | Advantage | Drawback |
| --- | --- | --- |
| Keep the two-item rehearsal | Fastest | Cannot test same-type ranking or mixed-library backfill. |
| Replay a real operator database | Real inventory and corrections | Exposes private data, may cause writes, and is unsafe for CI. |
| Expand the disposable release canary (selected) | Exercises migration, backfill, retries, and observable profile separation without credentials | Artificial traits do not estimate real classification accuracy. |
| Gate releases on a private correction-labeled cohort | Measures deployment-like outcomes | A leakage-controlled, independently corrected set is not yet available to this CI job. |

## Boundaries and recommendation stack

1. Pin the release schema and require an empty, fixed-name disposable database;
   accept no live connection string, dump, or mounted application data.
2. Seed a bounded mixed inventory before migrations, then exercise durable
   enrollment, planner, retry, fresh worker instances, reactivation, and
   revision-checked publication.
3. Run non-overlapping synthetic probes through the existing profile scorer;
   fail on lost separation or an unsupported winner for ambiguous probes.
4. Keep `classificationQuality.status = not_measured` and
   `automaticRoutingAuthorized = false` until a separate, independently
   corrected, leakage-controlled evaluation proves quality. Do not call
   observed placements or synthetic genres ground truth.
5. Later evaluate a private, operator-corrected cohort with a frozen
   pre-upgrade baseline and a holdout by typed media identity/description.
   Report movie and TV errors separately, as well as abstentions and changed
   decisions. Do not train on its test cases.

This is a headless CI gate. No new browser UI is added. If its result is later
shown in the Command Center, show a concise accessible status and keep details
on demand; the [W3C WCAG 2.2 status-message criterion](https://www.w3.org/WAI/WCAG22/Understanding/status-messages/)
applies to dynamic web status messages, not this CLI output.

## Official source basis

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets and metrics, rigorous performance assessment,
  uncertainty, and conditions similar to deployment. This is why synthetic
  functionality checks cannot be presented as measured field accuracy.
- [scikit-learn's grouped cross-validation guide](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data)
  explains why related examples must not occur in both training and test
  groups. The canary's probes are never inserted; a future real cohort needs
  stronger identity and description-group exclusion.
- [PostgreSQL 18 MVCC guidance](https://www.postgresql.org/docs/18/mvcc-intro.html)
  describes consistent statement snapshots; the production profile publisher
  additionally locks and checks the inventory revision before publication.

Sources were checked in September 2026. These documents describe the
architecture as implemented, not a release or a claim of classifier quality.
