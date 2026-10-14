/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createOllamaGatewayProviderContext } from './ollamaGatewayProviderContext.mjs';

/** Compatible, generation-only view of the shared provider lifetime. */
export function createOllamaGatewayGenerationClient(options) {
  const context = createOllamaGatewayProviderContext(options);
  const { preflightConnection, getVersion, generate, generateWithProgress, close } = context;
  return Object.freeze({ preflightConnection, getVersion, generate, generateWithProgress, close });
}
