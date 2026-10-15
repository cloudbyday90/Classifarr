/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { resolveOllamaApplicationClient } from './ollamaApplicationScope.mjs';
import { gatewayHistoryQuery } from '../ollamaGateway/historyContract.mjs';

export async function readOllamaWorkHistory(query = {},signal) {
  const filter = gatewayHistoryQuery(query);
  signal?.throwIfAborted();
  const client = resolveOllamaApplicationClient(null,{ workClass: 'foreground' });
  if (!client) return { state: 'not_configured' };
  return { state: 'available',...await client.getWorkHistory(filter,signal) };
}
