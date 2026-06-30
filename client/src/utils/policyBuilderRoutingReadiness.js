/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const ROUTING_READINESS_TARGETS = Object.freeze({
  LIBRARY_CONTEXT: 'policy-builder-library-context',
  ROUTING_READINESS: 'policy-builder-routing-readiness',
  ADVANCED_SETTINGS: 'policy-builder-advanced-settings',
})

const ROUTING_READINESS_STATUS = Object.freeze({
  NEEDS_LIBRARY: 'needs_library',
  NEEDS_ROUTING_TARGET: 'needs_routing_target',
  NEEDS_ROOT_FOLDER: 'needs_root_folder',
  READY: 'ready',
})

const ARR_TYPE_LABELS = Object.freeze({
  radarr: 'Radarr',
  sonarr: 'Sonarr',
})

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function firstPresentString(...values) {
  return values.map(normalizeString).find(Boolean) || ''
}

function firstPresentValue(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

function normalizeArrType(value) {
  const normalized = normalizeString(value).toLowerCase()
  return normalized === 'radarr' || normalized === 'sonarr' ? normalized : ''
}

function inferArrTypeFromMediaType(mediaType) {
  const normalized = normalizeString(mediaType).toLowerCase()

  if (normalized === 'movie') return 'radarr'
  if (['tv', 'show', 'series'].includes(normalized)) return 'sonarr'

  return ''
}

function resolveRoutingSource(library = {}) {
  const mapping = library.arr_mapping || library.mapping || {}
  const radarrSettings = library.radarr_settings || {}
  const sonarrSettings = library.sonarr_settings || {}

  const arrType = normalizeArrType(firstPresentValue(
    library.arr_type,
    library.arrType,
    mapping.arr_type,
    mapping.arrType,
  ))

  const expectedArrType = arrType || inferArrTypeFromMediaType(library.media_type || library.mediaType)
  const activeSettings = expectedArrType === 'sonarr' ? sonarrSettings : radarrSettings

  const arrConfigId = firstPresentValue(
    library.arr_config_id,
    library.arrConfigId,
    library.arr_id,
    library.arrId,
    mapping.arr_config_id,
    mapping.arrConfigId,
    library.arr_config?.id,
    library.arrConfig?.id,
  )

  const rootFolder = firstPresentString(
    library.arr_root_folder_path,
    library.arrRootFolderPath,
    library.root_folder,
    library.rootFolder,
    library.root_folder_path,
    library.rootFolderPath,
    mapping.arr_root_folder_path,
    mapping.arrRootFolderPath,
    mapping.root_folder,
    mapping.rootFolder,
    activeSettings.root_folder_path,
    activeSettings.rootFolderPath,
  )

  return {
    arrType: arrType || expectedArrType,
    arrConfigId,
    rootFolder,
    hasExplicitRoutingTarget: Boolean(arrType || arrConfigId || rootFolder),
  }
}

function buildPolicyBuilderRoutingReadiness({ library = null, form = null } = {}) {
  const libraryId = firstPresentValue(library?.id, form?.library_id, form?.libraryId)

  if (!libraryId) {
    return {
      status: ROUTING_READINESS_STATUS.NEEDS_LIBRARY,
      tone: 'warning',
      canRoute: false,
      label: 'Choose a destination library',
      message: 'Select a media-server library before checking where approved matches can be sent.',
      nextActionLabel: 'Choose library',
      targetId: ROUTING_READINESS_TARGETS.LIBRARY_CONTEXT,
      facts: [],
    }
  }

  const routing = resolveRoutingSource(library || {})
  const serviceLabel = ARR_TYPE_LABELS[routing.arrType] || 'Arr'
  const libraryName = normalizeString(library?.name) || 'Selected library'
  const facts = [
    { label: 'Library', value: libraryName },
    { label: 'Destination service', value: serviceLabel },
  ]

  if (!routing.hasExplicitRoutingTarget || !routing.arrType || !routing.arrConfigId) {
    return {
      status: ROUTING_READINESS_STATUS.NEEDS_ROUTING_TARGET,
      tone: 'warning',
      canRoute: false,
      label: 'Connect a routing target',
      message: `${libraryName} needs a mapped ${serviceLabel} destination before approved matches can route automatically.`,
      nextActionLabel: 'Review routing settings',
      targetId: ROUTING_READINESS_TARGETS.ADVANCED_SETTINGS,
      facts,
    }
  }

  if (!routing.rootFolder) {
    return {
      status: ROUTING_READINESS_STATUS.NEEDS_ROOT_FOLDER,
      tone: 'warning',
      canRoute: false,
      label: 'Choose a root folder',
      message: `${libraryName} is connected to ${serviceLabel}, but it still needs a root folder for approved matches.`,
      nextActionLabel: 'Review routing settings',
      targetId: ROUTING_READINESS_TARGETS.ADVANCED_SETTINGS,
      facts,
    }
  }

  return {
    status: ROUTING_READINESS_STATUS.READY,
    tone: 'success',
    canRoute: true,
    label: 'Routing target ready',
    message: `${libraryName} can send approved matches to ${serviceLabel} at ${routing.rootFolder}.`,
    nextActionLabel: '',
    targetId: ROUTING_READINESS_TARGETS.ROUTING_READINESS,
    facts: [
      ...facts,
      { label: 'Root folder', value: routing.rootFolder },
    ],
  }
}

export {
  ROUTING_READINESS_STATUS,
  ROUTING_READINESS_TARGETS,
  buildPolicyBuilderRoutingReadiness,
  inferArrTypeFromMediaType,
  resolveRoutingSource,
}
