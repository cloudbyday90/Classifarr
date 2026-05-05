/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import cookieSecurity from './cookieSecurity.shared.mjs';

const { isHttpsRequest, resolveSecureCookieFlag, _resetWarnStateForTests } = cookieSecurity;

export { isHttpsRequest, resolveSecureCookieFlag, _resetWarnStateForTests };
export default cookieSecurity;
