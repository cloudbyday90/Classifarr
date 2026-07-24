/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  isApprovedConstraintDecisionModel,
  normalizeConstraintDraftCommands,
} from '@/utils/policyIntentConstraintDraft'
import {
  getApprovedConstraintValueEligibilityControl,
  isApprovedConstraintValue,
  isApprovedConstraintValueEligibility,
} from '@/utils/policyIntentConstraintValueEligibility'

const CONTROL_PRESENTATION = Object.freeze({
  hard_limit: Object.freeze({
    valueLabel: 'Maximum allowed rating',
    valueEmptyLabel: 'Choose a maximum rating...',
    actionLabel: 'Stage hard limit',
  }),
  avoid: Object.freeze({
    valueLabel: 'Rating to avoid',
    valueEmptyLabel: 'Choose a rating to avoid...',
    actionLabel: 'Stage avoid value',
  }),
  review_warning: Object.freeze({
    valueLabel: 'When should Classifarr ask?',
    valueEmptyLabel: 'Choose a review condition...',
    actionLabel: 'Stage review warning',
  }),
})

const UNAVAILABLE_SURFACE = Object.freeze({
  available: false,
  message: 'Constraint controls are unavailable until Classifarr receives a valid workflow decision model.',
  controls: Object.freeze([]),
  stagedCommandCount: 0,
  stagedCommands: Object.freeze([]),
})

const UNSUPPORTED_MEDIA_TYPE_SURFACE = Object.freeze({
  available: false,
  message: 'Constraint controls are unavailable because this library has no supported canonical rating family.',
  controls: Object.freeze([]),
  stagedCommandCount: 0,
  stagedCommands: Object.freeze([]),
})

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function presentationForControl(controlId) {
  return CONTROL_PRESENTATION[controlId] || null
}

function stagedCommandsForControl(commands, controlId) {
  return commands.filter(command => command.controlId === controlId)
}

function buildConstraintControl(control, eligibilityControl, commands) {
  const presentation = presentationForControl(control.controlId)
  if (!presentation) return null

  const stagedCommands = stagedCommandsForControl(commands, control.controlId)
  const stagedValues = stagedCommands.flatMap(command => command.values)

  return Object.freeze({
    controlId: control.controlId,
    label: control.label,
    description: control.description,
    questionId: control.questionId,
    canBlockAutomaticApplication: control.canBlockAutomaticApplication,
    requiresExplicitOperatorAction: control.requiresExplicitOperatorAction,
    valueLabel: presentation.valueLabel,
    valueEmptyLabel: presentation.valueEmptyLabel,
    actionLabel: presentation.actionLabel,
    confirmationLabel: `I want to stage this ${control.label.toLowerCase()}.`,
    options: Object.freeze(eligibilityControl.options.map(option => Object.freeze({ ...option }))),
    stagedValues: Object.freeze(stagedValues),
  })
}

export function buildPolicyIntentConstraintControlSurface({
  constraintDecisionModel,
  constraintValueEligibility,
  constraintDraftCommands = [],
} = {}) {
  if (
    !isApprovedConstraintDecisionModel(constraintDecisionModel) ||
    !isApprovedConstraintValueEligibility(constraintValueEligibility)
  ) {
    return UNAVAILABLE_SURFACE
  }

  if (constraintValueEligibility.statusId !== 'ready') {
    return UNSUPPORTED_MEDIA_TYPE_SURFACE
  }

  const stagedCommands = normalizeConstraintDraftCommands(constraintDraftCommands)
    .filter(command => isApprovedConstraintValue({
      projection: constraintValueEligibility,
      controlId: command.controlId,
      value: command.values[0],
    }))
  const controls = asArray(constraintDecisionModel.controls)
    .map((control) => {
      const eligibilityControl = getApprovedConstraintValueEligibilityControl(
        constraintValueEligibility,
        control.controlId
      )
      return eligibilityControl
        ? buildConstraintControl(control, eligibilityControl, stagedCommands)
        : null
    })
    .filter(Boolean)

  if (controls.length !== 3) {
    return UNAVAILABLE_SURFACE
  }

  return Object.freeze({
    available: true,
    message: 'Staged constraints stay only in this local draft. They do not save, route media, or change automation in this step.',
    controls: Object.freeze(controls),
    stagedCommandCount: stagedCommands.length,
    stagedCommands: Object.freeze(stagedCommands),
  })
}
