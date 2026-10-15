/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { gatewayUpstream } from './transport.mjs';
import { prepareGatewayWork } from './workIdentity.mjs';

/** Only this invocation can prove non-dispatch or observe validated completion. */
export async function executeGatewayCompute({ ledger, installation, config, path, body, signal, onRecord, source = null }) {
  signal.throwIfAborted();
  const work = prepareGatewayWork(config,installation,path,body,source);
  const requestId = await ledger.claim(installation,work.identity);
  if (signal.aborted) {
    // No transport has been invoked. Preserve the counted attempt, not a false unknown.
    await ledger.complete(requestId,false,{ state: 'not_dispatched',httpStatus: null });
    signal.throwIfAborted();
  }
  // No await between the cancellation check and dispatch. Any transport failure
  // is uncertain, including one that might have occurred before bytes were sent.
  const result = await gatewayUpstream(config,path,work.body,signal,onRecord,{
    onPeer: peer => ledger.recordPeer(requestId,peer),requestIdentity: { requestId,installation },
  });
  // A validated terminal response is evidence even if the caller has since left.
  // Never return it before the fenced write, or retry a failed completion write.
  await ledger.complete(requestId,[429,503].includes(result.status),{
    state: result.rejected ? 'provider_rejected' : 'response_completed',httpStatus: result.status,
  });
  signal.throwIfAborted();
  return result;
}
