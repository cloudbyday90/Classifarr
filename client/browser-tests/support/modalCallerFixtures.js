/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

const library = { id: 1, name: 'Movies', media_type: 'movie', arr_id: 1, enabled: true, item_count: 1 }
const workflowLibrary = { id: 1, name: 'Movies', mediaType: 'movie' }
const authority = { displayProjection: true, automationDecision: false, policyPersistence: false, routingExecution: false }
const resolution = {
  stateId: 'unmapped_library', kind: 'owner_action', ownerId: 'destination_empty_state_notice',
  actionId: 'map_routing_destination', message: 'Open library mapping.',
}
const workflow = {
  version: 'policy.operator_workflow_read.v4', statusId: 'ready', library: workflowLibrary,
  authority, rawPayloadExposed: false,
  workflow: {
    title: 'Destination setup', readiness: { stateId: 'unmapped_library', ready: false },
    sections: [{ sectionId: 'can_this_route', heading: 'Can this route', editable: false }],
  },
  readinessPresentation: {
    version: 'policy.operator_workflow_readiness_presentation.v1', primary: resolution,
    issues: [resolution], rawPayloadExposed: false,
  },
  constraintValueEligibility: {
    version: 'policy.constraint_value_eligibility.v1', statusId: 'ready', libraryMediaTypeFamilyId: 'movie',
    authority: { displayProjection: true, serverOwnedAllowlist: true, policyPersistence: false,
      routingExecution: false, runtimeDecision: false, clientMayAddValues: false },
    controls: ['hard_limit', 'avoid', 'review_warning'].map(controlId => ({
      controlId, valueKindId: controlId === 'review_warning' ? 'review_trigger' : 'certification',
      selectionModeId: 'single', allowsFreeText: false,
      options: [{ value: controlId === 'review_warning' ? 'evidence_missing' : 'PG', label: 'Example', description: null }],
    })),
    rawPayloadExposed: false,
  },
  presentation: {
    version: 'policy.authoring_workflow_presentation.v1', revision: 'a'.repeat(43), library: workflowLibrary,
    destinationProposal: { statusId: 'ready', title: 'Movies', summary: 'Review destination mapping.',
      available: false, requiresExplicitAdmission: true,
      observedContext: { available: true, current: true, itemCount: 1, suggestionCount: 0 } },
    nextAction: { kind: resolution.kind, ownerId: resolution.ownerId, actionId: resolution.actionId,
      message: resolution.message, sectionId: 'can_this_route' },
    adjustment: { available: true, statusId: 'available' },
    recovery: { statusId: 'ready', automated: false, message: null },
    authority, rawPayloadExposed: false,
  },
  emptyStateProjection: { states: [{
    stateId: 'unmapped_library', sectionId: 'can_this_route', label: 'Library routing needs a mapping',
    description: 'Connect a routing target.',
    nextAction: { actionId: 'map_routing_destination', label: 'Open library mapping',
      busyLabel: 'Opening library mapping...', mode: 'open_library_mapping' },
  }] },
}

/** Every API request is intercepted; an unlisted read or any mutation fails the test. */
export async function mockModalCallers(page) {
  const unexpected = []
  const responses = new Map([
    ['/api/policies/presets/all', [{ id: 1, name: 'Family Friendly', category: 'audience', signals: {} }]],
    ['/api/presets/custom', []],
    ['/api/presets/custom/save-requests', { request: null }],
    ['/api/policies/presets/1/usage', { count: 0 }],
    ['/api/libraries', [library]],
    ['/api/libraries/1', library],
    ['/api/libraries/1/rules', []],
    ['/api/libraries/1/arr-options', { rootFolders: [], qualityProfiles: [], tags: [] }],
    ['/api/libraries/1/profile', {}],
    ['/api/libraries/1/evidence-coverage', {}],
    ['/api/policies/operator-workflow/libraries/1', workflow],
  ])
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new globalThis.URL(request.url()).pathname
    if (request.method() !== 'GET' || !responses.has(path)) {
      unexpected.push(`${request.method()} ${path}`)
      return route.abort()
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(responses.get(path)) })
  })
  return unexpected
}
