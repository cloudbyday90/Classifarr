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
  MOVIE_CERTIFICATION_ORDER,
  TV_CERTIFICATION_ORDER,
} from './policyEngineUtils.mjs';
import {
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS,
} from './policyAuthoringConstraints.mjs';

const POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION =
  'policy.constraint_value_eligibility.v1';

const POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  UNSUPPORTED_LIBRARY_MEDIA_TYPE: 'unsupported_library_media_type',
});

const POLICY_CONSTRAINT_LIBRARY_MEDIA_TYPE_FAMILY_IDS = Object.freeze({
  MOVIE: 'movie',
  TELEVISION: 'television',
});

const POLICY_CONSTRAINT_VALUE_KIND_IDS = Object.freeze({
  CERTIFICATION: 'certification',
  REVIEW_TRIGGER: 'review_trigger',
});

const POLICY_CONSTRAINT_VALUE_SELECTION_MODE_IDS = Object.freeze({
  SINGLE: 'single',
});

const POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS = Object.freeze({
  INVALID_VERSION: 'invalid_version',
  INVALID_STATUS: 'invalid_status',
  INVALID_AUTHORITY: 'invalid_authority',
  INVALID_RAW_PAYLOAD_BOUNDARY: 'invalid_raw_payload_boundary',
  INVALID_MEDIA_TYPE_FAMILY: 'invalid_media_type_family',
  INVALID_CONTROL_COUNT: 'invalid_control_count',
  UNKNOWN_CONTROL: 'unknown_control',
  INVALID_CONTROL_SHAPE: 'invalid_control_shape',
  INVALID_OPTION_COUNT: 'invalid_option_count',
  INVALID_OPTION_SHAPE: 'invalid_option_shape',
  UNEXPECTED_PROPERTY: 'unexpected_property',
});

const MODEL_PROPERTY_IDS = new Set([
  'version',
  'statusId',
  'libraryMediaTypeFamilyId',
  'authority',
  'controls',
  'rawPayloadExposed',
]);

const AUTHORITY_PROPERTY_IDS = new Set([
  'displayProjection',
  'serverOwnedAllowlist',
  'policyPersistence',
  'routingExecution',
  'runtimeDecision',
  'clientMayAddValues',
]);

const CONTROL_PROPERTY_IDS = new Set([
  'controlId',
  'valueKindId',
  'selectionModeId',
  'allowsFreeText',
  'options',
]);

const OPTION_PROPERTY_IDS = new Set([
  'value',
  'label',
  'description',
]);

const REVIEW_TRIGGER_OPTIONS = Object.freeze([
  Object.freeze({
    value: 'evidence_missing',
    label: 'Evidence is missing',
    description: 'Ask when Classifarr does not have enough evidence to automate safely.',
  }),
  Object.freeze({
    value: 'evidence_conflicting',
    label: 'Evidence conflicts',
    description: 'Ask when strong signals point to different destinations.',
  }),
  Object.freeze({
    value: 'profile_stale',
    label: 'Library profile is stale',
    description: 'Ask when the observed library profile needs refresh before automation.',
  }),
  Object.freeze({
    value: 'routing_not_ready',
    label: 'Routing is not ready',
    description: 'Ask when a destination can be reviewed but cannot route safely.',
  }),
]);

const RATING_CONTROL_IDS = Object.freeze([
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.HARD_LIMIT,
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.AVOID,
]);

const ALL_CONTROL_IDS = Object.freeze([
  ...RATING_CONTROL_IDS,
  POLICY_AUTHORING_CONSTRAINT_CONTROL_IDS.REVIEW_WARNING,
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value).forEach(item => deepFreeze(item));
  return value;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyProperties(value, allowedProperties) {
  return isPlainObject(value) && Object.keys(value).every(property => allowedProperties.has(property));
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string') return '';

  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.length <= maximumLength ? normalized : '';
}

function normalizeLibraryMediaTypeFamily(library = {}) {
  const rawMediaType = normalizeString(library?.media_type ?? library?.mediaType, 80)
    .toLowerCase();

  if (['movie', 'movies', 'film', 'films'].includes(rawMediaType)) {
    return POLICY_CONSTRAINT_LIBRARY_MEDIA_TYPE_FAMILY_IDS.MOVIE;
  }

  if (['show', 'shows', 'tv', 'television', 'series'].includes(rawMediaType)) {
    return POLICY_CONSTRAINT_LIBRARY_MEDIA_TYPE_FAMILY_IDS.TELEVISION;
  }

  return null;
}

function buildCertificationOptions(familyId) {
  const order = familyId === POLICY_CONSTRAINT_LIBRARY_MEDIA_TYPE_FAMILY_IDS.MOVIE
    ? MOVIE_CERTIFICATION_ORDER
    : familyId === POLICY_CONSTRAINT_LIBRARY_MEDIA_TYPE_FAMILY_IDS.TELEVISION
      ? TV_CERTIFICATION_ORDER
      : [];

  return order.map(value => ({
    value,
    label: value,
    description: null,
  }));
}

function buildValueEligibilityControl(controlId, familyId) {
  const isRatingControl = RATING_CONTROL_IDS.includes(controlId);
  const options = isRatingControl
    ? buildCertificationOptions(familyId)
    : REVIEW_TRIGGER_OPTIONS;

  return {
    controlId,
    valueKindId: isRatingControl
      ? POLICY_CONSTRAINT_VALUE_KIND_IDS.CERTIFICATION
      : POLICY_CONSTRAINT_VALUE_KIND_IDS.REVIEW_TRIGGER,
    selectionModeId: POLICY_CONSTRAINT_VALUE_SELECTION_MODE_IDS.SINGLE,
    allowsFreeText: false,
    options,
  };
}

function buildPolicyConstraintValueEligibility({ library } = {}) {
  const libraryMediaTypeFamilyId = normalizeLibraryMediaTypeFamily(library);
  const available = libraryMediaTypeFamilyId !== null;

  return deepFreeze({
    version: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION,
    statusId: available
      ? POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS.READY
      : POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS.UNSUPPORTED_LIBRARY_MEDIA_TYPE,
    libraryMediaTypeFamilyId,
    authority: {
      displayProjection: true,
      serverOwnedAllowlist: true,
      policyPersistence: false,
      routingExecution: false,
      runtimeDecision: false,
      clientMayAddValues: false,
    },
    controls: available
      ? ALL_CONTROL_IDS.map(controlId => buildValueEligibilityControl(controlId, libraryMediaTypeFamilyId))
      : [],
    rawPayloadExposed: false,
  });
}

function buildPolicyConstraintValueEligibilityAudit(projection = {}, { library } = {}) {
  const expected = buildPolicyConstraintValueEligibility({ library });
  const issues = [];

  if (!hasOnlyProperties(projection, MODEL_PROPERTY_IDS)) {
    issues.push({
      riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.UNEXPECTED_PROPERTY,
      message: 'Constraint value eligibility must expose only approved display fields.',
    });
  }

  if (projection?.version !== POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION) {
    issues.push({
      riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_VERSION,
      message: 'Constraint value eligibility must use the current version.',
    });
  }

  if (projection?.statusId !== expected.statusId) {
    issues.push({
      riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_STATUS,
      message: 'Constraint value eligibility status must match the library media type.',
    });
  }

  if (projection?.libraryMediaTypeFamilyId !== expected.libraryMediaTypeFamilyId) {
    issues.push({
      riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_MEDIA_TYPE_FAMILY,
      message: 'Constraint value eligibility must use the normalized library media-type family.',
    });
  }

  if (
    !hasOnlyProperties(projection?.authority, AUTHORITY_PROPERTY_IDS) ||
    projection.authority.displayProjection !== true ||
    projection.authority.serverOwnedAllowlist !== true ||
    projection.authority.policyPersistence !== false ||
    projection.authority.routingExecution !== false ||
    projection.authority.runtimeDecision !== false ||
    projection.authority.clientMayAddValues !== false
  ) {
    issues.push({
      riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_AUTHORITY,
      message: 'Constraint value eligibility must remain a server-owned, display-only allowlist.',
    });
  }

  if (projection?.rawPayloadExposed !== false) {
    issues.push({
      riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_RAW_PAYLOAD_BOUNDARY,
      message: 'Constraint value eligibility must not expose raw media or provider payloads.',
    });
  }

  const controls = Array.isArray(projection?.controls) ? projection.controls : [];
  if (controls.length !== expected.controls.length) {
    issues.push({
      riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_CONTROL_COUNT,
      message: 'Constraint value eligibility must expose the expected controls exactly once.',
    });
  }

  const seenControlIds = new Set();
  controls.forEach((control) => {
    const controlId = normalizeString(control?.controlId, 80);
    const expectedControl = expected.controls.find(candidate => candidate.controlId === controlId);
    if (!expectedControl || seenControlIds.has(controlId)) {
      issues.push({
        riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.UNKNOWN_CONTROL,
        controlId: controlId || null,
        message: 'Constraint value eligibility must use known, non-duplicated controls.',
      });
      return;
    }
    seenControlIds.add(controlId);

    if (!hasOnlyProperties(control, CONTROL_PROPERTY_IDS)) {
      issues.push({
        riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.UNEXPECTED_PROPERTY,
        controlId,
        message: 'Constraint value controls must expose only approved display fields.',
      });
    }

    if (
      control.valueKindId !== expectedControl.valueKindId ||
      control.selectionModeId !== expectedControl.selectionModeId ||
      control.allowsFreeText !== false
    ) {
      issues.push({
        riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_CONTROL_SHAPE,
        controlId,
        message: 'Constraint value controls must keep their server-owned value kind and selection mode.',
      });
    }

    const options = Array.isArray(control.options) ? control.options : [];
    if (options.length !== expectedControl.options.length) {
      issues.push({
        riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_OPTION_COUNT,
        controlId,
        message: 'Constraint value controls must expose the exact bounded option count.',
      });
    }

    options.forEach((option, index) => {
      const expectedOption = expectedControl.options[index];
      if (!expectedOption || !hasOnlyProperties(option, OPTION_PROPERTY_IDS) ||
        option.value !== expectedOption.value ||
        option.label !== expectedOption.label ||
        option.description !== expectedOption.description) {
        issues.push({
          riskId: POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS.INVALID_OPTION_SHAPE,
          controlId,
          value: option?.value || null,
          message: 'Constraint value options must remain the exact server-owned allowlist.',
        });
      }
    });
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function isPolicyConstraintValueEligible({ projection, controlId, value } = {}) {
  const control = Array.isArray(projection?.controls)
    ? projection.controls.find(candidate => candidate?.controlId === controlId)
    : null;

  return projection?.statusId === POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS.READY &&
    control?.allowsFreeText === false &&
    Array.isArray(control.options) &&
    control.options.some(option => option?.value === value);
}

export {
  POLICY_CONSTRAINT_LIBRARY_MEDIA_TYPE_FAMILY_IDS,
  POLICY_CONSTRAINT_VALUE_ELIGIBILITY_RISK_IDS,
  POLICY_CONSTRAINT_VALUE_ELIGIBILITY_STATUS_IDS,
  POLICY_CONSTRAINT_VALUE_ELIGIBILITY_VERSION,
  POLICY_CONSTRAINT_VALUE_KIND_IDS,
  POLICY_CONSTRAINT_VALUE_SELECTION_MODE_IDS,
  buildPolicyConstraintValueEligibility,
  buildPolicyConstraintValueEligibilityAudit,
  isPolicyConstraintValueEligible,
  normalizeLibraryMediaTypeFamily,
};
