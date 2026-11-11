# Verification advice provenance investigation

Research: November 11, 2026 Eastern. Baseline main
`b039b2b4a45ef3ccbc297fc2fd9b8c98d55a3408`. This document records source
inspection and recommendations before agreement on the next implementation.
It is not a runtime verification or classification-accuracy claim.

## Observed consumer boundaries

The completed [recovery binding](policy-recovery-suggestion-binding-outcome.md)
qualifies policy advice after an AI failure. Normal prompts still consume the
ordinary mutable signal context. These are separate consumers.

| Source or consumer | Current behavior | Consequence |
| --- | --- | --- |
| `classificationPolicyPathService` | Builds a context from the actual policy result and loaded library pool | Recovery holds a private reference, but normal AI receives the ordinary context |
| `classificationDeterministicAiMode` | Ranked policy results select verification, adjudication or abstention | Generic classification is not the primary ranked-policy prompt path |
| `classificationAiService` | Builds verification admission before profile reads and generation | Preserve that authority boundary independently of optional advice |
| Non-adjudication profile loading | Reads `getProfileStats(signalContext.suggestedLibrary.id)` | A public mutable destination selects the profile lookup |
| `formatPolicySignals` | Prints confidence, suggested name, breakdown, diagnostics and related evidence | The recovery reference does not prove the whole printed section |
| `formatLibraryProfile` | Prints inventory counts, distributions and coverage | Returned statistics do not carry the requested library ID |
| Candidate-bound verification instructions | Name the separately selected verification target | Omitting optional recommendation text would not remove that target |
| Adjudication | Receives a closed subset of the original library pool | The recovery reader cannot simply validate against that subset |
| Legacy and direct AI callers | Have separate context producers and compatibility contracts | A global live-policy requirement would change unrelated callers |
| RAG recheck verification | Spreads the earlier context and replaces destination/confidence after reevaluation | Other fields can still describe the earlier evaluation; assess separately |
| Private shortlist replay | Builds ordinary context for offline adjudication | Offline evidence must not become live proof merely through matching fields |

These observations identify an unqualified association boundary. They do not
establish that it caused a particular live misclassification or that a malicious
input can bypass the independent routing and learning checks.

## What the existing evidence proves

The private recovery producer binds the exact live result and typed item to
evaluated policy/library pairs, source categories, native revisions where
applicable, retained numeric ranking, action, confidence and thresholds. Its
consumer also checks the original loaded pool and selected object. Its bounds
are 64 evaluated candidates, 64 libraries and a 16-KiB closed snapshot.

It does not freeze signal breakdown, source scores/weights, diagnostic text,
related-evidence text, profile statistics or all raw policy/item contents.
Selection provenance cannot be presented as proof of the entire prompt packet.
The recovery-only reader should not silently acquire another consumer contract.

Profile statistics are a later observation. The underlying query reads one
library's inventory in one statement and obtains an inventory revision, but
`getProfileStats` returns only its statistics projection. Binding the lookup and
its result can establish which library was requested. It cannot establish that
inventory placement is a verified label, nor freeze those observations at the
earlier policy evaluation time. Existing profile wording already states that
placement is observational evidence rather than an exclusion rule.

No loaded-snapshot witness establishes current database configuration after
asynchronous work. Adding freshness reads would require separate availability,
admission and cancellation decisions.

## Options and tradeoffs

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Initial policy verification advice/profile only | Small production consumer boundary; preserves other prompt producers | Adjudication and RAG still need separate assessment | First scope proposal |
| Structural IDs alone | Small consistency check | Copies and altered contexts can satisfy the same public shape | Do not describe as live provenance |
| Dedicated adapter over genuine live selection evidence | Reuses actual evaluation origin without converting diagnostics into authority | Must specify exactly which advisory fields it covers | Preferred direction after scope agreement |
| Freeze every printed advisory field | Can qualify the complete section | Additional text, category, completeness and byte limits need explicit design | Decide separately from destination selection |
| Require provenance for verification admission | Avoids generation against an unproven target | Changes provider admission and call behavior | Separate authority decision |
| Change shared builder/formatter globally | Broad consistency | Also changes legacy, replay, adjudication and RAG behavior | Avoid incidental expansion |
| Fresh database reread | Can assess newer configuration | Extra query/failure/resource boundary; does not prove classification accuracy | Separate follow-up if required |

Proposed recommendation stack:

1. Settle initial policy-owned verification as the first consumer, and decide
   whether missing proof omits optional advice/profile or refuses verification.
2. Define complete field coverage and limits before claiming more than selection
   identity. Account for `options.policySignals` independently overriding the
   ordinary context in the shared AI service.
3. Bind the exact profile request and accepted result across asynchronous work;
   retain its observed-data meaning and current disclosure boundary.
4. Preserve explicit mode selection, candidate-bound provider admission, parsing,
   retry bounds, route and learning authorization. Keep purpose terms in their
   existing adjudication-only projection.
5. Verify real owner/evaluator, isolated PostgreSQL and loopback provider behavior,
   including mutation during awaited work and unchanged excluded callers.

The operator confirmed the first consumer: initial policy-owned verification's
optional advice/profile only. Missing proof omits optional material; verification
target/admission remains separate and unchanged. Adjudication, RAG rechecks,
legacy/generic callers and replay remain separate. The complete field/lifecycle
contract in the [design](verification-advice-provenance-design.md) was then
confirmed in Q2. Runtime changes and actual verification are recorded in the
separate [outcome](verification-advice-provenance-outcome.md).
No UI, endpoint, setting, operator CLI trigger, scheduled job, provider call,
live database/configuration write, release or deployment is introduced.

## Official guidance retrieved through MCP

The following are current sources checked on November 11, rather than an assumed
new standards edition or a claim of protocol conformance:

- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/) separates entities, derivation,
  use and invalidation. The application-specific inference is to describe which
  evaluated snapshot supplies advice without equating origin with current
  validity or accuracy. No RDF/PROV implementation is proposed.
- [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
  treats external content and model output as untrusted and places deterministic
  permission checks outside the model. A private provenance reference therefore
  must not grant new route/learning permission or make profile text instructions.
  Prompt labels alone are not an injection defense.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  supports explicit permissions and default refusal. Existing candidate/provider
  admission remains a separate contract from optional contextual evidence.

## PR and baseline verification

The November 11 GitHub MCP inventory contains only open PR
[589](https://github.com/cloudbyday90/Classifarr/pull/589); uniform singleton
selection chooses it. Head `c6137f1467319a048e2d6babfe27dc6bb9859ffa`, both immutable
manifest/lock blobs and all eleven compiler records match the previously
demonstrated failing candidate. Fresh official registry/release and upstream
issue checks establish no changed artifact. Retain the
[settled compiler deferral](client-compiler-pr-589-outcome.md); do not claim a new
candidate test or manufacture an unrelated dependency update.

The branch is mergeable with unstable checks, not an established stale/conflicted
applicable branch. No PR was merged, rebased or locally adopted in this
investigation. Newer packages outside the selected PR remain unassessed;
outdated status alone is not evidence of vulnerability.

All six push-triggered workflows for baseline `b039b2b4a` completed successfully,
including [CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/42860778820),
[OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/42860779241) and
[Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/42860778814).
Those receipts qualify that baseline, not an implementation of this proposal.
