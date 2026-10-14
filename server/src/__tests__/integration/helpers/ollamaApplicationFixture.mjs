/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { gatewayConfig } from '../../../ollamaGateway/contract.mjs';
import { openGatewayLedger } from '../../../ollamaGateway/ledger.mjs';
import { createGatewayServer } from '../../../ollamaGateway/server.mjs';
import { createOllamaApplicationRouting } from '../../../services/ollamaApplicationRouting.mjs';

export async function createOllamaApplicationFixture(pool, tls = null) {
  // Caller is the repository's per-suite disposable PostgreSQL database.
  await pool.query('DROP SCHEMA IF EXISTS ollama_gateway CASCADE');
  await pool.query(await readFile(new URL('../../../../../database/ollama-gateway/20261014_121441_admission.sql', import.meta.url), 'utf8'));
  const model = 'synthetic:latest', vectorModel = 'vectors:latest', digest = 'a'.repeat(64), calls = [], classes = [];
  let hold = false, failure = false, disconnected = false;
  const provider = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    calls.push({ path: req.url, body, authorization: req.headers.authorization });
    res.setHeader('Content-Type', 'application/json');
    if (['/api/tags', '/api/ps'].includes(req.url)) return res.end(JSON.stringify({ models: [model, vectorModel].map(name => ({ name, digest })) }));
    if (req.url === '/api/version') return res.end(JSON.stringify({ version: 'synthetic' }));
    if (req.url === '/api/show') return res.end(JSON.stringify({ capabilities: ['completion', 'embedding'],
      model_info: { 'general.architecture': 'test', 'test.context_length': 8192, 'test.embedding_length': 2 } }));
    if (failure) { res.writeHead(503); res.end('{}'); return; }
    if (hold) { res.on('close', () => { disconnected = true; }); return; }
    if (req.url === '/api/embed') return res.end(JSON.stringify({ model: body.model, embeddings: (Array.isArray(body.input) ? body.input : [body.input]).map(() => [0, 1]) }));
    const data = { model: body.model, done: true, response: body.prompt ? 'answer' : '', done_reason: body.prompt ? 'stop' : 'load', prompt_eval_count: 1, eval_count: 1 };
    if (body.stream) res.setHeader('Content-Type', 'application/x-ndjson');
    res.end(`${JSON.stringify(data)}${body.stream ? '\n' : ''}`);
  });
  let client, gateway, owner;
  const close = async () => {
    owner?.close(); await gateway?.stop(); client?.release(true);
    provider.closeAllConnections(); await new Promise(resolve => { provider.close(resolve); });
  };
  try {
    await new Promise(resolve => { provider.listen(0, '127.0.0.1', resolve); });
    const upstream = `http://127.0.0.1:${provider.address().port}`;
    const credentials = ['foreground', 'background'].map(workClass => ({ installation: 'local', workClass, token: randomBytes(32).toString('base64url') }));
    const config = gatewayConfig({ upstream, models: [model, vectorModel], credentials, timeoutMs: 1000, queueMs: 300,
      ...(tls ? { tls: { cert: tls.cert, key: tls.key } } : {}) });
    client = await pool.connect(); client.on('error', () => {});
    const ledger = await openGatewayLedger(client, config.providerHash);
    gateway = createGatewayServer({ config, ledger });
    // Observe only class labels, never copy tokens into test output or persisted state.
    gateway.server.on('request', req => { classes.push(credentials.find(entry => `Bearer ${entry.token}` === req.headers.authorization)?.workClass); });
    await new Promise(resolve => { gateway.server.listen(0, '127.0.0.1', resolve); });
    const common = { url: `${tls ? 'https' : 'http'}://127.0.0.1:${gateway.server.address().port}`, upstream, models: [model, vectorModel],
      ...(tls ? { ca: tls.cert } : {}) };
    const configuration = { baseUrl: upstream, host: '127.0.0.1', port: provider.address().port, model, embeddingModel: vectorModel };
    const options = revision => ({ revision, configuration, foreground: { ...common, token: credentials[0].token }, background: { ...common, token: credentials[1].token } });
    owner = createOllamaApplicationRouting(options(1));
    return { owner, options, ledger, calls, classes, configuration, model, vectorModel, digest, close,
      setHold() { hold = true; }, setFailure() { failure = true; }, disconnected: () => disconnected,
      settings: { primary_provider: 'ollama', rag_enabled: true, ollama_host: '127.0.0.1', ollama_port: provider.address().port, ollama_model: model, embedding_model: vectorModel } };
  } catch (error) { await close(); throw error; }
}
