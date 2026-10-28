# Prospective authorized-outcome integration design

Date: 2026-10-28. Status: both capture-identity and legacy-kind boundaries were
explicitly confirmed through grill-me and implemented. Follows the
[authorized-outcome evaluation outcome](authorized-outcome-evaluation-outcome.md).

## Observed gaps

The private `runInventoryOutcomeCalibration.mjs --prospective` path reads activity
and exact-history comparisons in one bounded, repeatable-read transaction. Its
repository still uses linked mutable feedback and raw correction events. It does
not read the new canonical authorized snapshots. Its correction join also removes
inactive/wrong-type destinations before conflict detection.

The persisted `inventory_description_company_shadow_v1` contains frozen numbers,
media type and description/training hashes, but no frozen typed item identity.
Identity is kept only in an in-process WeakMap. Persistence projects that capture
before awaiting preparation; the sibling original destination decision and history
identity are constructed afterward. Co-saving those objects cannot retrospectively
prove that their identities agreed across that await.

Legacy feedback outcome snapshots freeze typed identity and destination but have
no action kind. The mutable feedback flag measures selection against a shortlist
leader, which can differ from the original saved destination. Neither that flag
nor equality with a later/current destination proves an explicit confirmation.

## Recommended capture boundary

Mint a new ranking-shadow version containing immutable `identityKey` at the
existing trusted live comparison boundary. Require a positive, bounded TMDB ID
and movie/TV type. Keep the ranking formulas, weights, candidate numbers and
abstention rules unchanged. The private key is provenance, never a numeric model
input or a public report field.

Hold the original minted capture across asynchronous persistence preparation.
Recheck its identity against the actual inserted item identity immediately before
saving. On drift, omit only the diagnostic capture and consistently record
`not_captured/identity_mismatch`; classification continues. Do not fetch a
replacement capture from a mutated result.

Structurally valid v1 captures remain explicit unbound coverage, never repaired
into scorable identity through current history or a sibling metadata object.
Their frozen description hash and available strictly validated identity aliases
remain conservative exclusion evidence. Build connected holdout groups before
grading, then reserve the earliest capture per component, including an unlabeled
or unbound earliest capture. This prevents favorable retry selection and alias
bridges from depending on row order. Grouping aliases cannot become labels.

## Recommended observation boundary

Use small ESM modules for capture identity, prospective observation adaptation
and connected holdout planning, alongside the existing repository/reducer. Reuse
the established grouping pattern and strict snapshot readers; do not introduce
a generic framework or enlarge an orchestration singleton.

- Materialize the shared authorized projection once and associate observations
  by exact classification first. Validate full private rows and deduplicate tier
  aliases before comparing frozen identities or applying observation caps.
- Require the independently frozen rank identity to match an eligible frozen
  outcome identity. History, source-only identities and sibling context cannot
  repair a mismatch. Source-only outcomes stay unscorable for this TMDB-only
  experiment, including after a later TMDB attachment.
- Prefer authorized snapshots over their manual-correction aliases. Retained
  correction snapshots may supply known change evidence when exact class binding
  comes from a retained correction event or valid frozen context; require agreement
  when both exist. Never attach a correction snapshot by TMDB identity alone.
- Preserve missing snapshot, identity conflict, unknown kind and target
  availability through common exclusion checks. An unavailable contradictory
  destination cannot disappear and improve the surviving result.
- Legacy feedback without frozen action provenance remains an explicit
  unknown-kind coverage/exclusion record. Raw legacy rows without usable frozen
  identity/action evidence supply gaps and conservative holdouts, not scored
  labels. Do not infer kind from mutable flags or either experimental ranking.
- Keep confirmations and changes separate. Mixed known action kinds enter
  neither action-specific score; unverified/unknown evidence cannot be overridden
  by a favorable observation. Confirmations retain suggestion-bias limitations.
- Preserve canonical resolution event time, the thirty-day evidence window and
  the requirement that outcomes follow the persisted ranking event. A later tier
  receipt cannot refresh an old resolution. A deleted history ranking cannot be
  recreated from a surviving outcome receipt.

Keep 5,000 captures, 100 observations per capture, 64 candidates and 64 selected
library strata, existing query/lock/idle timeouts, millisecond precision, fixed
capture windows and separately reported outcome cutoffs. Apply sentinel limits
after event alias deduplication; do not silently truncate a population. No schema
migration was needed: the versioned payload uses existing private history JSON.

The implementation also validates the bounded 101-observation sentinel for
holdout aliases while preventing it from being scored. More than 101 input
observations fails the report; overflow cannot release an earlier capture's
aliases to a favorable retry. Nested PostgreSQL BIGINT identifiers use text, and
chronological ties compare exact canonical integer text.

## Official research and tradeoffs

Sources were discovered and read through connected MCP search/GitHub tools on
2026-10-28. The following are engineering applications, not compliance claims.

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) models derivation from evidence.
  Bind evaluation to independently frozen prediction and outcome entities.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  documents stable repeatable-read snapshots. Preserve the existing read-only
  multi-query transaction and its bounds.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls)
  supports keeping outcomes outside prediction/fitting and preserving conservative
  holdouts. No scikit-learn dependency is introduced.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports minimal retained/output data. Keep typed keys private and expose only
  anonymous aggregate coverage; never print titles, actors, metadata or tokens.

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Version new ranking captures with typed identity | Independent, inspectable binding | Old unbound comparisons lose scoring eligibility | Recommended |
| Treat sibling/current history identity as proof for v1 | More immediate apparent coverage | Cannot prove identity across original asynchronous save | Reject |
| Keep unknown legacy kinds as explicit exclusions | Honest action cohorts; no invented confirmations | Smaller usable sample until a future capture upgrade | Recommended |
| Guess legacy kind from mutable flags or original destination | Larger apparent action cohorts | Mixes different semantics and may relabel an actual change | Reject |
| Promote company weighting while joining evidence | Immediate behavior change | Confuses diagnostic coverage with validated routing benefit | Exclude |

Final recommended stack: identity-bound versioned predictions, canonical frozen
outcomes, strict exact-event adaptation, connected conservative holdouts,
all-source conflict rejection, separate action cohorts and aggregate gap reporting.
Routing, learning, provider calls, activity semantics and public APIs stay unchanged.

## Verification plan

Extend existing shadow, persistence, prospective reducer/activity and CLI tests.
Use disposable PostgreSQL for exact classification/type bindings, canonical-only
events, manual/tier alias deduplication before caps, retained correction snapshots,
legacy unknown-kind gaps, source-only attachment, expired/future/pre-capture clocks,
unavailable contradictions and malformed evidence. Test held original capture
drift, v1 earliest holdouts and transitive alias bridges independent of row order.
Verify private output redaction and unchanged frozen numerical choices.

Follow with appropriate server coverage, lint, types, dependency-usage, ownership,
ESM, Markdown, copyright and staged secret checks. The separately selected
[client PR design](client-tooling-pr570-design.md) defines its own verification.
No live database mutation, provider request, new branch, release or deployment.

## Automated modernization and historical recovery

The follow-up [placement-informed automation design](placement-informed-automation-design.md)
answers the subsequent automation/backfill questions. Current placement can inform
inferred library conventions and candidate ranking, but cannot establish the
original identity/action of a historical event. This implementation deliberately
does not populate missing snapshots from current membership or promote inferred
purpose into declared intent.
