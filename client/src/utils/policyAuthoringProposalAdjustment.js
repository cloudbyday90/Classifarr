/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS = Object.freeze({
  SET_PURPOSE_GENRES: 'set_purpose_genres',
})

const CURRENT_LIBRARY_PROFILE_SOURCE_ID = 'current_library_profile'
const MAX_PURPOSE_GENRES = 12
const MAX_PURPOSE_GENRE_LENGTH = 120

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function hasOnlyKeys(value, expectedKeys) {
  const source = asObject(value)
  if (!source) return false

  const keys = Object.keys(source).sort()
  const allowedKeys = [...expectedKeys].sort()
  return keys.length === allowedKeys.length && keys.every((key, index) => key === allowedKeys[index])
}

function normalizeGenre(value) {
  if (typeof value !== 'string') return null

  const normalized = value
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized && normalized.length <= MAX_PURPOSE_GENRE_LENGTH ? normalized : null
}

function normalizeGenres(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PURPOSE_GENRES) return null

  const genres = value.map(normalizeGenre)
  return genres.some(genre => !genre) || new Set(genres).size !== genres.length ? null : genres
}

/**
 * Validates the display-safe, server-projected options. Only values obtained
 * from the current profile may become a narrowing command.
 */
export function normalizePolicyAuthoringProposalPurposeGenreOptions(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PURPOSE_GENRES) return []

  const options = value.map(entry => {
    if (!hasOnlyKeys(entry, ['value', 'sourceId']) || entry.sourceId !== CURRENT_LIBRARY_PROFILE_SOURCE_ID) {
      return null
    }

    const genre = normalizeGenre(entry.value)
    return genre ? Object.freeze({ value: genre, sourceId: CURRENT_LIBRARY_PROFILE_SOURCE_ID }) : null
  })

  return options.some(option => !option) || new Set(options.map(option => option.value)).size !== options.length
    ? []
    : Object.freeze(options)
}

/**
 * Normalizes browser state before it becomes a transport command. The server
 * remains the authority and repeats this validation against the proposal.
 */
export function normalizePolicyAuthoringProposalAdjustmentCommands(value) {
  if (!Array.isArray(value) || value.length > 1) return null
  if (value.length === 0) return Object.freeze([])

  const command = asObject(value[0])
  if (
    !hasOnlyKeys(command, ['commandId', 'values']) ||
    command.commandId !== POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES
  ) {
    return null
  }

  const values = normalizeGenres(command.values)
  return values
    ? Object.freeze([Object.freeze({
      commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
      values: Object.freeze(values),
    })])
    : null
}

/**
 * Returns no command when the proposal is unchanged; otherwise returns the
 * sole allow-listed narrowing command or null for an invalid selection.
 *
 * @param {{ options?: Array<{ value: string, sourceId: string }>, selectedValues?: string[] }} input
 */
export function buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands(/** @type {{ options?: Array<{ value: string, sourceId: string }>, selectedValues?: string[] }} */ {
  options,
  selectedValues,
} = {}) {
  const normalizedOptions = normalizePolicyAuthoringProposalPurposeGenreOptions(options)
  const normalizedSelectedValues = normalizeGenres(selectedValues)
  if (!normalizedOptions.length || !normalizedSelectedValues) return null

  const optionValues = normalizedOptions.map(option => option.value)
  if (normalizedSelectedValues.some(value => !optionValues.includes(value))) return null

  if (normalizedSelectedValues.length === optionValues.length &&
    normalizedSelectedValues.every(value => optionValues.includes(value))) {
    return Object.freeze([])
  }

  return normalizePolicyAuthoringProposalAdjustmentCommands([{
    commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
    values: normalizedSelectedValues,
  }])
}
