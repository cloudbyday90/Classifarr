/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { gatewayError } from '../ollamaGateway/contract.mjs';

const scope = new AsyncLocalStorage();

export const getOllamaApplicationBinding = () => scope.getStore() ?? null;

export function runOllamaApplicationScope(owner, callback) {
  const current = getOllamaApplicationBinding();
  if (current && current !== owner) throw gatewayError('gateway_scope_conflict', 409);
  return scope.run(owner, callback);
}

/** Null means genuinely unscoped. A closed scope always throws instead. */
export function resolveOllamaApplicationClient(configuration, options = {}) {
  return getOllamaApplicationBinding()?.resolve(configuration, options) ?? null;
}

/** Factories may escape their creation scope, but never their captured owner. */
export function createOllamaApplicationLease(configuration, privateGateway = null) {
  let owner = getOllamaApplicationBinding();
  let client = null;
  let closed = false;
  const resolve = () => {
    if (closed) throw gatewayError('gateway_client_closed');
    const current = getOllamaApplicationBinding();
    if (owner && current && owner !== current) throw gatewayError('gateway_scope_conflict', 409);
    owner ??= current;
    if (!owner) return null;
    if (privateGateway !== null) throw gatewayError('gateway_scope_conflict', 409);
    client ??= owner.resolve(configuration);
    // Captured clients remain tied to their original revision after replacement.
    client.assertEndpoint();
    return client;
  };
  resolve();
  return Object.freeze({ resolve, close() { closed = true; } });
}

export function gatewayKeepAlive(value) {
  if (!['5m', '15m', '24h'].includes(value)) throw gatewayError('gateway_body_invalid', 400);
  return '5m';
}
