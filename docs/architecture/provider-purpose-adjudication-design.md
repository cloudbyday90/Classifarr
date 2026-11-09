# Category-neutral purpose evidence for AI adjudication

Research: November 9, 2026 Eastern. Baseline main c5f4dd183. Status: consumer,
meaning, limits and disclosure agreed; final lifecycle/verification agreement
pending. No release or deployment.

## Problem and existing consumer

The provider's closed adjudication packet carries numeric policy signals and
bounded observations, not the native purpose declarations that produced them.
An AI comparison therefore cannot inspect that declared meaning through this
packet. Adding purpose is new evidence representation; it is not recovery of a
demonstrated lost prompt branch. The separate
[consumer investigation](compatibility-purpose-consumer-boundary.md) identifies
the omitted compatibility-purpose pair in post-choice learning provenance.
This batch does not change that consumer or its authority.

Use existing adjudication only: two or three server-selected, policy-eligible
candidates, including the existing verify-to-adjudicate fallback. Initial
classify and verify prompts stay separate. A category-specific classify
instruction remains an explicit follow-up; this batch does not make every
platform prompt category-neutral.

## Agreed semantic contract

Provide a separate advisory declared-positive PURPOSE subsection per candidate.
Retain explicit identity/compatibility semantics, signal, operator, complete
terms, constraint mode, optional/effective rule weights, combination mode and
loaded library media scope. Media scope is not a new per-rule scope field.
Compatibility, preferences and media-type rules never become specialized identity.

Reuse nativePurposePositiveSemantics.mjs for the supported four signals and four
positive operators. Do not tighten historical parsers or reinterpret compound,
negative or unknown legacy rules. Preserve a complete supported declared subset
of a mixed policy; mark profile-derived/unknown origins separately and do not
expose their rule text as declarations. If any declared rule is unsupported,
the candidate subsection is unavailable rather than a misleading partial subset.

Keep the genuine current aggregate match summary separate from configured terms.
It does not prove that every rule or term matched. Require existing runtime
eligibility and positive effective native intent-source weight. A disabled source
must not acquire an additional AI influence channel through its raw terms.
Per-rule weights and the global source weight remain distinct.

Limits are 32 declared rules and 4 KiB encoded evidence per candidate, preserving
the existing 50-term/120-UTF-16-unit per-rule limits. Bound the entire added
rendered section to 16 KiB UTF-8. Preserve complete semantic units; overflow makes
the affected subsection unavailable without truncating terms or changing
require_all/combination meaning. These limits do not cap scoring or the complete
existing prompt, which has independent sources and limits.

## Proposed live lifecycle

Use small contract, live-collector and provider-projection leaves rather than
putting the logic in the existing prompt builder singleton.

1. Production PolicyEngine.evaluateItem already owns a live capture lifecycle.
   Add a separate runtime-only collector; generic/offline evaluation remains
   unminted. At the media-filter stage, before asynchronous support reads, freeze
   canonical declared rules, a positive loaded native revision and the complete
   loaded policy/configuration binding. Reuse the existing 64-candidate producer
   bound; overflow affects only new evidence, never evaluation.
2. After actual policy evaluation settles, require genuine private purpose-match
   proof under the same typed movie/TV+TMDB identity, policy/library pair and
   unchanged native binding. A source string, matching hash or JSON object alone
   grants no proof. Existing live binding helpers are checks, not minted receipts.
3. After conflicts, specialization and final ranking, mint an immutable private
   sidecar for retained policy/library pairs on the exact returned evaluation.
   Keep raw declarations outside enumerable result metadata, stored captures,
   history and public API projections. Use request-lifetime private references;
   introduce no new retained payload, capture version or recovery/backfill path.
4. Pass a distinct private purpose option, not new fields inside the existing
   candidateAdjudicationEvidence.candidates. Consensus serializes those candidate
   objects; keep its fingerprints and existing replay evidence unchanged. The
   prompt assembly consumes only current candidate members. Recheck typed item,
   pair, candidate number/order and private authority
   after asynchronous evidence loading and immediately before provider projection.
   Permit the existing valid shortlist reordering without expanding the pool.
5. Missing, copied, serialized, legacy, replayed, stale, malformed or oversized
   evidence yields a closed unavailable state for the new subsection. Continue
   the existing adjudication flow and gates; never reload current policies to
   reconstruct a historical/evaluation-time declaration.

This freezes the configuration used in that evaluation, not a promise that the
database configuration cannot change later. Rebinding to a later configuration
would change the evidence's meaning. Existing consensus revalidation/authorization
continues unchanged; this sidecar does not introduce a durable configuration fence.

## Agreed provider disclosure and authority

Send configured terms only to a syntactically trusted local Ollama endpoint,
matching the current detailed-adjudication-evidence boundary. Other providers,
including Ollama at an untrusted endpoint, receive fixed aggregate availability,
origin and match categories, without terms, raw rules, revisions, hashes or
internal IDs. Do not add an operator setting or UI.

Render escaped structured data separately from fixed instructions. Treat term
text as untrusted even when an authorized operator declared it. Preserve strict
PROPOSE/ABSTAIN response validation, the existing closed candidate set, provider
admission, cancellation, quotas, call counts and repair rules. No prompt text
can grant routing or learning permission. Numeric scoring, hard-limit/avoid
consumers, thresholds, calibration and learning remain unchanged. AI proposals
may change because local providers receive more relevant evidence; that does not
establish improved accuracy or identify a cause of historical classifications.

Local endpoint trust does not imply protected-gateway execution: production also
supports direct Ollama. Keep both existing transport/error contracts and exercise
sentinel responses through both paths. Add no raw-purpose payloads to ordinary
logs, history, metrics, errors or replay. Existing gateway request correlation
retains its keyed fingerprint of the exact request body; the new terms therefore
affect that opaque fingerprint without adding raw-term persistence or a new
stored payload. External provider storage remains outside application control.

## Official guidance and application

[OWASP prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html),
retrieved through MCP on the research date, recommends separating instructions
from untrusted data while warning that labels do not enforce a trust boundary.
Apply deterministic membership/output/authorization checks outside the model;
do not claim that JSON escaping or a prompt disclaimer prevents injection.
Avoid unnecessary sensitive prompt content in logs and telemetry.

[W3C PROV-DM](https://www.w3.org/TR/prov-dm/) distinguishes source entities,
their derivation and the activities that use them. Our application of that model
is an exactly bound live derivation with explicit unavailable evidence. This
design does not implement RDF/PROV serialization or claim PROV conformance.
No new web interaction is proposed, so this batch adds no new accessibility
surface or WCAG claim.

## Verification and delivery proposal

Exercise the real canonical operator/semantics matrix, weights and combination
modes; mixed/profile/unknown origins; strict blocking and disabled weights;
full-unit rule/byte limits; private receipt copying, serialization and forgery;
item/library/policy/revision swaps and asynchronous mutation; retained ranking
and valid shortlist reorder; offline/replay absence; and concurrent requests.

Use production-factory isolated PostgreSQL declaration/load/evaluation controls
and loopback provider HTTP to inspect actual final local/remote requests without
paid or live provider calls. Preserve response rejection, provider-call count,
existing fallback behavior and routing/learning admission controls. Verify no
new raw-purpose persistence or ordinary log/telemetry fields.

Run fresh backend coverage and normal lint/type/Knip/ownership/policy/ESM gates;
update an ownership entry only after inspecting changed analysis, never by
relaxing classification or the review cap. The independently agreed
[Tailwind assessment](client-tailwind-pr-587-design.md) requires fresh client
coverage/build/browser checks. Keep all scanner findings and policies visible.
Use current coverage reports for the ratchet and perform scoped artifact
maintenance before heavy work and at handoff.

Record observed behavior, limitations and actual checks in a separate outcome
document and Unreleased. Commit/push all intended changes on main, inspect the
exact pushed source's CI, and create no branch, release or deployment. Add no
schema, endpoint, setting, job, operator CLI trigger, live configuration write,
extra provider call or historical inference.

## Alternatives and final recommendation stack

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Live adjudication-only evidence | Gives the existing local comparison the actual declared meaning | New private binding and disclosure tests; AI proposals can change | First batch |
| Standalone unused contract | Smaller runtime boundary | No application behavior benefit yet | Not selected |
| Reload current rules during prompting | Easier integration | Cannot prove the rules belong to the evaluated snapshot | Reject |
| All modes/all roles/remote raw terms | Broader reach | Mixes response, privacy and broader rule-semantics boundaries | Separate decisions |

First implement and qualify the agreed adjudication evidence. Then inspect
category-specific classify-prompt assumptions separately. Keep post-choice
compatibility learning, JSDOM major migration and corrected Node/npm artifacts
as distinct follow-ups with their own evidence and authorization boundaries.
