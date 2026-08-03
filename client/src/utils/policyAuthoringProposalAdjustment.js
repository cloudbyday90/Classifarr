/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS = Object.freeze({
  SET_PURPOSE_GENRES: 'set_purpose_genres',
  SET_HELPFUL_STUDIOS: 'set_helpful_studios',
})

const CURRENT_LIBRARY_PROFILE_SOURCE_ID = 'current_library_profile'
const MAX_ADJUSTMENT_COMMANDS = 2
const MAX_PURPOSE_GENRES = 12
const MAX_HELPFUL_STUDIOS = 3
const MAX_ADJUSTMENT_VALUE_LENGTH = 120

const ADJUSTMENT_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
    maximumValues: MAX_PURPOSE_GENRES,
  }),
  Object.freeze({
    commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
    maximumValues: MAX_HELPFUL_STUDIOS,
  }),
])

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

function findConfiguration(commandId) {
  return ADJUSTMENT_CONFIGURATIONS.find(configuration => configuration.commandId === commandId) || null
}

function normalizeValue(value) {
  if (typeof value !== 'string') return null

  const normalized = value
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized && normalized.length <= MAX_ADJUSTMENT_VALUE_LENGTH ? normalized : null
}

function normalizeValues(value, maximumValues) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumValues) return null

  const values = value.map(normalizeValue)
  return values.some(entry => !entry) || new Set(values).size !== values.length ? null : values
}

function normalizeOptions(value, maximumValues) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumValues) return []

  const options = value.map(entry => {
    if (!hasOnlyKeys(entry, ['value', 'sourceId']) || entry.sourceId !== CURRENT_LIBRARY_PROFILE_SOURCE_ID) {
      return null
    }

    const normalizedValue = normalizeValue(entry.value)
    return normalizedValue
      ? Object.freeze({ value: normalizedValue, sourceId: CURRENT_LIBRARY_PROFILE_SOURCE_ID })
      : null
  })

  return options.some(option => !option) || new Set(options.map(option => option.value)).size !== options.length
    ? []
    : Object.freeze(options)
}

function normalizeAdjustmentCommands(value) {
  if (!Array.isArray(value) || value.length > MAX_ADJUSTMENT_COMMANDS) return null
  if (value.length === 0) return Object.freeze([])

  const commandIds = new Set()
  const commands = value.map(entry => {
    const command = asObject(entry)
    const configuration = findConfiguration(command?.commandId)
    if (!configuration || !hasOnlyKeys(command, ['commandId', 'values']) || commandIds.has(configuration.commandId)) {
      return null
    }

    const values = normalizeValues(command.values, configuration.maximumValues)
    if (!values) return null

    commandIds.add(configuration.commandId)
    return Object.freeze({
      commandId: configuration.commandId,
      values: Object.freeze(values),
    })
  })

  if (commands.some(command => !command)) return null

  return Object.freeze(commands.sort((left, right) => (
    ADJUSTMENT_CONFIGURATIONS.findIndex(configuration => configuration.commandId === left.commandId) -
    ADJUSTMENT_CONFIGURATIONS.findIndex(configuration => configuration.commandId === right.commandId)
  )))
}

function buildNarrowingCommand({ options, selectedValues, commandId }) {
  const configuration = findConfiguration(commandId)
  const normalizedOptions = configuration && normalizeOptions(options, configuration.maximumValues)
  const normalizedSelectedValues = configuration && normalizeValues(selectedValues, configuration.maximumValues)
  if (!configuration || !normalizedOptions.length || !normalizedSelectedValues) return null

  const optionValues = normalizedOptions.map(option => option.value)
  if (normalizedSelectedValues.some(value => !optionValues.includes(value))) return null

  if (normalizedSelectedValues.length === optionValues.length &&
    normalizedSelectedValues.every(value => optionValues.includes(value))) {
    return Object.freeze([])
  }

  return normalizeAdjustmentCommands([{ commandId, values: normalizedSelectedValues }])
}

/**
 * Validates the display-safe, server-projected genre options. Only values
 * obtained from the current profile may become a narrowing command.
 */
export function normalizePolicyAuthoringProposalPurposeGenreOptions(value) {
  return normalizeOptions(value, MAX_PURPOSE_GENRES)
}

/**
 * Validates the display-safe, server-projected helpful-studio options. Only
 * values obtained from the current profile may become a narrowing command.
 */
export function normalizePolicyAuthoringProposalHelpfulStudioOptions(value) {
  return normalizeOptions(value, MAX_HELPFUL_STUDIOS)
}

/**
 * Normalizes browser state before it becomes a transport command. The server
 * remains the authority and repeats this validation against the proposal.
 */
export function normalizePolicyAuthoringProposalAdjustmentCommands(value) {
  return normalizeAdjustmentCommands(value)
}

/**
 * Returns no command when proposed genres are unchanged; otherwise returns the
 * sole allow-listed purpose-genre narrowing command or null for invalid input.
 *
 * @param {{ options?: Array<{ value: string, sourceId: string }>, selectedValues?: string[] }} input
 */
export function buildPolicyAuthoringProposalPurposeGenreAdjustmentCommands(/** @type {{ options?: Array<{ value: string, sourceId: string }>, selectedValues?: string[] }} */ {
  options,
  selectedValues,
} = {}) {
  return buildNarrowingCommand({
    options,
    selectedValues,
    commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
  })
}

/**
 * Returns no command when helpful studios are unchanged; otherwise returns the
 * sole allow-listed helpful-studio narrowing command or null for invalid input.
 *
 * @param {{ options?: Array<{ value: string, sourceId: string }>, selectedValues?: string[] }} input
 */
export function buildPolicyAuthoringProposalHelpfulStudioAdjustmentCommands(/** @type {{ options?: Array<{ value: string, sourceId: string }>, selectedValues?: string[] }} */ {
  options,
  selectedValues,
} = {}) {
  return buildNarrowingCommand({
    options,
    selectedValues,
    commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
  })
}

/**
 * Combines only currently projected adjustment groups into canonical command
 * order. Missing groups remain unchanged rather than becoming a client error.
 *
 * @param {{ purposeGenreOptions?: Array<{ value: string, sourceId: string }>, selectedPurposeGenreValues?: string[], helpfulStudioOptions?: Array<{ value: string, sourceId: string }>, selectedHelpfulStudioValues?: string[] }} input
 */
export function buildPolicyAuthoringProposalAdjustmentCommands(/** @type {{ purposeGenreOptions?: Array<{ value: string, sourceId: string }>, selectedPurposeGenreValues?: string[], helpfulStudioOptions?: Array<{ value: string, sourceId: string }>, selectedHelpfulStudioValues?: string[] }} */ input = {}) {
  const source = asObject(input)
  if (!source) return null

  const groups = [
    {
      options: source.purposeGenreOptions,
      selectedValues: source.selectedPurposeGenreValues,
      commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_PURPOSE_GENRES,
    },
    {
      options: source.helpfulStudioOptions,
      selectedValues: source.selectedHelpfulStudioValues,
      commandId: POLICY_AUTHORING_PROPOSAL_ADJUSTMENT_COMMAND_IDS.SET_HELPFUL_STUDIOS,
    },
  ].filter(group => Array.isArray(group.options) && group.options.length > 0)

  const commands = groups.map(buildNarrowingCommand)
  if (commands.some(command => command === null)) return null

  return normalizeAdjustmentCommands(commands.flat())
}
