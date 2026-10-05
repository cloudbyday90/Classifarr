/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import morgan from 'morgan';
import { requestLogUrl } from './requestLogPrivacy.mjs';

const combined = morgan.compile(morgan.combined);

// Use local token projections, not global Morgan overrides or request mutation.
// Calling the original tokens preserves Morgan's control/quote escaping.
export function accessLogFormat(tokens, req, res) {
  return combined(Object.assign(Object.create(tokens), {
    url: () => tokens.url({ originalUrl: requestLogUrl(req.originalUrl || req.url) }, res),
    referrer: () => tokens.referrer({
      headers: { referer: requestLogUrl(req.headers.referer || req.headers.referrer) },
    }, res),
  }), req, res);
}
