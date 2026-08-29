# Policy Destination Competition Preview Design

Status: implemented on 2026-08-29.

## Decision to Support

The cohort simulator answers whether a proposed draft changes one policy's
deterministic eligibility. It cannot show whether that proposed destination
would be eligible alongside other active destinations. That gap is especially
important when broad `require_any` purpose signals overlap.

The destination competition preview therefore answers one narrower question:
**within a bounded historic cohort, how often would the proposed policy be
eligible alone or alongside at least one other active policy of the same media
type?** It does not select a winner, expose competitors, forecast AI, or route
media.

## Official Guidance Considered

- [OWASP API5:2023](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
  recommends authorization at every sensitive function. The route performs an
  explicit administrator check and accepts only the transient draft.
- [OWASP Query Parameterization](https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html)
  recommends positional parameters. Policy IDs, media type, and the fixed
  competitor limit are the only query parameters; SQL structure and limits are
  not client-controlled.
- [NIST AI RMF Measure](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  supports documented, bounded measurements with clear validity limits. The
  result identifies its sample and competing-policy cap and never presents an
  AI or routing prediction as fact.
- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports programmatically determinable completion and error feedback. The
  result is rendered in a status region, while failed requests use an alert.
- [Vue composables](https://vuejs.org/guide/reusability/composables) support a
  narrow reusable request-state boundary. The client uses a dedicated
  competition-preview composable and component.

Research was checked against these official sources on 2026-08-29.

## Options and Trade-offs

| Option | Pros | Cons |
| --- | --- | --- |
| Static overlap inspection | Fast and private. | Cannot measure the practical size of the overlap. |
| Single-policy cohort preview | Shows the direction of a draft change. | Cannot reveal simultaneous eligibility with other destinations. |
| Full ranking or routing replay | Could approximate production decisions. | Couples a diagnostic to thresholds, providers, and routing state; misleading and unsafe. |
| Client-side competition analysis | Avoids a server request. | Exposes policy/media data and duplicates authoritative semantics. |
| Server-side bounded eligibility competition | Uses the shared evaluator, minimizes data, and shows meaningful collision counts. | Does not choose a destination or prove future correctness. |

## Final Recommendation Stack

1. Use policy-overlap inspection to locate a suspect broad signal.
2. Use the existing cohort preview to understand a draft's independent change.
3. Use this explicit competition preview to measure aggregate shared
   eligibility against active same-media-type destinations.
4. Use the shared native-intent evaluator with transient contracts for the
   proposal and current contracts for competitors.
5. Bound the work to 90 days, 100 historic deterministic records, and 25
   active competitor policies, all selected by the server.
6. Retain current policy ranking, threshold, AI, verification, and routing
   paths as the only authority to select or move media.

## Architecture

```text
Administrator's unsaved draft
        |
        v
POST /policies/:id/native-intent/destination-competition-preview
        |
        +-- administrator authorization + draft validation
        +-- saved-policy context and bounded historic cohort
        +-- server-selected active same-media-type competitors (max 25)
        +-- batched current native-intent loading
        +-- shared deterministic eligibility evaluator
        |
        v
aggregate proposed-alone/shared/competitor-only counts -> browser status
```

The selected policy is replaced in memory by the proposed draft. Other active
policies are evaluated only as anonymous competitors. The service reduces each
historic record to booleans before constructing the response.

## Security and Privacy Controls

- The request permits exactly `policy_intent_draft`; it rejects browser-chosen
  dates, media type, competitors, limits, policy IDs, or ranking options.
- Only enabled policies attached to active libraries with the persisted
  policy's media type can be competitors. The selected policy is excluded.
- Competitors are loaded with static parameterized SQL, deterministic ordering,
  and a fixed maximum of 25.
- Current native intents are attached through the batched internal loader;
  no provider, RAG, learning, routing, or policy-save service is invoked.
- The response omits media titles and IDs, policy/library IDs and names,
  competitor configuration, individual evaluator outcomes, scores, thresholds,
  policy terms, drafts, metadata, and provider state.

## Interpretation Limits

- Shared eligibility means only that more than one deterministic policy passed
  this evaluator for a historic record; it is not a routing conflict.
- The preview does not apply priority, score, threshold, AI, verification,
  manual-review, or media-server behavior.
- The selected policy may be inactive. In that case the result remains
  hypothetical and explicitly says that it cannot predict routing.
- Reaching the competitor cap or having no historic rows limits evidence and
  is not approval to automate a route.

## Pull Request Availability

The GitHub pull-request API was queried on 2026-08-29 and returned no open
pull requests. No closed or unrelated pull request was substituted, and no PR
was merged.
