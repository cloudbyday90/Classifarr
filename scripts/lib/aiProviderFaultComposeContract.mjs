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

export const AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS = Object.freeze({
  COMPOSE_CONFIGURATION_FAILED: 'compose_configuration_failed',
  COMPOSE_START_FAILED: 'compose_start_failed',
  INVALID_INPUT: 'invalid_input',
  LOOPBACK_PORT_FAILED: 'loopback_port_failed',
  TEARDOWN_FAILED: 'teardown_failed',
  TEST_FAILED: 'test_failed',
});

export const AI_PROVIDER_FAULT_COMPOSE_STATUS_ID_VALUES = Object.freeze(
  Object.values(AI_PROVIDER_FAULT_COMPOSE_STATUS_IDS),
);

export function isAiProviderFaultComposeFailureStatusId(statusId) {
  return AI_PROVIDER_FAULT_COMPOSE_STATUS_ID_VALUES.includes(statusId);
}
