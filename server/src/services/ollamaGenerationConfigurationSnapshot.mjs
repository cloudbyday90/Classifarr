/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const snapshots = new WeakMap();

/** Move the existing configuration read to the admitted generation boundary. */
export async function holdOllamaGenerationConfiguration(getConfig) {
  const config = await getConfig();
  const token = Object.freeze({});
  snapshots.set(token, Object.freeze({ host: config.host, port: config.port, baseUrl: config.baseUrl, model: config.model }));
  return token;
}

/** Public flags and copied handles cannot replace a generation endpoint. */
export const readOllamaGenerationConfiguration = token => snapshots.get(token) ?? null;
