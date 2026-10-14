/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readGatewayPrivateDocument } from '../ollamaGateway/privateDocument.mjs';
import { createOllamaApplicationRouting } from '../services/ollamaApplicationRouting.mjs';

const invalid = () => new Error('gateway_application_config_invalid');
const record = value => value && typeof value === 'object' && !Array.isArray(value);

/** No inference or saved-setting writes. Missing setting retains direct mode. */
export async function loadOllamaRoutingStartup(environment) {
  if (environment.CLASSIFARR_OLLAMA_ROUTING_FILE === undefined) return null;
  try {
    const document = await readGatewayPrivateDocument(environment.CLASSIFARR_OLLAMA_ROUTING_FILE);
    if (!record(document) || Object.keys(document).some(key => !['revision', 'configuration', 'foreground', 'background'].includes(key)) ||
        !record(document.configuration) || Object.keys(document.configuration).some(key =>
          !['baseUrl', 'host', 'port', 'model', 'embeddingModel'].includes(key))) throw invalid();
    for (const key of ['foreground', 'background']) {
      if (!record(document[key]) || new URL(document[key].url).protocol !== 'https:') throw invalid();
    }
    if (document.foreground.ca !== document.background.ca) throw invalid();
    return createOllamaApplicationRouting(document);
  } catch { throw invalid(); }
}

export function bindOllamaRoutingLifetime(owner, processRef) {
  if (!owner) return () => {};
  const events = ['SIGTERM', 'SIGINT', 'exit', 'uncaughtExceptionMonitor'];
  for (const event of events) processRef.once(event, owner.close);
  return () => {
    owner.close();
    for (const event of events) processRef.removeListener(event, owner.close);
  };
}
