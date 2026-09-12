# Live learned library profiles

## Purpose and scope

The preceding organic-profile commit trained and benchmarked inventory patterns
but did not supply them to live AI comparison. This component closes that gap
without requiring library names, presets, or operator-declared purpose as
learning inputs. Existing hard constraints still define eligible destinations.

Learn genre, studio, and audience patterns from current same-media inventory,
using the existing contrastive learner. Supply signed relative fit alongside
retrieved descriptions to the existing candidate comparison. Do not reinterpret
this score as a probability, rewrite metadata or policies, or expand the closed
candidate set. This is profile learning, not language-model weight training.

## Design and automatic refresh

Use the existing bounded, read-only repeatable-read retrieval transaction. Its
corpus query opts into metadata columns; unrelated description-only consumers
keep their original projection. Both examples and learned profiles therefore
come from one inventory snapshot. Discover library membership from active,
same-media inventory, including competing libraries outside the selected set as
background statistics, but return evidence only for the supplied candidates.

Rebuild the small statistical model on each live comparison. There is no durable
profile cache or scheduler to become stale. Added, removed, edited, moved,
deactivated, and source-conflicted items affect the next snapshot automatically.
Bind the algorithm version, description projection version, normalized training
metadata, identities, memberships, and query exclusions to a deterministic
fingerprint. This fingerprint identifies evidence, not a promise that inventory
cannot change after the transaction. Never reuse an old profile on failure.

Exclude the query identity and all copies of its current or stored description
before fitting and retrieving examples. This prevents a previous placement from
teaching the answer to its own reclassification, including when the incoming
synopsis has changed.
Shared descriptions receive fractional membership; contradictory metadata
contributes no features. Unknown fields remain neutral. Ratings describe
audience, not genre or routing authority. Library names are not learned features.

Keep the existing 50,000-row, 10,000-description, 64-library and 250,000-counter
bounds. A profile-only budget failure omits profile evidence while retaining
usable description retrieval. Source/database/provider failures remain bounded
and do not log private content. The existing local embedding/configuration
checks remain in place; this consumer does not run when local retrieval is
disabled or unavailable. It does not automatically rerun old decisions.

## Provider and UI boundaries

Project a fixed schema at the provider boundary: supported version, status,
training count and finite relative fit. Never send learned feature maps,
inventory fingerprints, query identities, or arbitrary attached fields. Keep
existing description snippets restricted to trusted local providers. A remote
provider may receive only the numeric aggregate. Prompt wording explicitly
separates observational fit from truth, independent votes, or policy permission.

No new settings, acknowledgement, warning cards, API endpoint, or UI status
stream are needed. If a later component surfaces learning progress, use a short
non-interrupting accessible status rather than exposing internal diagnostics.

## Alternatives, pros and cons

| Option | Benefit | Cost or risk | Recommendation |
| --- | --- | --- | --- |
| Refit from the retrieval snapshot | Always fresh at read time; no invalidation races | Bounded CPU per comparison | Implement now |
| Persistent cached profiles | Lower repeated fitting cost | Requires reliable revisions, deletions, and query holdout | Defer until measured |
| Let fit authorize routing directly | Fewer confirmations | Uncalibrated observational mistakes become decisions | Do not implement here |
| Require declared purpose before learning | Explicit intent | Blocks organic discovery and adds work | Not required |

Stack: current inventory → query-excluded learned profile + description retrieval
→ existing AI candidate comparison → existing constrained decision handling.
Next, use learned fit in the policy-eligible candidate shortlist, before the
three-candidate comparison limit, and benchmark that actual live path on at
least 100 held-out titles. Reduce avoidable reviews without training on
Classifarr's own unverified predictions.

## Verification plan

Test arbitrary library identities, query/copy exclusion, changed stored synopsis,
metadata conflicts, shared membership, missing features, cross-media isolation,
deterministic fingerprints, fresh edits/moves/deletions, bounded failure, provider
redaction, and prompt delivery. Run real PostgreSQL integration tests, backend
validation and a local Compose read-only probe. Do not equate smoke success or
existing-placement agreement with classification accuracy.

## Official research and date boundary

Sources were discovered with search tools and read September 12, 2026. These
are living official documents, not certified archived August 2026 snapshots.

- [PostgreSQL transaction characteristics](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  supports a consistent read-only snapshot for related reads.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
  supports excluding evaluated examples before fitting learned features.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports bounded evidence, provenance, current access checks, and constrained
  output handling. Applying these principles here is an engineering choice,
  not a claim of complete security certification.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports accessible non-focus-taking status messages and warns against making
  interfaces excessively chatty; it does not require adding a new message.
