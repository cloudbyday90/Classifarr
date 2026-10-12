# Arr configuration warning contracts

Design date: 2026-10-12. Scope: Dashboard's optional quality-profile warning.

## Findings

`getArrConfigStatus()` already returns unwrapped GET data. The server produces
`incompleteConfigs` rows with a positive numeric ID, `Radarr` or `Sonarr` type,
display name, and `missingField: quality_profile_id`. The warning previously
trusted the response and routed every non-Radarr type to Sonarr.

Directly enrolling the component in the strict Vue project pulled the API barrel
and its untyped dependencies into that project, producing 330 diagnostics. This
batch will separate the component's loader contract from transport orchestration,
not suppress those diagnostics or change unrelated APIs.

The current GitHub open-PR inventory is empty. There is no PR to randomly select
or implement; nothing will be merged or reopened.

## Recommended implementation

1. Dashboard supplies its existing named API function through a required typed
   `loadStatus: () => Promise<unknown>` prop. The endpoint and transport stay
   centralized and unchanged.
2. A small ESM parser accepts only recognized provider/field combinations and
   positive safe-integer IDs. Missing or blank names use the provider and ID.
   Duplicate provider/ID rows are ignored; identical IDs across providers remain
   distinct. Invalid rows cannot become Sonarr warnings or supply destinations.
3. Navigation uses RouterLink with fixed internal destinations. Dismissal uses a
   named native button with `type="button"`. The warning remains a one-fetch,
   non-critical component; an absent warning is not a declaration of system health.
4. Ignore late responses after unmount, and log only a fixed failure message, not
   raw HTTP errors or provider payloads. No background retry or new polling.
5. Enroll the component and parser in existing strict checks. Cover parser input,
   rendering, loader ownership, navigation, dismissal, unmount, and invalid compiler
   contracts. Verify native keyboard behavior in the existing browser suite.

## Options and tradeoffs

| Option | Advantages | Costs / decision |
| --- | --- | --- |
| Typed loader plus parser | Bounded change; unknown network data validated; transport remains centralized | Caller must supply the loader; recommended |
| Type the entire API dependency graph now | Broad static coverage | Unrelated 330-diagnostic migration obscures this component fix; defer |
| Keep the direct import with suppressed diagnostics | Small textual diff | Weakens verification and leaves runtime assumptions; reject |
| Render arbitrary providers / response links | Flexible | Can misdirect operators; reject in favor of the actual server contract |

Recommendation stack: explicit input boundary, validated display model, native
navigation and dismissal, strict regression checks, then isolated image evidence.
No migrations, provider calls, ownership recovery, memory-limit changes, live
Unraid changes, or release are part of this batch.

## Official research

Sources were discovered and opened through connected web search on 2026-10-12:

- [Vue TypeScript Composition API](https://vuejs.org/guide/typescript/composition-api):
  use PropType for complex runtime-declared props and explicit ref types where
  inference is insufficient.
- [Vue lifecycle hooks](https://vuejs.org/api/composition-api-lifecycle): register
  lifecycle cleanup synchronously during setup. This component discards late
  results; it does not claim to cancel the underlying transport request.
- [Vue Router navigation](https://router.vuejs.org/guide/essentials/navigation):
  RouterLink supplies declarative client navigation with an anchor destination.
- [WAI-ARIA link pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/): prefer
  native links so browser and keyboard navigation behavior is retained.

Observed validation and exact image identity belong in the separate outcome
document; this design is not evidence that tests or CI passed.
