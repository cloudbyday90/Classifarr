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

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 160) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function buildClassificationDestinationSummary(result = {}) {
  const classification = asObject(result);
  const destination = asObject(classification.destination);
  const library = asObject(classification.library);

  return {
    libraryId: normalizePositiveInteger(
      destination.libraryId ?? destination.id ?? library.id ?? library.library_id ?? classification.library_id
    ),
    libraryName: normalizeString(
      destination.libraryName ?? destination.name ?? library.name ?? library.library_name ?? classification.library
    ) || null,
  };
}

function buildClassificationRoutingSummary(result = {}) {
  const classification = asObject(result);
  const routingOutcome = asObject(classification.routingOutcome);
  const routeResult = asObject(routingOutcome.routeResult || classification.routeResult);
  const hasRoutingOutcome = Object.keys(routingOutcome).length > 0 || Object.keys(routeResult).length > 0;

  if (!hasRoutingOutcome) return null;

  return {
    shouldRoute: routingOutcome.shouldRoute === true,
    reason: normalizeString(routingOutcome.reason, 80) || null,
    routeResult: {
      attempted: routeResult.attempted === true,
      routed: routeResult.routed === true,
      reason: normalizeString(routeResult.reason, 80) || null,
    },
  };
}

export {
  buildClassificationDestinationSummary,
  buildClassificationRoutingSummary,
};
