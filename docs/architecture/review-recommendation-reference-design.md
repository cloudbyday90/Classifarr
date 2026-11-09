# Shared pending-review recommendation reference

Date: 2026-11-08. Status: agreed first batch; the operator confirmed the repository planning
agreement before implementation. Work stays on main. No release or deployment.
The separate [outcome](review-recommendation-reference-outcome.md) records actual
verification and delivery; this design is not evidence that the fix has shipped.

## Demonstrated problem

Read-only inspection of deployed v0.49.4-beta found seven complete v2 policy
captures with explicit operator confirmations. In two, the frozen policy leader
differs from the chosen destination, while the stored bounded AI advisory agrees
with the choice. Older retained questions reproduce the same presentation issue.
Private item-level evidence stays under .tmp; public documentation uses synthetic
examples and does not publish request identities, traces or provider content.

The current recommendation builder selects the unique highest rounded question
score. The deterministic-details builder independently uses the first destination
in the option list. The UI calls the recommendation Classifarr's recommended
destination and places the separate AI advisory inside collapsed details. A
synthetic Comedy 37 / Movies 18 example can therefore advertise Comedy while the
bounded comparison suggests Movies, and differently ordered options can attach
another candidate's score or explanation to the action.

This batch repairs review ownership and presentation. It does not establish
better ranking accuracy or authorize automatic routing from an AI suggestion.

The inspected score components also establish a separate scoring defect.
Profile-derived genre rules can earn a strong native intent contribution;
the agreement calculation then counts that intent and its originating profile
as separate positive sources without a provenance-independence check. A broad
genre match can therefore outrank the intended generic library. Existing
weak-evidence calibration limits automation but does not repair ordering.
Removing only the agreement boost is insufficient for the observed examples.
Native storage and provenance diagnostics work; their presence does not mean
the live weighting already distinguishes declared purpose from inferred context.
That scoring change remains the next batch, with its own frozen controls and
planning agreement.

## Scope and prerequisites

Use the existing normalized pending-policy question and its current server-owned
candidate destinations. Compute one bounded internal reference for policy
evidence and a separate decision about whether to offer a primary destination.
The policy reference and the primary offer have different meanings: disagreement
can remove the primary offer while preserving named policy evidence and historic
routing safeguards.

Native persistence questions retain their existing single bound destination and
recommendation-null semantics. Non-question notification and History flows remain
outside this batch. Existing public IDs and command types stay in use; broad
classification-BIGINT remediation is a separate pre-existing concern.

## One shared projection

Extract only the candidate/reference selection into a small pure ESM leaf and
reuse it from the existing recommendation, deterministic details and answer
contract builders. Do not add another service singleton or coordination protocol.

The reference must:

- Use server-owned candidate IDs/names and finite, bounded numeric evidence.
- Preserve the existing rounded-score tie meaning; array order cannot choose a
  primary destination. Duplicated or inconsistent candidate evidence cannot
  establish a new primary offer.
- Bind numeric evidence, thresholds, explanation and technical evidence to the
  same identified policy candidate. Do not attach global classification confidence
  or an unrelated candidate's score to a named destination.
- Keep policy evidence separate from advisory evidence and from an operator's
  eventual choice. Do not reconstruct missing historical evidence from current
  policy configuration.
- Preserve historical missing-route-safety and stale-question fences even when
  no unique primary offer is available. An absent presentation reference cannot
  make a previously blocked question actionable.

For conflict detection, accept only the existing structured, versioned bounded
candidate-adjudication projection with a proposed destination that is a member
of this question's server-owned shortlist. Use the canonical server name for that
ID. Shape/membership checks make the diagnostic usable for withholding a primary
offer; they do not prove independent frozen AI provenance or grant authority.

Legacy ai_advisory prose, unknown versions, rejected/abstained results, malformed
values and out-of-shortlist IDs cannot become agreement, a new winner or a new
execution reference. Retain explanatory unavailable states through the existing
disclosure without interpreting those hints as trusted conflict proof.

Distinguish absent/unknown/abstained/rejected advice from a recognized current
structured proposed record that fails shape or shortlist binding. The former is
unavailable and does not itself veto a valid policy-only offer; the latter
withholds the primary offer with a fixed invalid/unbound-proposal reason. Never
display the foreign proposal's supplied name or use it as a candidate reference.

When valid in-shortlist advisory and unique policy leader disagree, return an
explicit disagreement presentation and no primary recommendation. The operator
chooses a destination through existing controls. With aligned or absent usable
advice, any primary offer remains a policy candidate requiring the existing
authorization and safety checks. Ties or incoherent references require selection.

A tied score may retain a technical policy reference only when an explicit
retained topCandidate belongs to the server shortlist, identifies exactly one
ranked row with matching policy ID and finite score, and is among the highest
safe ranked candidates. It cannot break the displayed-score tie. Otherwise the
technical reference is null. Unbound global score/threshold evidence can retain
a conservative historical missing-safety blocking condition, but never supply
destination-specific display evidence or execution permission. Null/empty scores
are missing evidence and must not be coerced into numeric zero.

## Contract and authorization boundaries

Use a versioned recommendation presentation for the new closed reference/conflict
fields. Keep the answer command version and existing action fields/meaning.
Existing confirmation means selecting any server candidate; it does not mean
agreeing with the policy leader. A manual destination change continues to use the
existing active-library action. Do not change evaluation cohort attribution or
turn a presentation conflict into a new learning vote.

The answer fingerprint already includes recommendation and deterministic summary.
Changed pending presentations therefore invalidate old pending answers through
the existing stale/fingerprint rejection. Preserve exact completed-outcome replay
against its recorded command before rebuilding current presentation; it must not
route again. No new receipt, schema, endpoint, provider call, capture version,
scheduled job, operator CLI trigger, retry permission or learning authority.

Native question behavior and the existing historical high-score/missing-safety
refusal remain protected. Render only closed projections: no raw response,
model rationale, prompts, credentials or untrusted provider messages.

## All existing consumers

The outer Needs Attention header, instruction, score label, inner review summary,
candidate evidence and action must consume the shared server meaning. A numeric
policy score shown during conflict must be identified as policy evidence for its
own candidate, rather than imply an overall recommendation or AI probability.

Keep one quiet summary in the current card. Briefly name the policy and advisory
destinations during disagreement; retain existing expandable evidence and the
existing destination picker. Do not hide all evidence merely because the primary
destination is null. No new page, panel, wizard or alert stream is proposed.

Bulk confirmation must skip questions without a primary offer. Individual
explicit candidate choices retain their existing server contract. Unsupported
presentation versions fail closed rather than falling back to mutable item labels.

Discord's pending-notification builder currently drops the classification context
before calculating the fingerprint. Persistence already passes enriched metadata
and the original result. Reuse those existing inputs to supply equivalent persisted
context to the shared builder, without a new database read. During disagreement,
do not style the first positional candidate as an endorsed default. Verify that
rendered notification buttons and locked-row validation calculate equivalent
fingerprints. Tests use fakes; no live notification is sent by this task.

## Official research and application

Sources were discovered through search tools and retrieved from official sites
on November 8, 2026. These principles guide this scoped implementation; passing
the scoped checks does not establish complete WCAG conformance.

- [W3C 2.4.6: headings and labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels):
  labels must accurately describe purpose. The destination named in the summary
  and the explicit action must have the same reference and meaning.
- [W3C 2.5.3: label in name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name):
  keep visible action text and accessible names consistent.
- [W3C 2.1.1: keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard) and
  [2.4.7: visible focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible):
  preserve native button/disclosure operation and visible focus through selection.
- [W3C 1.4.10: reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow):
  verify the existing card at narrow widths with long destination names.
- [W3C 3.3.4: error prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html):
  preserve review/correction before the existing mutation. This guidance does not
  require adding another confirmation to every ordinary save.
- [NIST AI RMF human-AI interaction](https://airc.nist.gov/airmf-resources/airmf/appendices/app-c-ai-risk-management-and-human-ai-interaction/?trk=article-ssr-frontend-pulse_little-text-block):
  distinguish the advisory role from the operator's decision responsibility. A
  model suggestion and a policy score should not silently exchange authority.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Change only the inner summary copy | Small visual change | Outer headers, bulk actions, scores and notification contracts can still disagree | Insufficient |
| Automatically prefer the AI proposal | Follows some observed choices | Existing metadata lacks independent item-bound AI proof; promotes advisory meaning and creates suggestion bias | Exclude |
| Shared reference with explicit disagreement | Fixes a reproduced mismatch across current surfaces; keeps authorization explicit | Requires coordinated projections/normalizers and fingerprint regressions; does not repair ranking quality | First batch |
| Change inferred-purpose weights and agreement | Could address correlated evidence and weak policy ordering | Broader behavior change needs frozen regressions and a defensible evaluation set | Next scoring batch |
| Add another report or dashboard | More diagnostic surface | Existing scheduled collection is already working and would not repair the decision mismatch | Exclude |

First deliver the shared reference and honest conflict presentation. Next assess
provenance-aware scoring and purpose meaning with regression controls. Investigate
old pending-History reconciliation separately. Preserve existing automatic
collection and direct application workflows throughout.

## Verification plan

Start with server projection/answer-contract and client normalization/component
regressions for synthetic disagreement, alignment, missing/legacy/invalid advice,
abstention, rejected responses, out-of-shortlist IDs, ties, reordered and duplicate
candidates, unknown versions, absent scores and stale historical safety evidence.

Exercise outer/inner consistency, unchanged native questions, explicit individual
selection, bulk exclusion and matching notification/HTTP fingerprints. Verify
stale pending rejection and exact acknowledged replay without repeated routing
through existing real HTTP and isolated PostgreSQL fixtures where applicable.

Use an existing full-app browser harness with mocked authenticated API responses
to inspect compact default state, keyboard/focus, disclosures, 320/390-pixel
reflow, no mutation from opening details and the existing explicit selection
request. Production build/browser asset checks remain separate from this workflow
test. No live provider, production database or Discord delivery is used.

After focused checks, run affected lint/types, both fresh coverage suites and
the ratchet, dependency/tooling regression controls, policy/ownership gates,
copyright, Markdown and production build/browser checks. Preserve audit findings,
strict installer policy, coverage baselines and existing legitimate skips. Inspect
and clean only verified disposable local artifacts under the maintenance skill.

The random PR review selected [581](https://github.com/cloudbyday90/Classifarr/pull/581).
Its unchanged compiler artifact retains the demonstrated incompatibility; see
the [separate PR assessment](client-compiler-pr-581-outcome.md). No dependency
change is justified by repeating that known candidate. Recheck PR mergeability
at delivery and synchronize only genuinely stale applicable branches.

Update the separate outcome and one system-level Unreleased entry only after
implementation is verified. Commit and push reviewed changes on main, with no
package version bump, release, PR merge or live deployment.
