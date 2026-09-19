/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const proposalVersion = 'policy.authoring_proposal.v1'
export const library = { id: 7, name: 'Movies', media_type: 'movie' }
export const lifecycle = {
  version: proposalVersion, statusId: 'eligible_to_prepare_proposal',
  library: { id: 7, name: 'Movies', mediaType: 'movie' },
  action: { id: 'prepare_proposal', available: true }, policy: null,
  proposal: { available: true, reasonId: 'current_profile_candidate_available' },
}
export const existingLifecycle = {
  ...lifecycle, statusId: 'existing_native_policy',
  action: { id: 'inspect_policy', available: false }, policy: { id: 99, name: 'Movies Policy' },
  proposal: { available: false, reasonId: 'existing_native_policy' },
}
export const unavailableLifecycle = {
  ...lifecycle, statusId: 'proposal_unavailable', action: { id: 'inspect_policy', available: false },
  proposal: { available: false, reasonId: 'profile_does_not_support_a_safe_proposal' },
}

export const fulfillJson = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Network-isolated fixtures use current strict contracts; no swallowed browser actions. */
export async function mockProposalPage(page, { getLifecycle, onAdmission }) {
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new globalThis.URL(route.request().url()).pathname
    if (path === '/api/setup/status') return fulfillJson(route, { setupRequired: false })
    if (['/api/auth/me', '/api/user/me'].includes(path)) return fulfillJson(route, { id: 1, role: 'admin', username: 'Admin' })
    if (path === '/api/notifications/unread-count') return fulfillJson(route, { unread: 0 })
    if (path === '/api/notifications') return fulfillJson(route, { data: [] })
    if (path === '/api/notifications/active') return fulfillJson(route, [])
    if (path === '/api/system/health') return fulfillJson(route, {
      database: 'healthy', mediaServer: 'healthy', radarr: 'healthy', sonarr: 'healthy',
      ollama: 'healthy', imageEmbeddings: 'healthy', tmdb: 'healthy', omdb: 'healthy',
      discordBot: 'healthy', tavily: 'healthy', queueWorker: 'healthy', details: {},
    })
    if (path === '/api/libraries') return fulfillJson(route, [library])
    if (path.endsWith('/authoring-lifecycle')) return fulfillJson(route, getLifecycle())
    if (path.endsWith('/proposals')) return fulfillJson(route, {
      version: proposalVersion, statusId: 'proposal_prepared', lifecycle,
      proposal: { reference: 'proposal_browser_fixture_reference', revision: 'b'.repeat(64),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        adjustment: { purposeGenres: [{ value: 'Animation', sourceId: 'current_library_profile' }], helpfulStudios: [] },
        summary: { title: 'Movies Policy', purpose: [{ signalType: 'genres', operator: 'any_of', values: ['Animation'] }],
          helpfulHints: [], hardLimitCount: 0, avoidCount: 0 } },
    })
    if (path.endsWith('/proposal_browser_fixture_reference/admission')) return onAdmission(route)
    return fulfillJson(route, {}, 404)
  })
}
