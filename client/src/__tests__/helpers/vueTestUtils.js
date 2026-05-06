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

/**
 * Shared Vue testing utilities for Classifarr client tests.
 *
 * Usage:
 *   import { createMemoryRouter, ROUTER_LINK_STUB } from '../helpers/vueTestUtils'
 */

import { createRouter, createMemoryHistory } from 'vue-router';

/**
 * A minimal RouterLink stub suitable for most Vitest component tests.
 * Preserves the `to` prop on the rendered anchor so tests can assert
 * navigation targets without needing a full router context.
 */
export const ROUTER_LINK_STUB = {
  props: ['to'],
  template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
};

/**
 * A simple RouterLink stub that renders as an anchor without exposing `to`.
 * Use when the navigation target is not relevant to the test.
 */
export const ROUTER_LINK_SIMPLE_STUB = {
  template: '<a><slot /></a>',
};

/**
 * Create a ready-to-use memory router for Vitest component tests.
 *
 * Creates a `createMemoryHistory` router, navigates to `initialPath`,
 * and waits until the router is ready before returning. This avoids the
 * async navigation warning that appears when components render before the
 * router has settled on an initial route.
 *
 * @param {import('vue-router').RouteRecordRaw[]} routes - Route definitions.
 * @param {string} [initialPath='/'] - Path to navigate to before returning.
 * @returns {Promise<import('vue-router').Router>} The ready router instance.
 */
export async function createMemoryRouter(routes, initialPath = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  });
  await router.push(initialPath);
  await router.isReady();
  return router;
}
