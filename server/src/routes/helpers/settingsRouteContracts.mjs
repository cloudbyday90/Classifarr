/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/**
 * @typedef {{ id?: number | string | null, username?: string | null } & Record<string, unknown>} SettingsRouteUser
 */

/**
 * @typedef {Record<string, string | undefined>} SettingsRouteParams
 */

/**
 * Shared request contract for settings route handlers.
 *
 * @typedef {{
 *   body?: Record<string, unknown>,
 *   query?: Record<string, unknown>,
 *   params?: SettingsRouteParams,
 *   user?: SettingsRouteUser,
 *   ip?: string,
 * }} SettingsRequest
 */

/**
 * Shared request contract for handlers that care about `req.body`.
 *
 * @template Body
 * @typedef {SettingsRequest & {
 *   body?: Body,
 * }} SettingsBodyRequest
 */

/**
 * Shared request contract for handlers that care about `req.query`.
 *
 * @template Query
 * @typedef {SettingsRequest & {
 *   query?: Query,
 * }} SettingsQueryRequest
 */

/**
 * Shared response contract for handlers that call `res.status().json()`.
 *
 * @typedef {{
 *   status: (code: number) => SettingsResponse,
 *   json: (body: unknown) => unknown,
 * }} SettingsResponse
 */

export {};
