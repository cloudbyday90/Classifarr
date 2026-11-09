# Replay-safe native purpose declaration validation

Date: 2026-11-09 Eastern. Status: agreed November 9; implemented and locally verified; delivery receipts in the outcome.
Baseline: d0a2757b5 on main, clean at intake. Its own pipeline 42606167330 and
security runs completed successfully. No release or deployment is proposed.

## Problem and proposed contract

The scorer now understands canonical positive native purpose rules, but fresh
writers can still accept rules outside that supported contract. Initial creation
accepts negative purposes, combined values, operator/value mismatches and labels
such as genres/max. Native update already rejects several of those shapes, but
still accepts exclude as a purpose. Client controls alone cannot enforce meaning.

Require every newly submitted purpose rule to be canonical positive as it will
be materialized by its current writer: four signal types, four positive operators,
identity/compatibility semantics, and a bounded matching operator list. Delegate
recognition to readNativePurposePositiveRule through a small write-capability
leaf, not another scoring matrix. Do not evaluate sample items or call providers.

An unsupported rule beside a valid rule still refuses the whole new declaration.
Do not silently remove, split or remap it into purpose, avoid or hard limits.
Every update_purpose command in a multi-command request is checked. Unrelated
review, hint, avoid, hard-limit or routing edits continue copying old purpose
without demanding a new declaration. Their contracts and scoring stay unchanged.

## Compatibility facts and explicit limits

Existing structural parsers precede fingerprint/receipt lookup. They also decode
stored drafts. Tightening those shared parsers would block exact recovery of
previously committed requests and make some currently readable drafts unavailable.
Keep existing schemas, structural normalization and fingerprint material unchanged.

| Existing authoring behavior | This batch |
| --- | --- |
| Native update defaults omitted semantics to identity and constraint mode to advisory | Preserve those normalized defaults |
| Initial establishment materializes every purpose as identity, including requested compatibility/null/omission | Preserve this existing role mapping explicitly |
| Initial create delegates establishment | Use the same actual materialization for capability checks |
| Structural stored decoding accepts legacy exclusions | Keep that readability and encoding |
| Some compound legacy drafts already cannot project into the narrow editor | Do not claim to recover them or tighten them further |

This checks supported materialized purpose rather than redefining all authoring
defaults. It does not claim initial creation preserves a caller's requested
compatibility semantics. Aligning that existing mapping across writers is a
separate behavioral decision. No old record is rewritten or upgraded as proof.

## Design tree and mutation boundaries

Recommended decisions: all submitted purpose entries must be supported; historical
receipt recovery remains first; current structural/default mapping remains;
presentation stays in existing controls; mutation refusal occurs before first DML.

| Writer | Required ordering |
| --- | --- |
| Native change | Existing authorization/admission, fingerprint, advisory lock, exact receipt/key handling, policy/active-intent/revision checks, then capability guard before deactivation |
| Initial establishment | Existing structural preparation, policy lock, exact receipt/key handling and authority checks, then guard before establishment reservation |
| Native create | Existing advisory lock and exact create receipt recovery, then guard before policy INSERT |
| Profile-backed proposal admission | Reuse create guard; preserve consumed-proposal recovery before expiry/current-profile checks |
| Bulk reviewed declarations | Complete actor-bound old receipt recovery first; verify current plan/IDs, validate all candidates before the first child write; retain individual child guards |

Use current pure materialization helpers for establishment/create so the guard
checks what would actually be stored. Extract a small pure mapping helper if
needed rather than duplicate its role/source/default logic. Keep SQL and lock
ordering unchanged. A refused transaction may perform reads and locks, but must
perform no policy, version, rule, event, reservation or receipt DML. A rejected
native create must not consume a policy sequence by inserting then rolling back.

Old exact receipts may recover unsupported commands before current capability
checks, even after later revisions. Different actors, keys or command fingerprints
retain their current rejection. Preserve in-progress handling and uncertain-commit
semantics: an existing failed_rolled_back label is not proof of rollback, and an
unknown outcome must not be converted into a fresh request or successful retry.

Bulk planning should retain parseable but unsupported candidates in the existing
individual-review exceptions rather than offer them as applicable or drop them.
Keep its opaque aggregate presentation and existing 25-policy limit. Do not expose
raw rules or add automatic replanning. Complete older batch receipts still recover
before building a new plan; partial or mismatched evidence remains refused.

## Quiet UI and error behavior

Offer four positive operators for fresh choices in the existing advanced editor.
A loaded legacy exclusion keeps its actual current value in a visibly labeled,
disabled current-only option. Do not blank it, substitute a positive operator,
change terms or add a page, wizard or setting. Compact/create paths already emit
supported require_any rules and need no additional controls.

Keep the five-operator structural command encoder/clone so an unchanged old
request can still reach receipt recovery. Do not put a fresh-only gate in front
of exact retry material. New deterministic refusal receives a fixed validation
code/message through existing HTTP error envelopes and existing form/action-error
areas. Explain that the purpose must be edited, rather than claiming an unknown
commit and instructing endless unchanged retries. No raw values enter errors.

Reuse current result/status shapes where possible, including the native-change
RETRYABLE result with a fixed capability risk mapped to a distinct HTTP 400 code.
Do not throw that refusal into the service's generic transaction-failure catch.
Preserve other stale, in-progress, reused-key, missing-authority and transport
responses. Keep attempt-key lifecycle and bulk replay/recovery behavior unchanged.

Current native change/create requests do not opt out of transport retries:
network/5xx/429 retries reuse the same body, config and key. Preserve that actual
behavior; this batch does not introduce skipAutomaticRetry or automatic replay
under a new key. Editing the draft retains its existing key-reset semantics.

## Verification and delivery

Freeze failures before correction using production modules, then verify:

- Positive matrix and current materialized defaults; negative, compound,
  mismatched and unsupported fresh purposes refuse across all writers.
- Every invalid request, including mixed-command/late-invalid bulk cases,
  performs no DML, event/receipt creation or provider work. Create rejects before
  policy insertion. Existing non-purpose edits remain allowed.
- Seeded older receipts recover now-disallowed commands unchanged, after later
  revisions too; changed actor/payload/key, partial batches and stale states do not.
- Real PostgreSQL concurrent writers, receipt-failure rollback and lost/delayed
  acknowledgement after commit preserve existing results and exact recovery.
- Existing legacy drafts remain readable where currently supported, with no
  silent transformations. The browser offers four new choices while showing the
  actual saved exclusion. Fixed validation guidance and uncertain retries remain
  distinct; the same unchanged retry retains its original key.
- HTTP/API envelopes, admin access and CSRF remain unchanged apart from the
  new fixed validation code. Normalization/fingerprint compatibility is explicit.

Run focused service/HTTP/database/client/browser controls, fresh complete backend
and client coverage, unchanged ratchet/ownership and quality gates. Use isolated
synthetic PostgreSQL fixtures, never live configuration or provider calls. Review
locks, trees and complete audits for the independent dependency batch. Record
outcomes separately, update Unreleased, perform scoped artifact maintenance and
commit/push all agreed changes on main. No new endpoint, schema, job, operator
CLI trigger, release or deployment.

## Official research and alternatives

Sources discovered/opened through MCP on November 9, 2026:

- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  distinguishes syntax, operation-specific meaning and authorization. Apply
  semantic checks server-side without turning a valid shape into write authority.
- [HTTP semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
  distinguishes idempotent effects and conflicts. These POST receipts are an
  application recovery contract, not a claim that every POST is idempotent.
  Preserve existing stale-revision and error mappings; no ETag migration here.
- [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  and [error suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)
  support visible actionable guidance in existing forms. Do not silently replace
  invalid/saved choices or describe a proven refusal as an uncertain commit.

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Tighten shared parsing before receipts | Few checks | Breaks old exact recovery and draft decoding | Reject |
| Filter only browser options | Quiet UI | Other callers still write unsupported rules | Insufficient |
| Reject in delegated writer after create INSERT | Prevents committed invalid purpose | Still attempts DML/sequence use; misses pre-write guarantee | Insufficient |
| Shared guard after replay, before first DML | Canonical fresh declarations with historical recovery | Several writer/HTTP paths require verification | First batch |
| Redesign negative/default/mapping semantics simultaneously | Broader consistency | Changes saved meaning and expands migration/review scope | Separate follow-up |

Recommendation stack: first implement this fresh-write boundary; then decide
initial semantic mapping consistency, remove remaining category-specific prompt
assumptions, and improve intentional individual/bulk review through existing
surfaces. Existing scanner-alert review remains an independent pre-release task;
successful workflows do not establish a vulnerability-free platform.
