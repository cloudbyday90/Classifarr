# Group evidence readiness: outcome

## What changed

Classifarr now measures current external observations inside validated learned
content groups and uses a scheduler-owned, 30-minute private hint to prioritize
already-due gaps within each enrichment page. Priority alternates with ordinary
work. Successful enrichment clears the gap at the next verified refresh; changed
aggregate readiness is logged once, not on every poll. Existing retries, guarded
writes and automatic vector backfill remain authoritative.

Descriptions missing from inventory/history cannot be assigned a reliable group.
They are reported separately and stay in ordinary recovery. Invalid clocks,
inconsistent duplicate rows and observations over the readiness projection's
4 KiB limit are unknown, not assertions of malformed source data. Empty keywords
and unknown language are valid data. No extra user acknowledgement or UI panel
was added; existing SWR and keyboard pause behavior remain unchanged.

The implementation is split into observation projection, group readiness,
readiness ordering and training-term diagnostics. No database migration, new
provider, CommonJS, release, version bump or routing-authority change is included.
See the separate [design and research](group-evidence-readiness-design.md) and
[PR #538 validation](pr-538-client-tooling-validation.md).

## Re-evaluation of the previous commit

The preceding experiment correctly retained uncertainty but did not explain why
group terms were unavailable. This iteration diagnoses that result rather than
lowering thresholds. Cached-vector, zero-generation runs on September 19, 2026
repeated the same three disjoint 300-item query cohorts. All three completed and
passed post-run source verification, with all ten libraries retained as candidates.
The original cohort covers ten libraries / 150 movies and 150 TV descriptions;
the other cohorts cover the seven libraries with remaining unseen descriptions.

| Training result | Original 300 | Additional 300 | Fresh 300 | Total |
| --- | ---: | ---: | ---: | ---: |
| Group fits across five folds | 313 | 320 | 320 | 953 |
| Usable distinctive terms | 244 | 238 | 247 | 729 |
| No distinctive terms versus rivals | 63 | 75 | 67 | 205 |
| No terms repeated in three descriptions | 5 | 4 | 3 | 12 |
| Repeated terms are only common terms | 1 | 3 | 3 | 7 |
| Too few assigned examples / no rival groups | 0 | 0 | 0 | 0 |

These are **group-fit counts**, not unique groups or 953 new media samples. A group
can occur in several folds. The largest limitation is discrimination under the
current lexical learner: 205 of 224 unavailable fits. This does not prove semantic
indistinguishability, nor does it imply metadata is malformed or missing.

The combined and enhanced decision arms remain identical to the previous run:
676 comparisons, 608 historical-placement agreements, 68 disagreements and 224
abstentions across 900 cases. There are zero independent labels; measured accuracy
remains null. No thresholds were tuned against these results.

The live Compose scheduler initially reported 6,652 available descriptions,
10 ready libraries and 64 groups: 63 with current observations, one with gaps,
zero unknown groups, and two descriptionless identities outside the groups.
That is a point-in-time operational snapshot, not a completeness or accuracy claim
for every possible metadata field. It shows why repeated blanket enrichment would
not address most of the observed lexical limitation.

## Validation

- Focused recovery, projection, scheduler, benchmark and queue tests: 199 passed.
- Focused new/extended service coverage: 45 tests passed; 100% statements, lines
  and functions, 95.59% branches across six service modules.
- Real PostgreSQL integration: 3 suites / 26 tests passed, including automatic
  refill ordering → guarded enrichment → fresh snapshot → cleared readiness gap.
- Client coverage: 369 files / 5,128 tests passed; all 31 browser checks passed.
- Lint, server/client typechecks, build, copyright, ESM static-import check,
  dependency preflight, product-language, delivery-term and maintenance checks passed.
- Full backend coverage rerun: 1,304 suites / 37,929 tests passed. The coverage
  ratchet passed with no baseline changes.
- Local Compose build and smoke check passed with a healthy container and
  read-only root filesystem. After committing, the deployment procedure rebuilds
  with required clean-source provenance and verifies the running revision before
  push/handoff.

The first full backend run exposed one SQL column-order string contract. Column
order was preserved and the affected identity/queue tests passed without weakening
the assertion. The focused coverage command initially used the repository-wide
collection scope, so its global threshold result was not a valid focused coverage
gate; the full-suite coverage report remains authoritative.

One separate existing audit remains blocked: `policy:production-naming-gate`
reports 44 uses of `phase` in 16 existing files. Reading those files from prior
commit `08d1cbe8` produces the same 44 production references; this patch introduces
none. No baseline or gate was weakened. The previous commit's
[hosted CI](https://github.com/cloudbyday90/Classifarr/actions/runs/35443690056)
completed successfully; that does not mean every optional local audit is green.

## Reproduction and recovery

Run the existing read-only benchmark inside Compose:

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --group-contrast --max-minutes 15
```

For the other cohorts add `--exclude-prior-sizes 300,300,100,100` and
`--exclude-prior-sizes 300,300,100,100,300`, respectively. Fingerprint prefixes
remain `7f40e9ebf6f3`, `58ec647b494f` and `d8d72ac31cb2`. Source data, full private
reports, hashes, titles, descriptions and terms stay out of committed artifacts.

Shutdown, expiry and invalidation withdraw metadata hints. Failure leaves ordinary
refill available. Reverting the change restores ordinary order with no schema/data
rollback; existing recovery still works.

## Final recommendation and next component

Follow-up: the [semantic group comparison](group-semantic-comparison-outcome.md)
now records its verified evaluation and adoption decision.

Keep the small readiness services and existing guarded recovery queue. The benefit
is automatic, attributable recovery without retry storms or new controls; the
limitation is that ordering within a page does not increase global throughput or
make ambiguous content separable.

**Next: evaluate semantic contrast between competing learned content groups.**
Use their descriptions, nearby examples and attributable metadata to distinguish
overlapping destinations, without library-name assumptions. Freeze the comparison
before testing; retain exact-copy exclusion, full rival coverage, small-group and
movie/TV slices, and stable controls. Keep routing unchanged until there is evidence
of improvement beyond historical placement agreement. Do not keep tuning lexical
frequency or re-fetching already-current metadata to manufacture confidence.

Recommended stack: validated inventory → bounded automatic recovery → learned
groups and vector retrieval → semantic rival comparison → held-out evaluation →
existing routing authorization. Present only concise status and actionable
exceptions through the existing quiet SWR surfaces.
