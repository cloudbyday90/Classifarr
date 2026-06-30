/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  ROUTING_READINESS_STATUS,
  buildPolicyBuilderRoutingReadiness,
  inferArrTypeFromMediaType,
  resolveRoutingSource,
} from '@/utils/policyBuilderRoutingReadiness'

describe('policyBuilderRoutingReadiness', () => {
  it('asks operators to choose a library before checking routing', () => {
    const readiness = buildPolicyBuilderRoutingReadiness()

    expect(readiness).toMatchObject({
      status: ROUTING_READINESS_STATUS.NEEDS_LIBRARY,
      canRoute: false,
      label: 'Choose a destination library',
      targetId: 'policy-builder-library-context',
    })
  })

  it('asks operators to connect a routing target when the selected library is unmapped', () => {
    const readiness = buildPolicyBuilderRoutingReadiness({
      library: { id: 4, name: 'Family Movies', media_type: 'movie' },
      form: { library_id: 4 },
    })

    expect(readiness).toMatchObject({
      status: ROUTING_READINESS_STATUS.NEEDS_ROUTING_TARGET,
      canRoute: false,
      label: 'Connect a routing target',
      targetId: 'policy-builder-advanced-settings',
    })
    expect(readiness.message).toContain('Family Movies needs a mapped Radarr destination')
  })

  it('asks for a root folder when Arr is configured without a destination path', () => {
    const readiness = buildPolicyBuilderRoutingReadiness({
      library: {
        id: 7,
        name: 'Shows',
        media_type: 'tv',
        arr_type: 'sonarr',
        arr_id: 2,
      },
    })

    expect(readiness).toMatchObject({
      status: ROUTING_READINESS_STATUS.NEEDS_ROOT_FOLDER,
      canRoute: false,
      label: 'Choose a root folder',
      targetId: 'policy-builder-advanced-settings',
    })
    expect(readiness.message).toContain('connected to Sonarr')
  })

  it('marks mapped movie libraries ready without exposing internal diagnostics', () => {
    const readiness = buildPolicyBuilderRoutingReadiness({
      library: {
        id: 1,
        name: 'Animated Movies',
        media_type: 'movie',
        arr_type: 'radarr',
        arr_id: 1,
        root_folder: '/media/Plexmedia/Animated Movies',
      },
    })

    expect(readiness).toMatchObject({
      status: ROUTING_READINESS_STATUS.READY,
      canRoute: true,
      label: 'Routing target ready',
    })
    expect(readiness.message).toContain('Radarr at /media/Plexmedia/Animated Movies')
    expect(readiness.message).not.toMatch(/arr_config_id|library_arr_mappings|diagnostic|resolver/i)
  })

  it('reads modern mapping-shaped library data', () => {
    const routing = resolveRoutingSource({
      id: 9,
      name: 'Anime',
      mediaType: 'tv',
      mapping: {
        arrType: 'sonarr',
        arrConfigId: 3,
        arrRootFolderPath: '/tv/anime',
      },
    })

    expect(routing).toEqual({
      arrType: 'sonarr',
      arrConfigId: 3,
      rootFolder: '/tv/anime',
      hasExplicitRoutingTarget: true,
    })
  })

  it('infers the expected service from media type only for visible guidance', () => {
    expect(inferArrTypeFromMediaType('movie')).toBe('radarr')
    expect(inferArrTypeFromMediaType('show')).toBe('sonarr')
    expect(inferArrTypeFromMediaType('music')).toBe('')
  })
})
