/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayError, gatewayProviderIdentity } from '../ollamaGateway/contract.mjs';
import { createOllamaGatewayProviderContext } from './ollamaGatewayProviderContext.mjs';
import { runOllamaApplicationScope } from './ollamaApplicationScope.mjs';

/** Explicit composition only: does not read settings, start work or enable routing. */
export function createOllamaApplicationRouting(initial) {
  let state = null;
  let closed = false;
  const close = () => {
    closed = true;
    state?.foreground.close();
    state?.background.close();
  };
  const replace = next => {
    let foreground;
    let background;
    try {
      if (closed) throw gatewayError('gateway_client_closed');
      if (!Number.isSafeInteger(next?.revision) || next.revision < 1 || next.revision <= (state?.revision ?? 0) ||
          next.foreground?.token === next.background?.token || next.foreground?.url !== next.background?.url) {
        throw gatewayError('gateway_application_config_invalid');
      }
      const configuration = Object.freeze({ ...next.configuration });
      const upstream = gatewayProviderIdentity(configuration.baseUrl).upstream;
      foreground = createOllamaGatewayProviderContext({ configuration, gateway: next.foreground });
      background = createOllamaGatewayProviderContext({ configuration, gateway: next.background });
      state?.foreground.close();
      state?.background.close();
      state = Object.freeze({ foreground, background, upstream, revision: next.revision });
    } catch (error) {
      foreground?.close(); background?.close(); close(); throw error;
    }
  };
  const owner = Object.freeze({
    run(callback) {
      if (closed) throw gatewayError('gateway_client_closed');
      return runOllamaApplicationScope(owner, callback);
    },
    resolve(configuration, { workClass = 'background', host = null, port = null } = {}) {
      if (closed) throw gatewayError('gateway_client_closed');
      if (!['foreground', 'background'].includes(workClass)) throw gatewayError('gateway_work_class_invalid');
      const client = state[workClass];
      if (configuration) {
        if (gatewayProviderIdentity(configuration.baseUrl).upstream !== state.upstream) {
          throw gatewayError('gateway_provider_mismatch', 409);
        }
        client.assertEndpoint(configuration.host, configuration.port);
      }
      client.assertEndpoint(host, port);
      return client;
    },
    replace,
    close,
  });
  replace(initial);
  return owner;
}
