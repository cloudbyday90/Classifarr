/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createGatewayClient } from '../ollamaGateway/client.mjs';
import { getOllamaTaskSource } from './ollamaTaskScope.mjs';

/** Reusable provider clients read task context at dispatch, never at construction. */
export function createTaskCorrelatedGatewayClient(configuration,options) {
  const client = createGatewayClient(configuration,options);
  return Object.freeze({
    request(path,body,requestOptions = {}) {
      const source = ['/api/generate','/api/embed'].includes(path) ? getOllamaTaskSource() : null;
      const scopedOptions = { ...requestOptions,source };
      if (!source) delete scopedOptions.source;
      return client.request(path,body,scopedOptions);
    },
    close() { client.close(); },
  });
}
