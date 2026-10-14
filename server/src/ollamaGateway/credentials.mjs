/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { authenticateGateway, gatewayError } from './contract.mjs';

/** Request-scoped authority; tokens never become queue-supplied privileges. */
export function createGatewayCredentials(initial) {
  let config = initial, stopped = false;
  const scopes = new Set();
  return {
    acquire(authorization) {
      if (stopped) throw gatewayError('gateway_cancelled');
      const credential = authenticateGateway(config,authorization);
      if (!credential) throw gatewayError('gateway_unauthorized',401);
      if (scopes.size >= 32) throw gatewayError('gateway_busy',429);
      const controller = new AbortController(), scope = { credential,controller };
      scopes.add(scope);
      return { principal: { installation: credential.installation,workClass: credential.workClass },
        signal: controller.signal, release: () => scopes.delete(scope) };
    },
    replace(next) {
      if (stopped) throw gatewayError('gateway_cancelled');
      if (!isDeepStrictEqual({ ...initial,credentials: undefined },{ ...next,credentials: undefined })) {
        throw gatewayError('gateway_reload_incompatible');
      }
      config = next;
      for (const scope of scopes) {
        const survives = next.credentials.some(entry => entry.installation === scope.credential.installation &&
          entry.workClass === scope.credential.workClass && timingSafeEqual(entry.digest,scope.credential.digest));
        if (!survives) {
          scopes.delete(scope); scope.controller.abort(gatewayError('gateway_credentials_revoked',401));
        }
      }
    },
    stop() {
      stopped = true;
      for (const scope of scopes) scope.controller.abort(gatewayError('gateway_cancelled'));
      scopes.clear();
    },
  };
}
