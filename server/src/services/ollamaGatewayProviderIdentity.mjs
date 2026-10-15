/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError, gatewayProviderIdentity } from '../ollamaGateway/contract.mjs';

export const gatewayDeadline = (value, fallback) => Number.isSafeInteger(value) && value > 0 ? Math.min(value, 300000) : fallback;

export function canonicalGatewayModel(value) {
  if (typeof value !== 'string' || !value.trim()) throw gatewayError('gateway_model_invalid', 400);
  const name = value.trim();
  return name.slice(name.lastIndexOf('/') + 1).includes(':') ? name : `${name}:latest`;
}

/** An override may confirm the bound endpoint, never select a different one. */
export function assertGatewayEndpoint(baseUrl, host, port) {
  if (host == null && port == null) return;
  if (typeof host !== 'string' || !/^\d{1,5}$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw gatewayError('gateway_provider_mismatch', 409);
  }
  let target;
  try { target = gatewayProviderIdentity(`${new URL(baseUrl).protocol}//${host}:${port}`).upstream; }
  catch { throw gatewayError('gateway_provider_mismatch', 409); }
  if (target !== gatewayProviderIdentity(baseUrl).upstream) throw gatewayError('gateway_provider_mismatch', 409);
}
