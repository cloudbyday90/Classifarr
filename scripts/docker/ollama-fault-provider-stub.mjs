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

import { createServer } from 'node:http';

const PORT = 11434;
const MAX_REQUESTS = 20;
let tagRequests = 0;
let generationRequests = 0;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

/**
 * This fixture deliberately does not parse or log request bodies, headers, or
 * prompts. The metric endpoint exposes only bounded counters to the host-side
 * integration assertion, and the Compose file publishes it on loopback only.
 */
const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/api/tags') {
    tagRequests = Math.min(tagRequests + 1, MAX_REQUESTS);
    sendJson(response, 200, { models: [{ name: 'classifarr-fault-model' }] });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/generate') {
    generationRequests = Math.min(generationRequests + 1, MAX_REQUESTS);
    request.resume();
    sendJson(response, 503, { error: 'synthetic_provider_unavailable' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/_test/metrics') {
    sendJson(response, 200, {
      generationRequests,
      tagRequests,
    });
    return;
  }

  request.resume();
  sendJson(response, 404, { error: 'not_found' });
});

server.listen(PORT, '0.0.0.0');

function stop() {
  server.close(() => process.exit(0));
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
