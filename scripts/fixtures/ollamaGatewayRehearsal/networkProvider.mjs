/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createServer } from 'node:http';
if (process.env.CLASSIFARR_GATEWAY_FIXTURE !== 'isolated') throw new Error('fixture_required');
let attempts = 0;
createServer(async (req, res) => {
  if (req.headers.authorization) { res.writeHead(400); res.end('{}'); return; }
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
  res.setHeader('Content-Type', 'application/json');
  if (['/api/tags', '/api/ps'].includes(req.url)) res.end(JSON.stringify({ models: [{ name: 'synthetic:latest', digest: 'a'.repeat(64) }] }));
  else if (req.url === '/api/show') res.end(JSON.stringify({ capabilities: ['completion'],
    model_info: { 'general.architecture': 'test', 'test.context_length': 8192 } }));
  else if (req.url === '/api/version') res.end(JSON.stringify({ version: 'synthetic' }));
  else if (req.url === '/stats') res.end(JSON.stringify({ attempts }));
  else if (req.url === '/api/generate') {
    attempts++; res.end(JSON.stringify({ model: body.model, done: true,
      response: body.prompt === '' ? '' : 'synthetic', done_reason: body.prompt === '' ? 'load' : 'stop' }));
  } else { res.writeHead(404); res.end('{}'); }
}).listen(11434, '0.0.0.0');
