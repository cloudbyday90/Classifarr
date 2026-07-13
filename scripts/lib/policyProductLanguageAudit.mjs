/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const POLICY_PRODUCT_LANGUAGE_AUDIT_VERSION =
  'policy.product_language_audit.v1';

const POLICY_PRODUCT_LANGUAGE_AUDIT_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED: 'blocked',
});

const POLICY_PRODUCT_LANGUAGE_SURFACE_IDS = Object.freeze({
  RUNTIME_UI: 'runtime_ui',
  RUNTIME_SERVER: 'runtime_server',
  OPERATOR_COMMANDS: 'operator_commands',
  API_DOCUMENTATION: 'api_documentation',
  PRODUCT_DOCUMENTATION: 'product_documentation',
  RELEASE_NOTES: 'release_notes',
  UNRELEASED_CHANGELOG: 'unreleased_changelog',
});

const POLICY_PRODUCT_LANGUAGE_RISK_IDS = Object.freeze({
  MISSING_REQUIRED_SURFACE: 'missing_required_surface',
  EMPTY_REQUIRED_SURFACE: 'empty_required_surface',
  TEMPORARY_DELIVERY_LANGUAGE: 'temporary_delivery_language',
});

const REQUIRED_SURFACE_IDS = Object.freeze(Object.values(
  POLICY_PRODUCT_LANGUAGE_SURFACE_IDS
));

import { findDeliveryTermMatches } from './policyDeliveryTermMatcher.mjs';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRepoPath(value) {
  return normalizeString(value).replaceAll('\\', '/').replace(/^\/+/, '');
}

function uniqueByValue(values) {
  return [...new Set(values.filter(Boolean))];
}

function findTemporaryDeliveryLanguage(content) {
  return findDeliveryTermMatches(content);
}

function normalizeSurface(surface) {
  const normalizedSurface = asObject(surface);

  return {
    surfaceId: normalizeString(normalizedSurface.surfaceId),
    files: asArray(normalizedSurface.files)
      .map(file => ({
        path: normalizeRepoPath(asObject(file).path),
        content: typeof asObject(file).content === 'string' ? asObject(file).content : '',
      }))
      .filter(file => file.path),
  };
}

function buildSummary({ surfaces, findings }) {
  const normalizedSurfaces = asArray(surfaces);
  const normalizedFindings = asArray(findings);
  const bySurface = {};

  normalizedSurfaces.forEach(surface => {
    bySurface[surface.surfaceId] = {
      fileCount: surface.files.length,
      matchCount: normalizedFindings.filter(finding =>
        finding.surfaceId === surface.surfaceId
      ).length,
    };
  });

  return {
    surfaceCount: normalizedSurfaces.length,
    fileCount: normalizedSurfaces.reduce((total, surface) => total + surface.files.length, 0),
    matchCount: normalizedFindings.length,
    bySurface,
  };
}

function buildPolicyProductLanguageAudit({
  surfaces = [],
  generatedAt = new Date().toISOString(),
} = {}) {
  const normalizedSurfaces = asArray(surfaces).map(normalizeSurface);
  const surfaceIds = uniqueByValue(normalizedSurfaces.map(surface => surface.surfaceId));
  const risks = [];

  REQUIRED_SURFACE_IDS.forEach(surfaceId => {
    if (!surfaceIds.includes(surfaceId)) {
      risks.push({
        riskId: POLICY_PRODUCT_LANGUAGE_RISK_IDS.MISSING_REQUIRED_SURFACE,
        surfaceId,
      });
      return;
    }

    const surface = normalizedSurfaces.find(candidate => candidate.surfaceId === surfaceId);

    const hasUsableContent = surface.files.some(file => normalizeString(file.content));

    if (surface.files.length === 0 || !hasUsableContent) {
      risks.push({
        riskId: POLICY_PRODUCT_LANGUAGE_RISK_IDS.EMPTY_REQUIRED_SURFACE,
        surfaceId,
      });
    }
  });

  const findings = normalizedSurfaces.flatMap(surface =>
    surface.files.flatMap(file =>
      findTemporaryDeliveryLanguage(file.content).map(finding => ({
        surfaceId: surface.surfaceId,
        repoPath: file.path,
        lineNumber: finding.lineNumber,
        matcherId: finding.matcherId,
        token: finding.token,
      }))
    )
  );

  findings.forEach(finding => {
    risks.push({
      riskId: POLICY_PRODUCT_LANGUAGE_RISK_IDS.TEMPORARY_DELIVERY_LANGUAGE,
      ...finding,
    });
  });

  const complete = risks.length === 0;

  return {
    version: POLICY_PRODUCT_LANGUAGE_AUDIT_VERSION,
    generatedAt,
    statusId: complete
      ? POLICY_PRODUCT_LANGUAGE_AUDIT_STATUS_IDS.COMPLETE
      : POLICY_PRODUCT_LANGUAGE_AUDIT_STATUS_IDS.BLOCKED,
    complete,
    requiredSurfaceIds: REQUIRED_SURFACE_IDS,
    summary: buildSummary({ surfaces: normalizedSurfaces, findings }),
    findings,
    riskCount: risks.length,
    risks,
    sideEffects: {
      filesRead: false,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    },
    nextAction: complete
      ? 'continue_delivery_term_completion_gate'
      : 'replace_temporary_product_language',
  };
}

export {
  POLICY_PRODUCT_LANGUAGE_AUDIT_STATUS_IDS,
  POLICY_PRODUCT_LANGUAGE_AUDIT_VERSION,
  POLICY_PRODUCT_LANGUAGE_RISK_IDS,
  POLICY_PRODUCT_LANGUAGE_SURFACE_IDS,
  REQUIRED_SURFACE_IDS,
  buildPolicyProductLanguageAudit,
  findTemporaryDeliveryLanguage,
};
