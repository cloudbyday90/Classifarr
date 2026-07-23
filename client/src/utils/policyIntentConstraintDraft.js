/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_INTENT_CONSTRAINT_COMMAND_PLAN_VERSION =
  'policy.intent_constraint_command_plan.v1'

const CONSTRAINT_DRAFT_COMPONENT_ID = 'intent_constraint_draft_adapter'
const TYPED_DRAFT_COMMAND_BOUNDARY = 'typed_draft_commands'
const OPERATOR_DECLARED_SOURCE_ID = 'operator_declared'
const MAX_CONSTRAINT_DRAFT_COMMANDS = 20
const MAX_CONSTRAINT_VALUE_LENGTH = 120

const POLICY_CONSTRAINT_DECISION_MODEL_VERSION = 'policy.constraint_decision_model.v1'
const EXPECTED_CONTROL_IDS = new Set([
  'hard_limit',
  'avoid',
  'review_warning',
])
const EXPECTED_DRAFT_COMMAND_IDS = new Set([
  'set_hard_limit',
  'add_avoid_value',
  'add_review_warning',
])

const MODEL_PROPERTY_IDS = new Set([
  'version',
  'authority',
  'controls',
  'rawPayloadExposed',
])

const AUTHORITY_PROPERTY_IDS = new Set([
  'displayProjection',
  'automationDecision',
  'policyPersistence',
  'routingExecution',
  'runtimeDecision',
  'clientCanInferConstraintMeaning',
])

const CONTROL_PROPERTY_IDS = new Set([
  'controlId',
  'intentId',
  'label',
  'questionId',
  'description',
  'draftCommandId',
  'decisionEffectId',
  'requiresExplicitOperatorAction',
  'observedAbsenceBehaviorId',
  'certificationSemanticId',
  'canBlockAutomaticApplication',
])

const OPERATOR_SELECTION_PROPERTY_IDS = new Set([
  'controlId',
  'value',
  'explicitOperatorAction',
])

const COMMAND_PLAN_PROPERTY_IDS = new Set([
  'version',
  'componentId',
  'commandBoundary',
  'commandCount',
  'commands',
])

const COMMAND_PROPERTY_IDS = new Set([
  'commandId',
  'controlId',
  'intentId',
  'decisionEffectId',
  'certificationSemanticId',
  'values',
  'sourceId',
  'explicitOperatorAction',
  'inferredFromAbsence',
])

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyProperties(value, allowedProperties) {
  return isPlainObject(value) && Object.keys(value).every(property => allowedProperties.has(property))
}

function hasControlCharacter(value) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function normalizeText(value, maximumLength = MAX_CONSTRAINT_VALUE_LENGTH) {
  if (typeof value !== 'string') return ''

  const canonicalValue = value.normalize('NFKC')
  if (hasControlCharacter(canonicalValue)) return ''

  const normalized = canonicalValue.replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length > maximumLength) return ''

  return normalized
}

function isApprovedConstraintDecisionModel(model = {}) {
  if (
    !hasOnlyProperties(model, MODEL_PROPERTY_IDS) ||
    model.version !== POLICY_CONSTRAINT_DECISION_MODEL_VERSION ||
    model.rawPayloadExposed !== false
  ) {
    return false
  }

  const authority = model.authority
  if (
    !hasOnlyProperties(authority, AUTHORITY_PROPERTY_IDS) ||
    authority.displayProjection !== true ||
    authority.automationDecision !== false ||
    authority.policyPersistence !== false ||
    authority.routingExecution !== false ||
    authority.runtimeDecision !== false ||
    authority.clientCanInferConstraintMeaning !== false
  ) {
    return false
  }

  const controls = asArray(model.controls)
  if (controls.length !== EXPECTED_CONTROL_IDS.size) return false

  const controlIds = new Set()
  return controls.every((control) => {
    if (!hasOnlyProperties(control, CONTROL_PROPERTY_IDS)) return false

    const controlId = normalizeText(control.controlId, 80)
    const intentId = normalizeText(control.intentId, 80)
    const label = normalizeText(control.label, 160)
    const questionId = normalizeText(control.questionId, 120)
    const description = normalizeText(control.description, 320)
    const draftCommandId = normalizeText(control.draftCommandId, 80)
    const decisionEffectId = normalizeText(control.decisionEffectId, 80)
    const observedAbsenceBehaviorId = normalizeText(control.observedAbsenceBehaviorId, 80)
    const certificationSemanticId = control.certificationSemanticId === null
      ? null
      : normalizeText(control.certificationSemanticId, 80)

    if (
      !controlId ||
      controlIds.has(controlId) ||
      !EXPECTED_CONTROL_IDS.has(controlId) ||
      !intentId ||
      !label ||
      !questionId ||
      !description ||
      !draftCommandId ||
      !EXPECTED_DRAFT_COMMAND_IDS.has(draftCommandId) ||
      !decisionEffectId ||
      !observedAbsenceBehaviorId ||
      (control.certificationSemanticId !== null && !certificationSemanticId) ||
      typeof control.requiresExplicitOperatorAction !== 'boolean' ||
      typeof control.canBlockAutomaticApplication !== 'boolean'
    ) {
      return false
    }

    controlIds.add(controlId)
    return true
  })
}

function normalizeOperatorSelection(selection = {}) {
  if (!hasOnlyProperties(selection, OPERATOR_SELECTION_PROPERTY_IDS)) return null

  const controlId = normalizeText(selection.controlId, 80)
  const value = normalizeText(selection.value)
  if (!controlId || !value || selection.explicitOperatorAction !== true) return null

  return {
    controlId,
    value,
    explicitOperatorAction: true,
  }
}

function normalizeConstraintDraftCommand(command = {}) {
  if (!hasOnlyProperties(command, COMMAND_PROPERTY_IDS)) return null

  const commandId = normalizeText(command.commandId, 80)
  const controlId = normalizeText(command.controlId, 80)
  const intentId = normalizeText(command.intentId, 80)
  const decisionEffectId = normalizeText(command.decisionEffectId, 80)
  const certificationSemanticId = command.certificationSemanticId === null
    ? null
    : normalizeText(command.certificationSemanticId, 80)
  const values = asArray(command.values)
    .map(value => normalizeText(value))
    .filter(Boolean)

  if (
    !commandId ||
    !controlId ||
    !intentId ||
    !decisionEffectId ||
    (command.certificationSemanticId !== null && !certificationSemanticId) ||
    values.length !== 1 ||
    command.sourceId !== OPERATOR_DECLARED_SOURCE_ID ||
    command.explicitOperatorAction !== true ||
    command.inferredFromAbsence !== false
  ) {
    return null
  }

  return {
    commandId,
    controlId,
    intentId,
    decisionEffectId,
    certificationSemanticId,
    values,
    sourceId: OPERATOR_DECLARED_SOURCE_ID,
    explicitOperatorAction: true,
    inferredFromAbsence: false,
  }
}

function normalizeConstraintDraftCommands(commands = []) {
  const uniqueCommands = new Map()

  asArray(commands).forEach((command) => {
    const normalizedCommand = normalizeConstraintDraftCommand(command)
    if (!normalizedCommand) return

    const commandKey = `${normalizedCommand.controlId}\u0000${normalizedCommand.values[0]}`
    if (!uniqueCommands.has(commandKey)) {
      uniqueCommands.set(commandKey, normalizedCommand)
    }
  })

  return Array.from(uniqueCommands.values()).slice(0, MAX_CONSTRAINT_DRAFT_COMMANDS)
}

function buildPolicyIntentConstraintCommandPlan({ constraintDecisionModel, selection } = {}) {
  if (!isApprovedConstraintDecisionModel(constraintDecisionModel)) return null

  const normalizedSelection = normalizeOperatorSelection(selection)
  if (!normalizedSelection) return null

  const control = constraintDecisionModel.controls.find(candidate => (
    normalizeText(candidate.controlId, 80) === normalizedSelection.controlId
  ))
  if (!control) return null

  const command = normalizeConstraintDraftCommand({
    commandId: control.draftCommandId,
    controlId: control.controlId,
    intentId: control.intentId,
    decisionEffectId: control.decisionEffectId,
    certificationSemanticId: control.certificationSemanticId,
    values: [normalizedSelection.value],
    sourceId: OPERATOR_DECLARED_SOURCE_ID,
    explicitOperatorAction: normalizedSelection.explicitOperatorAction,
    inferredFromAbsence: false,
  })
  if (!command) return null

  return Object.freeze({
    version: POLICY_INTENT_CONSTRAINT_COMMAND_PLAN_VERSION,
    componentId: CONSTRAINT_DRAFT_COMPONENT_ID,
    commandBoundary: TYPED_DRAFT_COMMAND_BOUNDARY,
    commandCount: 1,
    commands: Object.freeze([Object.freeze(command)]),
  })
}

function isPolicyIntentConstraintCommandPlan(commandPlan = {}) {
  if (
    !hasOnlyProperties(commandPlan, COMMAND_PLAN_PROPERTY_IDS) ||
    commandPlan.version !== POLICY_INTENT_CONSTRAINT_COMMAND_PLAN_VERSION ||
    commandPlan.componentId !== CONSTRAINT_DRAFT_COMPONENT_ID ||
    commandPlan.commandBoundary !== TYPED_DRAFT_COMMAND_BOUNDARY ||
    commandPlan.commandCount !== 1
  ) {
    return false
  }

  const commands = normalizeConstraintDraftCommands(commandPlan.commands)
  return commands.length === 1 && asArray(commandPlan.commands).length === 1
}

function applyPolicyIntentConstraintCommandPlan(currentCommands = [], commandPlan = {}) {
  const normalizedCurrentCommands = normalizeConstraintDraftCommands(currentCommands)
  if (!isPolicyIntentConstraintCommandPlan(commandPlan)) return normalizedCurrentCommands

  return normalizeConstraintDraftCommands([
    ...normalizedCurrentCommands,
    ...commandPlan.commands,
  ])
}

export {
  MAX_CONSTRAINT_DRAFT_COMMANDS,
  applyPolicyIntentConstraintCommandPlan,
  buildPolicyIntentConstraintCommandPlan,
  isApprovedConstraintDecisionModel,
  isPolicyIntentConstraintCommandPlan,
  normalizeConstraintDraftCommands,
}
