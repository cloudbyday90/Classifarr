# Prospective current-policy review frame design

November 12, 2026 Eastern. The baseline on main is
`e44c7c4eeddf4c25e90688f355b2d50ee8db5057`.
Q1 confirms saved policy evidence for future accepted non-adopted RAG results.
Q2 confirms the storage, limits, disclosure and lifetime described below.
Q3 confirms the complete publication, mutation, reader and verification contract.
All three decisions are agreed; implementation follows this boundary.

The [investigation](retained-rag-context-investigation.md) reproduces why old
root `metadata.policyResult` can still drive the saved recommendation despite
fresh current ranking in `classification_details`. A returned-context priority
change alone does not repair that reader.

## Confirmed first consumer

Use the existing pending-review surface for new accepted non-adopted RAG
results. Keep original automated-decision evidence distinct and leave historical
rows unchanged. Existing scoring, provider-call budgets and routing/learning
authorization remain separate. New recommendations, score explanations and
presentation-inclusive answer-contract fingerprints can change.

Do not add another page, operator CLI trigger, setting, job or provider call.
Keep adopted/initial/generic verification, retained `signalContext` cleanup,
inherited old AI-advisory cleanup and historical reconstruction separate.

## Agreed saved boundary

Store one versioned closed current-policy review frame inside the existing
`classification_details` metadata of the newly inserted History row. Preserve
root `metadata.policyResult` as retained first-pass data; never silently replace
that reference for legacy replay, historical feedback or learning consumers.

The frame is associated with the actual classification row ID and typed movie/TV
item, not just the same title or matching library names. Use canonical database
BIGINT text for the classification ID and the existing typed-item/positive-ID
helpers. Source policy/library pairs and native revisions remain explicitly
separate from the final outcome. A pending row's top-level `library_id:null` is
normal; it does not mean its proposed destination is missing.

The saved frame uses these bounds.

| Data | Limit or contract |
| --- | --- |
| Retained numeric ranking | Complete ordered list, at most 64 candidates |
| Detailed current evidence | At most five leading candidates, matching existing saved detail coverage |
| Five-row evidence cards | Closed existing v2 source/state/status and purpose categories |
| Score explanations | Closed existing v1 numeric mechanics, at most six components |
| Additional support facts | Fixed category IDs only, without raw retrieval matches |
| Entire frame | At most 64 KiB encoded, including binding and status |

Preserve actual candidate scores and thresholds separately from overall policy
confidence. Names needed for display continue to come from the existing bounded
question destinations. Include no raw purpose rules/terms, diagnostic bodies,
titles, retrieved content, provider text, endpoint details, actor IDs or secrets.
Do not create new stored candidate-bound verification identity evidence; that
existing projection remains status-only.

A present invalid, incomplete, copied-to-another-row or overflowing frame must
not fall back to first-pass evidence as if it were current. Use the existing
explicit-destination-selection/unavailable presentation. When the new field is
absent, older records retain their existing behavior. Do not infer missing
historic proof from current configuration or matching public fields.

The frame lives with its History row. Retry lineage, supersession and manual
outcomes retain the old pre-operator evidence on that old row. Retry payloads
must not carry its proof to the replacement. Configuration restores preserve
surviving History evidence without reinterpreting historical IDs through new
policies. History deletion removes it. Existing portable backup sections exclude
History, so this proposal adds no backup export.

This is deliberately not the separate policy-capture child's thirty-day lease.
No new expiry task or tombstone system is proposed. The cost is bounded extra
storage for the lifetime of each affected History row; it is not a claim of
bounded total History retention.

Bind the row ID inside the existing INSERT transaction and statement rather
than issue a second database round trip. A modular SQL leaf can allocate the
normal sequence value once and use it for both inserted ID and frame binding.
Keep the ordinary writer path unchanged outside this new scope. Sequence gaps
on rollback remain normal; do not use `MAX(id)`, a shared `lastval` guess or an
uncertain INSERT replay. This is a proposed scoped SQL change, not permission
for schema migration, production writes or a new transaction policy.

## Accepted-result publication agreed in Q3

Capture the bounded review mechanics immediately after the genuine reevaluation
fulfills, before later callbacks and provider work. The seed holds the actual
ordered numeric ranking, action, overall confidence, policy/library origins and
the five leading candidates' closed card, score and support projections.
Use own data fields and bounded inspection with exact primitive types.

Purpose categories come from the existing genuine immutable policy-evaluation
capture v2 for that retained result, ranking and typed item. Missing purpose
proof produces the existing unknown purpose categories. Optional unavailable
score mechanics use their existing null/unavailable representation. Required
numeric binding, ranking completeness and byte admission determine whether the
whole current frame is available.

Existing card and score producers supply the presentation mechanics. New strict
stored-object validators check exact keys, enums, primitive numeric values,
candidate associations and encoded size. Their limits admit legitimate producer
rounding. Six score-100 components at weights 1/6 produce base score 100.2 and
displayed weights summing to 100.2.

Associate the seed privately with the actual non-adopted rerun candidate after
the existing AI-service result acceptance. The final RAG owner publishes it when
the existing comparison selects that exact candidate in apply mode and the
rollout await has fulfilled. At publication, recheck the original live reference
and exact result destination, confidence, method and policy association.

The published frame describes the selected policy evaluation. Current fulfilled
CONFIRM, ABSTAIN, invalid-output and capability-refused results can each carry
that evaluation when the final comparison selects them. Existing verification
status continues to describe its own provider outcome.

Use explicit private receipt transfer for the final RAG copy and PolicyPath's
success copy. Recognize a selected evidence attempt across further copies so
that missing receipt authority produces an explicit gap. The current frame
requires the genuine owner receipt and matching result. Shadow and comparison
rejection return the baseline through their existing paths.

Persistence holds the receipt at entry, checks it after state derivation and
checks it in the insertion callback immediately before serialization. Validate
the original typed item, retained policy/ranking and selected result association.
The pending row's proposed destination is checked through the bound result and
frame while its ordinary saved destination column is null.

An observed binding or inspection failure is latched for that evidence attempt.
Store a small row-bound gap representation through the same writer. This keeps
the selected classification and its actual provider observations available to
the ordinary lifecycle. Genuine rejected rollout, question, lifecycle and INSERT
operations continue through their existing error handlers.

Once the INSERT has succeeded and its transaction has acknowledged completion,
the exact saved projection supplies in-process notification metadata. Its row ID
and frame contents reflect that completed write. SQL and acknowledgement failures
follow the existing transaction and uncertain-outcome rules.

## One review-only source

A shared resolver should serve the recommendation reference, action/threshold
presentation, score explanation, five-row card and comparison profile. Replace
their three independent root-policy lookups consistently. Avoid mixing a new
score with old candidate diagnostics or historical adjudication data.

Use the same source in pending GET, answer-contract recomputation, web/bulk
confirmation and both immediate Discord notification paths. Supply the exact
saved projection in process through the existing notification metadata
arguments. Current Discord contract construction already includes the typed
TMDB identity.

Validate the frame against the actual classification row ID, typed item and
recorded classifier method before selecting its policy view. The current policy
leader must belong to the existing question's permitted candidate set. Missing
membership, ties, invalid current data and explicit evidence gaps use the
existing selection-required presentation. The resolver also supplies the same
current cards and score mechanics to the comparison profile. Historical
advisory/adjudication fields retain their historical evidence meaning.

Preserve normalized question destinations, context-version dependencies,
active/media destination checks, confirmation/change meanings and stale-state
rejection. Exact completed/routed answer-receipt recovery must run before any
new saved-frame validation; do not reinterpret old successful receipts or cause
a second route/learning effect.

## Row-binding feasibility controls

A private probe ran through the production database factory against the existing
disposable PostgreSQL integration fixture. All four controls passed.

1. A materialized CTE allocates the table's sequence value once. One INSERT uses
   it as the row ID and the canonical text binding inside JSONB.
2. Twenty concurrent transactions above JavaScript's safe-integer range return
   distinct exact BIGINT strings whose saved JSON bindings match their row IDs.
3. Rollback removes the inserted row and frame together. The subsequent insert
   receives its ordinary later sequence value.
4. The migrated History table accepts the same one-statement binding with its
ordinary awaiting-decision state and null destination column.

The probe also checks that its input metadata retains the original policy
value. Its first invocation hit a Jest import-resolution issue in the private
harness. The corrected import completed all four controls. Probe receipts are
under `.tmp/retained-rag-context-assessment`. The integrated production-path
verification is recorded in the [outcome](current-policy-review-frame-outcome.md).

## Verification and delivery agreed in Q3

Prove actual fresh evaluation through final apply, persistence, pending HTTP,
fresh answer/replay and immediate Discord contract construction. Use the real
evaluator, production-factory isolated PostgreSQL and loopback providers.

Test same/different destinations; overall confidence versus candidate score;
CONFIRM/ABSTAIN/invalid/capability refusal; apply/shadow and comparison rejection;
copied/cross-row/cross-item/missing/late/overflow/mutated evidence; row-ID precision;
closed-field and rounding limits; pre-insert waits; concurrent pending supersession;
rollback and lost acknowledgement; retry/manual outcome/restore lifetime; existing
initial/adopted/legacy and route/learning boundaries. Preserve browser assertions
and run fresh affected coverage plus normal quality/ownership/security checks.

Maintain artifacts through the existing skill. Retain PR 589's demonstrated
compiler deferral while its published artifact is unchanged. Rebase only a
genuinely stale applicable branch. After full agreement and implementation,
write a separate outcome and Unreleased entry, commit/push all intended changes
on main, and inspect exact-source CI. Create no release or deployment.

## Research and tradeoffs

Official sources were discovered through MCP and inspected November 12:

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/): name original and current
  derivation sources explicitly. This design is application-specific, without
  a PROV conformance claim.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  keep provenance and fixed projections separate from model authority.
- [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  preserve server-side, stale-state and replay checks despite presentation changes.
- PostgreSQL [sequence](https://www.postgresql.org/docs/18/functions-sequence.html),
  [INSERT](https://www.postgresql.org/docs/18/sql-insert.html) and
  [JSON](https://www.postgresql.org/docs/18/functions-json.html) documentation:
  use one database-assigned identity and normal transactional semantics; sequence
  values need not be gapless. No database version update is proposed.

| Choice | Advantage | Cost |
| --- | --- | --- |
| Closed current frame in the existing row | Atomic association, no new read/job/UI, original evidence stays distinct | New strict projection/reader contract and bounded per-row storage |
| Separate expiring child | Explicit lease and removal boundary | More schema/read/lifecycle work; pending evidence may expire |
| Overwrite original root policy data | Fewer reader changes | Conflates references and broadens legacy/history/replay behavior; not recommended |

Recommendation stack: implement the agreed prospective saved frame and shared
reader; verify the accepted handoff and exact replay; then address retained
result-context/advisory inheritance separately. Broader initial/adopted/legacy
changes need their own evidence and scope.
