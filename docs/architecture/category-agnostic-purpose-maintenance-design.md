# Category-agnostic purpose maintenance

Date: 2026-11-08 Eastern. Status: agreed; the operator confirmed preservation
of saved review behavior for every category before implementation. No release
or deployment.

## Intended boundary

Destination meaning belongs in the saved purpose contract. Library and policy
IDs bind authority; names are display labels. Arbitrary configured category
terms use the same bounded typed rules, matching semantics, validation and
revision-checked save path. Adding another destination category should not
require a branch in application code.

This means category-agnostic behavior within the existing movie/TV platform.
It does not mean arbitrary executable rules or automatic support for new media
types. Keep fixed supported metadata types/operators, input limits, provider
adapters and authorization. Observed inventory and name-based template
suggestions remain drafts until an explicit declaration.

Useful deterministic invariant: with IDs, rules, metadata and settings held
constant, changing display names must not change score, eligibility or action.
AI outputs are not asserted deterministic under prompt renaming.

## Verified current architecture and gaps

The current native contribution uses validated declared rules and shared
evaluation. Specialized destination comparison uses rule provenance and
cross-candidate term matches, rather than library-name branches. The compact
purpose form also uses its library name only in display text.

The platform still contains separate assumptions and incomplete contracts:

| Boundary | Verified fact | Treatment |
| --- | --- | --- |
| Native version creation | Existing review behavior is omitted when creating the next version | First correctness fix below |
| Accepted purpose operators | All twenty signal/operator pairs normalize, while scoring supports a narrower signal-specific set | Separate authoring/scoring contract follow-up |
| AI classify prompt | Explicit instruction singles out the Family library | Replace through a separately tested category-neutral prompt boundary |
| Preset semantics fallback | Six literal broad genres select compatibility | Retained legacy behavior; valid native declarations have explicit semantics and bypass it |
| Individual draft review | Current rules are preselected, including observed terms | Review consistently across compact, advanced and mixed-origin paths |
| Bulk purpose proposals | Profile-derived proposals can be called reviewed while only names are listed | Include in future review-consent design; individual changes alone are incomplete |
| Metadata/provider adapters | Typed event/anime/series vocabulary supports content features and provider requirements | Preserve legitimate adapters; do not confuse them with destination-name routing |

The profile initializer derives its top-five genre/media observations from
inventory, not destination-name rules. Those observations do not establish
what a specialized destination is intended to contain. Generic scope is
expressible with an explicit supported media-type include rule and compatibility
semantics; an inferred require_any media rule has different current behavior.

## Immediate defect: unrelated edits reset review settings

The purpose editor exposes rule signal, operator, terms, semantics and constraint
mode. Its request contains an expected revision and update_purpose command.
It has no combination-mode, threshold or trust controls and cannot knowingly
consent to changes in those settings.

The server already locks the active intent and selects review_behavior.
However, applyPolicyNativeIntentChange omits that field when calling
insertNewNativeIntentVersion. The existing persistence leaf defaults it to an
empty object. Only an explicit update_review_triggers command subsequently
replaces the new version's JSON. Every other native edit can therefore lose
the saved behavior.

A provider-free invocation of the real projection confirmed:

| Native review settings | Loaded behavior with the same valid contract |
| --- | --- |
| require_all, automatic 95, confirmation 90, trust flags false | Saved settings apply |
| Empty review JSON | Parent policy's best_match, 85/60 and trust flags true apply |

Native authority and validation remain valid in both cases. The reset can
silently weaken thresholds or re-enable evidence sources. It is not specific
to any category, provider or destination label.

Source: policyNativeIntentChangeService.mjs; the existing locked-row/version
operations in policyNativeIntentChangePersistence.mjs; and
withPolicyEngineRuntimeAuthority plus policyNativeIntentRuntimeEvaluator.

## Proposed complete first batch

Pass the locked active intent's review_behavior into the existing next-version
creation leaf. Preserve that stored JSON for purpose and every other command
that does not explicitly replace review behavior. Use the authoritative row
already locked inside the transaction, never a browser default or earlier
admission snapshot.

Keep the existing persistence helper's null/default normalization. An explicit
valid review-trigger command retains its current replacement behavior; this
batch does not redesign partial review updates or merge their keys. Preserve
command admission, actor/admin checks, revision fencing, locks, transaction
rollback, exact receipts/replay and uncertain-write handling. Existing rules,
provenance, routing targets and lifecycle publication stay on their current
paths. A replay must not create another revision or reset newer settings.

Use the existing modular service and persistence leaves. No extra abstraction
is needed to pass a server-owned value. Add no browser setting, category preset,
endpoint, API field, schema, job, CLI trigger or provider call. No live purpose
write, historical repair, release or deployment is proposed. This preserves
current meaning; it does not make the whole platform category-agnostic alone.

## Verification

Add regressions before the correction that fail with the current writer:

- Nondefault matching mode, thresholds and trust flags survive a purpose-only
  change in real PostgreSQL; assert full stored JSON equality and the loaded
  runtime projection, not just an INSERT argument.
- Other non-review commands use the same preservation boundary.
- An explicit review command still wins with its existing replacement meaning.
- Stale revision, failed transaction and exact replay preserve the correct
  version/settings and create no duplicate change.
- The value comes from the locked active row, including a concurrent revision
  change; it cannot be supplied by a stale admission view.
- Arbitrary display labels and configured terms use the same path. Keep the
  purpose-only browser request narrow and its exact-key recovery unchanged.

Use focused unit/HTTP contracts and the disposable PostgreSQL harness. Then run
fresh backend coverage and normal quality/ownership gates. Client full evidence
may be reused only after unchanged source, installed graph and report hashes
are verified; run relevant current purpose-request controls. Keep a separate
observed outcome document, update Unreleased, perform scoped artifact maintenance
and commit/push all agreed changes on main. No new branch or release.

## Official research reviewed

Sources were discovered/opened through the connected search service on
November 8 Eastern / November 9 UTC, 2026.

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) separates derivation from the
  entity containing data. Preserve observed versus declared provenance across
  the common workflow; native storage or a familiar category name does not
  establish purpose authority. No RDF infrastructure is needed.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  explains visibility and concurrent row updates. Copy from the existing
  transaction's locked active row. Do not add a separate unlocked read or a
  retry of an uncertain write. Existing isolation and timeouts remain intact.
- [W3C labels and instructions guidance](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions)
  supports clear controls without excessive instructions. Preserve settings
  outside the purpose form's edit scope server-side; another control or category
  wizard would not repair the missing-value propagation.
- [OWASP API Security Project](https://owasp.org/projects/api-security-project)
  provides the broader authorization/security framework. Keep typed admitted
  commands and server-owned properties separate. The proposed preservation
  contract is an application decision, not a claim that a standard mandates
  a particular JSON merge algorithm.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limit | Recommendation |
| --- | --- | --- | --- |
| Category-specific forms/defaults | Familiar labels for one setup | More branches; does not generalize or fix hidden settings loss | Reject |
| Copy all settings into the browser's purpose command | Could restate current values | Expands write authority and introduces stale/hidden defaults | Reject |
| Preserve locked review JSON in version creation | Small universal correction; no extra UI or process | Does not resolve other authoring/prompt gaps | First batch |
| Rewrite all authoring, prompts and legacy fallback together | Broad category cleanup | Mixes semantic migration and behavior changes without isolated evidence | Stage separately |

1. Preserve the complete server-owned review behavior during unrelated native
   edits, then verify the real saved/runtime outcome.
2. Align accepted operators with actual scorer meaning for every supported
   metadata type; test the matrix before changing generic-scope authoring.
3. Replace remaining category/name-specific prompt assumptions through a common
   purpose/constraint contract, with output and safety regressions.
4. Make individual and bulk declaration review consistently intentional across
   all origins, using existing surfaces and bounded, stale-safe previews.
5. Measure remaining source correlation and calibration after declarations
   provide suitable prospective evidence; avoid category-specific weights.

## Independent PR intake

Fresh intake contains open PRs 580 and 581. One uniform crypto selection chose
581 at 2026-11-09T03:10:25Z. Its current head remains
15b66950a5739e6fdb5290f2cf4c0120d4259015. Retain the existing compiler deferral
unless a changed published artifact establishes applicable new evidence.
Server ESLint from 580 is already adopted. Leave PRs unmerged and rebase only
verified stale applicable branches; an advancing main or failing check alone
does not establish a branch conflict.
