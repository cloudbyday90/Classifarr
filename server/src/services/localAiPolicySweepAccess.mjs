/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function route(method, path, match = 'exact') {
  return Object.freeze({ method, path, match });
}

// The local sweep uses these routes only. A method-and-route list prevents a
// short-lived diagnostic token from inheriting the full admin queue surface.
export const LOCAL_AI_POLICY_SWEEP_ALLOWED_API_ROUTES = Object.freeze([
  route('GET', '/api/libraries'),
  route('GET', '/api/policies/evaluation-context'),
  route('GET', '/api/settings'),
  route('PUT', '/api/settings'),
  route('GET', '/api/settings/ai'),
  route('PUT', '/api/settings/ai'),
  route('POST', '/api/classification/classify'),
  route('GET', '/api/classification/history'),
  route('POST', '/api/requests/submit'),
  route('GET', '/api/media-sync/lookup', 'prefix'),
  route('GET', '/api/queue/pending'),
  route('GET', '/api/queue/failed'),
  route('GET', '/api/queue/tasks/:id/decision-witness', 'template'),
  route('GET', '/api/settings/webhook/logs'),
]);
