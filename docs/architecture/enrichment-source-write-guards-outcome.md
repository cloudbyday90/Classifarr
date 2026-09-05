# Enrichment source write guards outcome

## Delivered behavior

OMDb rating backfills, final enrichment metadata and source-library history now
verify the source snapshot captured before provider work. Changes to source
server, external key, library, type, title, year, IMDb ID or TVDB ID reject a late
write. Each operation also checks its expected typed TMDb identity, including
the unresolved null state. Missing snapshots do not authorize source-item writes.

One shared ESM projection keeps those fields aligned with resolver provenance
writes. A separate persistence module owns rating and metadata SQL. Rating
normalization now derives its original value from the same locked row it updates;
there is no separate current-rating read that a concurrent writer can invalidate.
Unrelated metadata, normalized ratings and queue bookkeeping remain compatible
with the captured source.

Final metadata rejection completes the task as skipped and prevents history
persistence. Source-item history has its own conditional insert with a shared
source-row lock, protecting the interval after metadata was saved. A rejected
history insert also produces a source-change skip. Internal snapshots are
excluded from stored history metadata. Existing standalone history calls without
a source item retain their behavior. The configured database statement timeout
bounds lock waits and propagates timeouts as errors.

Earlier valid writes are not rolled back if the source changes before a later
stage. Normal source sync invalidates stale enrichment, and existing background
discovery handles missing observations. No new operator setup, provider calls,
scheduler, dependency or schema migration was introduced by the guard itself.
Current source fields are the identity evidence; an edit and reversal to identical
fields cannot be distinguished by this contract.

## Local Compose assessment

On September 5, 2026, a fixed hash sample selected 32 real typed inventory
identities: 16 movies and 16 TV items across eight active libraries. Source identity
fields were copied into connection-local temporary tables. Controlled ratings,
provider outcomes and source changes exercised the current ESM services and real
SQL. Every fixture write rolled back, and live inventory was only read.

| Measurement | Result |
| --- | --- |
| Real source items / libraries | 32 / 8 |
| Valid rating writes / valid metadata writes | 32 / 32 |
| Stale rating writes rejected | 32 / 32 |
| Stale metadata writes rejected | 32 / 32 |
| Direct stale history inserts rejected | 32 / 32 |
| Tasks skipped after source drift before metadata | 32 / 32 |
| Tasks skipped after source drift between metadata and history | 32 / 32 |
| History rows created by stale work | 0 |
| Provider network requests / live source writes | 0 / 0 |
| Fixture elapsed time | 335 ms |
| Temporary-table rollback verified | Yes |

This is regression evidence using real source shapes, not classification accuracy
or proof that the source identities are correct. It provides no independent human
labels. Semantic readiness and frozen-study gates remain in force; no semantic
counter-evidence, automatic routing or learning was enabled.

## Validation

Focused tests cover snapshot capture, invalid/missing evidence, null and known
TMDb identities, caller mutation, bound values, and private-field exclusion.
PostgreSQL tests change every guarded field and delete the source, verify valid
bookkeeping and rating updates, and exercise source drift between metadata and
history. Separate writer connections hold uncommitted source changes while rating,
metadata and history operations wait. Each rechecks and rejects the stale source
after the writer commits. History lock timeout is also verified without a late
insert. Observation-only tasks cannot write stale traits or advance their clocks.

| Check | Result |
| --- | --- |
| Full backend coverage run | 1,053 suites / 29,635 tests passed |
| Focused queue, snapshot and persistence regressions | 8 suites / 268 tests passed |
| PostgreSQL guards, retention, review, observation and history integration | 8 suites / 90 tests passed |
| Backend line / branch / function coverage | 90.07% / 80.41% / 92.71% |
| Coverage ratchet | Passed; unchanged client uses its existing report |
| Server/client lint and types | Passed |
| ESM imports and strict mock shapes | Passed |
| Knip code and production-dependency checks | Passed |
| Markdown and migration/snapshot integrity checks | Passed |
| Local Docker image build | Passed |

Frontend and public API contracts did not change. The local Docker image builds,
and the running Compose service retains its existing image. Changes are recorded
under Unreleased; package versions are unchanged and no release is created.

## Recommendations and tradeoffs

| Recommendation | Pros | Cons / limits |
| --- | --- | --- |
| Keep the shared captured-source contract at writes | Prevents known stale-result paths with no routine operator input | Exact source edits can discard otherwise useful results |
| Use atomic rating updates and short history source locks | Removes read/write gaps without locking during provider calls | Contention can wait until the configured database timeout |
| Reuse existing retry, observation and profile refresh mechanisms | Avoids another scheduler and repeated manual setup | Data can be temporarily incomplete while recovery runs |
| Add bounded cross-library overlap over current stored observations | Answers what exists, where, and what is common | Coverage and source errors limit the strength of comparisons |
| Keep semantic automation behind independent evaluation | Preserves a defensible boundary between observations and decisions | A small independently labeled study is still required |

The final recommendation stack is validated synchronized inventory → attributable
typed identities → source-guarded provider observations → automatically refreshed
profiles with known/missing counts → bounded library comparisons → independently
evaluated classification support.

This recommendation was subsequently implemented in the
[overlap design](library-overlap-design.md) and
[measured outcome](library-overlap-outcome.md).

**Next item at this assessment:** add a read-only, bounded cross-library overlap summary using shared
movie/TV identities and existing common-trait observations. Keep media types
separate, deduplicate repeated placements within each library, expose both
directions of overlap with explicit denominators, and report insufficient coverage
instead of treating unknown traits as negative evidence. Use existing inventory
and profiles, requiring no per-item operational input or new provider calls.

The separate [design](enrichment-source-write-guards-design.md) records official
PostgreSQL, W3C and OWASP sources, alternatives and the requested August 2026
research-date qualification.

## PR selection and delivery

GitHub's open-PR listing was empty on both checks. No closed PR was substituted
or merged. Delivery targets `origin/main` under the existing commit, push and
integration authorization, without creating a release.
