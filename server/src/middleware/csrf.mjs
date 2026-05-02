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

import csrfMiddleware from './csrf.shared.js';

export const CSRF_COOKIE_NAME = csrfMiddleware.CSRF_COOKIE_NAME;
export const CSRF_HEADER_NAME = csrfMiddleware.CSRF_HEADER_NAME;
export const issueCsrfToken = csrfMiddleware.issueCsrfToken;
export const clearCsrfToken = csrfMiddleware.clearCsrfToken;
export const ensureCsrfCookie = csrfMiddleware.ensureCsrfCookie;
export const csrfProtection = csrfMiddleware.csrfProtection;

export default csrfMiddleware;
