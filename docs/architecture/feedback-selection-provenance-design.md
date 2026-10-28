# Feedback selection provenance design

Date: 2026-10-28. Status: shared scope confirmed; implemented locally.
Validation and delivery are recorded in the [outcome](feedback-selection-provenance-outcome.md).
Follows the [automatic evidence audit](automatic-evidence-gap-audit-outcome.md).

## Problem and established boundaries

The two feedback intakes record an explicit destination selection. Neither request
expresses a separate confirmation/change command or binds the request to a
previously served reference. Both derive the mutable raw feedback correction flag
from `classification_details.ranked_candidates[0]`. That shortlist reference can
differ from the saved classifier destination and current placement.

The v1 receipt snapshot freezes typed TMDB identity, the selected destination and
optional saved-decision context. It does not freeze action/reference provenance.
The prospective adapter correctly treats it as unknown-kind evidence. Current
placement, later raw flags and either experimental ranking cannot repair that
missing proof. The earlier agreement against inferred action kinds still applies.

## Recommended first batch

Capture a versioned **selection** snapshot through the existing receipt writer,
inside the successful feedback transaction. Do not call shortlist equality an
explicit confirmation or inequality an explicit change command. Keep both legacy
v1 and new selection-only evidence outside the two existing frozen prospective
scored action cohorts.
Expose a separate selection-only coverage reason so known selection semantics do
not appear under the label "Unknown legacy action kind".

No new action endpoint, serving receipt, provider call, historical import, ranking
formula, routing authority or generalized learning behavior belongs to this batch.
Existing retrospective feedback statistics, calibration and saved-decision overall
selection agreement remain unchanged. Existing feedback/pattern/statistics effects
remain the existing command effects;
the new provenance does not authorize additional effects.

## Capture and storage contract

Use small versioned contract/projection modules, called by `recordFeedbackSource`.
The receipt writer already receives the locked history row before prompt history
mutation, and already checks its exact classification binding. Both standalone
and prompt intakes commit feedback and the receipt atomically.

Freeze only bounded, content-free values:

- A new snapshot version, the exact classification ID as canonical positive int64
  text, existing movie/TV TMDB identity and validated selected destination.
- The actual action `selection` and its server-owned intake, bound to the receipt.
- A specifically named commit-time server shortlist reference, containing only
  the strict first ranked destination ID when available, plus a consistent
  match/difference/unknown relation to the selected destination.
- The existing optional original saved-decision context, with its existing
  eligibility requirements. It is a different reference and must not replace a
  missing shortlist reference.

The reference proves only what the server held at commit. It does not prove what
the browser displayed, that the reference library was active/type-valid then,
that media was moved, or that either destination is independently correct.
Missing/malformed reference IDs remain unknown; never search later candidates or
fall back to saved destination, history library, current membership or score order.
No additional reference-library lock is needed for this limited claim. Adding a
lock after history would invert the established policy/library/history order.

Use the existing 1,024-byte JSON field and thirty-day receipt-clock retention.
The new exact int64 binding must not inherit the old optional decision-context
validator's int32 classification-ID limit. Unsupported identities keep the
existing missing-evidence behavior; no source-only identity expansion is implied.
Existing raw feedback acceptance stays unchanged, including prompt failures for
malformed raw references. Capture applies to successful commands; it does not
silently broaden those commands or change their learning semantics.

Add database immutability protection with a migration and regenerated fresh schema.
Preserve receipt identity, intake, fingerprint and original clock; prevent snapshot
replacement or rehydration through UPDATE. Permit evidence clearing and feedback
FK tombstoning needed by retention/privacy cleanup, without reopening replay.
The guard does not rewrite legacy rows or convert them into v2 evidence. Preserve
the feedback/source receipt backup exclusions.

## Shared readers and administrator visibility

Keep strict v1/v2 parsing. For v2 require the snapshot's exact classification and
intake binding before using it. Reject contradictory, malformed or oversized
evidence rather than dropping an inconvenient row. v1 remains unknown-kind.

Adapt selections as known-but-ineligible action evidence. They still contribute
typed aliases, unavailable destinations and contradictions before grading. Keep
the existing `unverifiedCaptures` waterfall exclusion for insufficient scored
prospective action proof; do not add an overlapping capture bucket or release a held identity
to a favorable retry. Never deduplicate independent events merely by class ID.

Add `selectionOnlyRows` to the overlapping observation diagnostics. Version the
strict audit report/client contracts and worker fingerprint revision together.
An older saved report cannot be mistaken for a fresh new contract. Keep capture
arithmetic, bounds, failure/staleness handling, administrator-only no-store GET,
nonpersistent polling, native disclosure, focus and quiet status behavior.
Do not introduce selection agreement/gain rates or claim improved accuracy.

The implemented payload is `classification.feedback_outcome.v2`, with
`action: selection`, `reference.kind: server_shortlist_at_commit` when available,
and `referenceRelation: matches|differs|unknown`. The audit report becomes
`evidence_gap_audit.v2`; the status envelope remains v1 because its fields and
states are unchanged. An old saved report is withheld until the next successful
admitted audit; existing cooldown/backoff is preserved. The worker's versioned
fingerprint and output validator prevent reuse of the old report.

Older v1-only binaries cannot interpret newly written v2 snapshots and may withhold
evaluation reports after a rollback. Do not downgrade or reconstruct those receipts
to make an older reader accept them. Existing feedback commands and one-way expiry
remain compatible with the additive database guard; no deployment is performed here.

## Official research and tradeoffs

Sources were discovered and read through MCP search on 2026-10-28. These are
engineering applications of guidance, not conformance or security certifications.

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) supports retaining the specific
  source and derivation of an assertion. A selection and its server reference are
  distinct evidence from a confirmation command or served presentation.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports
  versioned provenance and disclosed quality/coverage limitations. Retain explicit
  unknowns and name the new selection-only diagnostic accurately.
- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  documents unique/conflict behavior. Keep atomic source insertion and existing
  uniqueness/replay checks; do not upsert new evidence over an old receipt.
- [PostgreSQL triggers](https://www.postgresql.org/docs/current/sql-createtrigger.html)
  supports a row-level immutability guard that permits evidence clearing and
  foreign-key tombstoning within the existing transaction.
- [OWASP transaction authorization](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Transaction_Authorization_Cheat_Sheet.md)
  supports server-controlled transaction facts and authorization checks. No
  client-supplied kind, reference or identity becomes provenance authority.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports omitting sensitive material. The snapshot and public diagnostic need
  no titles, reasons, actor identities, credentials or provider payloads.

| Option | Pros | Cons / risk | Recommendation |
| --- | --- | --- | --- |
| Freeze selection and named server reference; separate diagnostic | Truthful action semantics; reuses atomic receipt and retention | Does not enlarge confirmation/change scores | First batch |
| Infer confirmation/change from shortlist equality | More immediately scored rows | Invents a command and mixes different reference meanings | Reject |
| Add explicit action commands plus a served-reference contract | Can prove future explicit action semantics | Larger authorization/API/presentation change requiring its own design | Next boundary |
| Use a new receipt table | Independent schema | Duplicates existing binding, clock, expiry and replay lifecycle | Unnecessary here |
| Backfill from current flags or placement | Appears more complete | Cannot establish historical action/reference provenance | Exclude |

Recommended stack: existing atomic receipt transaction, strict v2 selection
projection, database immutability/expiry guards, conservative shared adaptation,
versioned aggregate diagnostic, and the existing protected accessible view.

## Verification and delivery plan

Test both writers, successful/failed transactions, exact replay and changed-request
conflicts, int64 binding, missing/invalid references and disagreement between the
shortlist and original saved destination. Verify no raw mutable flag can promote
v1 or v2 selection into frozen prospective confirmation/change scoring. Preserve temporal bounds,
connected holdouts, unavailable contradictions and conservative duplicates.

Use disposable PostgreSQL for atomicity, concurrent replay, immutability,
one-way expiry, FK tombstones, history retention and exact event binding. Verify
the new audit contract, old saved-report rejection/recompute, safe protected GET,
distinct client reason label and existing accessible disclosure behavior.

Then run affected coverage, ratchet, types, lint, dependency usage, ownership,
schema reproduction, ESM, Markdown, copyright and staged secret checks. Update
Unreleased and separate outcome evidence. Commit/push all work on `main`; no
branch, PR merge, release, deployment or live historical recovery.
