# Coverage-aware library profile publication outcome

Date: 2026-09-13. Scope: automatic background profile learning and shadow comparison.

## Finding and implementation

The previous commit (`03735a23`) unblocked healthy description backfill, but three
profile-publication boundaries still required every vector globally. A single
deferred description could prevent unrelated libraries from publishing profiles.

The new ESM coverage service resolves membership before counting available
vectors. Each library needs at least three distinct, exclusive descriptions and
90% availability among its eligible exclusive descriptions. Shared descriptions
and duplicate copies cannot manufacture support. Library names are not features.

Ready libraries can publish while other libraries retain explicit waiting or
sparse placeholders. Every destination in a comparison must pass the readiness
check; an unavailable candidate is never dropped or assigned an invented score.
The existing multi-start, convergence, minimum-support and tie checks still apply.
Coverage readiness alone does not mean a usable geometric comparison exists.

Source keys now include vector presence alongside full membership and geometry.
Backfill, expiry, membership changes or representation changes invalidate the
previous snapshot. Publication rechecks current inputs atomically. Scheduled
reconciliation picks up recovery without a user action; existing five-minute
quiet intervals, foreground-work admission and failure backoff still apply.
The publisher does not generate embeddings itself.

A separate ESM result validator binds returned coverage, candidate scope and
support to the source snapshot. Present malformed or extra-scope vectors remain
errors, not missing evidence. Fixed worker code, an empty worker environment,
memory/work limits, cancellation and bounded aggregate projection remain intact.

The internal profile and shadow-counter contracts are v3. Partial-data agreement
and disagreement have separate counters; under-covered comparisons have their
own non-comparison reason. The client accepts valid v2 snapshots during deployment
and rejects malformed v3 payloads. No HTTP endpoint was added.

The existing Library learning disclosure explains partial comparisons only when
they exist. SWR refresh, local pause/resume and permission-loss clearing remain.
The polite status region is explicitly atomic and does not announce each counter
change. No new panel, setting or acknowledgement was introduced.

## Verification and observed outcome

- Focused backend regression: 13 suites / 189 tests passed.
- Real PostgreSQL integration: eight tests passed, including publication from
  19 of 20 synthetic movie/TV descriptions, backfill to complete coverage, vector
  expiry withdrawing one library while the other remained ready, and recovery.
  Tests use connection-local temporary tables, not the user's media records.
- The rebuilt Compose image passed a separate 40-description probe spanning two
  movie and two TV libraries. Three actual worker-thread fits exercised partial
  comparison, healthy-library progress, an under-covered candidate, exclusion of
  a known description whose vector was missing, backfill to all 40 descriptions,
  source-key replacement and foreground-work yield/resume. It performed no
  inference calls or real inventory writes. Its repository fixture was in memory;
  the separate PostgreSQL test establishes database behavior.
- Browser inspection of the rebuilt Command Center confirmed the Library learning
  card remains compact, its measurement disclosure starts closed, keyboard Space
  collapses it with focus retained, and pause/resume returns to automatic refresh.
  The real page had no new shadow observations after restart; nonzero partial
  rendering and permission clearing are covered by component tests, not claimed
  as live-library outcomes.
- Repository preflight, dependency checks, server/client type checks and lint,
  ESM import/mock checks and documentation lint passed.

Full backend regression passed 1,293 suites / 37,532 tests. Full frontend
regression passed 368 suites / 5,120 tests. Backend coverage was 90.15%
statements/lines, 82.59% branches and 92.23% functions. Frontend coverage was
85.61% statements, 77.56% branches, 85.08% functions and 87.66% lines. The combined
coverage ratchet passed without threshold changes.

These checks establish publication and recovery behavior, not improved semantic
accuracy. No held-out media benchmark or model training was performed in this
slice. There are no live routing, schema, dependency or product-version changes.

## Recommendations and remaining tradeoffs

Adopt the [researched design and recommendation stack](partial-library-profile-design.md):
validated cached vectors, full-membership coverage accounting, bounded isolated
fits, source-bound publication, all-candidate comparison, separate partial
counters and the existing accessible SWR presentation.

Benefits: one deferred item no longer blocks every library; recovery is automatic;
missing data is visible without adding routine user work. Costs: more coverage
bookkeeping, separate diagnostic counters and potential bias in incomplete
profiles. Any source change still refits the current bounded snapshot; per-library
fit reuse is not implemented here.

The 90% threshold is an engineering starting point, not a confidence score or an
officially prescribed threshold. The missing 10% could contain an entire minority
topic. Three descriptions retain the existing geometry minimum but do not prove
that a library's content is well represented.

**Next component: a held-out coverage-robustness benchmark across movie and TV
libraries.** Reuse the existing cached inventory evaluation corpus, exclude all
held-out identities/descriptions from fitting, and compare complete profiles with
random and topic-concentrated missingness. Report ranking changes, wrong-library
choices, abstentions and per-library coverage separately. Use those results to
validate or revise the threshold before considering any live routing change.
Do not treat previous unconfirmed placements or library names as ground truth.

## Delivery and rollback

GitHub MCP search and the direct open-PR collection both returned no open
Classifarr PRs. No PR was applied or merged. All six workflows for predecessor
`03735a23` completed successfully. No release, tag or product-version bump is part
of this change.

Rollback is code-only: previous code rebuilds the ephemeral profile cache under
its older contract. Existing validated description checkpoints and the durable
retry journal remain usable; no data deletion is needed.
