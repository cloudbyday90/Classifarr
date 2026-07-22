# Policy Authoring Workflow Inventory

Status: implemented as the durable workflow inventory contract for policy
authoring.

## Scope

This document defines the stable policy-authoring workflow inventory. The
inventory classifies current policy-builder UI and support files so follow-up
work can decide which artifacts remain in the normal authoring path, which
remain compatibility or verifier support, and which should be replaced or
deleted as native intent storage and runtime automation mature.

The inventory is not a screen-layout specification. It is a deterministic
classification contract that keeps normal authoring focused on destination
intent instead of diagnostics, provider internals, scoring weights, or legacy
storage mechanics.

## Official Guidance Reviewed

- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP Logging Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OpenTelemetry semantic convention naming:
  https://opentelemetry.io/docs/specs/semconv/general/naming/

## Recommendations

1. Use durable product-domain module names for production contracts.
2. Keep the workflow inventory side-effect-free and deterministic.
3. Classify every policy-builder surface into an explicit workflow decision:
   `keep`, `rewrite`, `replace`, or `delete`.
4. Separate normal authoring, migration support, compatibility bridge,
   verifier-only, and future server-engine roles.
5. Keep rule ids and validation messages semantic so they remain useful after
   roadmap phases are complete.
6. Preserve bounded risk ids that explain why an artifact is excluded from the
   normal workflow.

## Pros And Cons

### Durable Workflow Inventory Contract

Pros:

- Prevents new policy-builder files from bypassing product-role review.
- Makes normal authoring, verifier-only, and compatibility surfaces explicit.
- Gives future deletion and native-storage work a stable inventory to consume.
- Avoids tying runtime code to temporary roadmap phase labels.

Cons:

- Requires updates when policy-builder files are renamed or added.
- Does not itself simplify the UI; it only defines the product-role boundary.

### Product-Domain Naming

Pros:

- Keeps production code meaningful after the re-architecture is complete.
- Reduces phase-coded technical debt in imports, test names, and completion
  audit evidence.
- Aligns with semantic naming guidance by using stable domain terms.

Cons:

- Forces dependent contracts to import the new vocabulary before their own
  module cutovers are complete.

## Final Recommendation Stack

- `server/src/services/policyAuthoringWorkflowInventory.mjs`
  - classifies policy-builder paths,
  - assigns workflow decisions and roles,
  - marks normal-authoring versus migration/support-only surfaces,
  - validates normal-path exclusions for diagnostics, provider readiness, raw
    scoring weights, starter templates, and presentation tests.
- `server/src/__tests__/services/policyAuthoringWorkflowInventory.test.mjs`
  - scans the live client tree,
  - verifies every current policy-builder surface is classified,
  - pins role and decision behavior for destination context, intent controls,
    starter templates, preview/replay diagnostics, advanced scoring, migration
    notices, bridge utilities, and tests.
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
  - records the durable workflow inventory artifact in the policy-authoring
    completion gate.
- `client/src/components/policies/PolicyBuilderWorkflowShell.vue`
  - renders the server-owned library-first workflow projection without client
    authority over policy persistence, automation, or routing.
- `client/src/components/policies/PolicyBuilderDestinationQuestions.vue` and
  `client/src/components/policies/PolicyDestinationEmptyStateNotice.vue`
  - render the ordered questions and server-owned empty-state actions without
    classifying evidence, persisting intent, or routing media.
- `client/src/composables/usePolicyOperatorWorkflow.js`
  - validates the versioned display-only read contract and discards stale
    library responses before they reach the workflow shell.
- `client/src/composables/usePolicyBuilderLibrarySync.js`
  - coordinates only the explicit authenticated recovery sequence of library
    sync followed by profile refresh; it has no engine authority.

## Current Inventory Summary

The live client tree currently classifies 108 policy-builder paths:

| Decision | Count | Meaning |
| --- | ---: | --- |
| Keep | 30 | Useful as-is for destination-first authoring or implementation support. |
| Rewrite | 68 | Concept survives, but current shape is tied to old modal, templates, tests, or migration support. |
| Replace | 10 | Product need remains, but current UI or mechanic is the wrong model. |

Role split:

| Role | Count |
| --- | ---: |
| Normal authoring path | 39 paths |
| Migration/support-only path | 69 paths |

Normal authoring can include:

- workflow shell responsibilities,
- the server-owned library-first workflow read and display shell,
- destination and observed-library context,
- declared-intent editor and leaf controls,
- destination/reference-data helpers,
- summary and readiness concepts after replacement into next-action surfaces.

Normal authoring must exclude:

- starter-template browser/details/mechanics as the first-class policy model,
- raw advanced scoring and weights,
- replay and impact preview panels,
- provider readiness and TMDB coverage diagnostics,
- migration notices,
- draft bridge internals,
- presentation tests.

## Outcome

The durable workflow inventory cutover:

- renamed the production module to `policyAuthoringWorkflowInventory.mjs`,
- renamed the focused test to `policyAuthoringWorkflowInventory.test.mjs`,
- replaced exported phase-coded workflow constants and helpers with
  `POLICY_AUTHORING_WORKFLOW_*` and `policyAuthoringWorkflow*` names,
- updated downstream authoring contracts to import the durable inventory
  vocabulary,
- moved completion-audit evidence to the durable workflow inventory document.

## Next Step

Continue cutting over the remaining policy-authoring workflow components that
still use phase-coded production names. The next specific component should be
the destination-first flow contract because it directly consumes the workflow
inventory role vocabulary.
