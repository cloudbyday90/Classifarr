/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * Creates an Ollama `/api/generate` request without leaking Classifarr-only
 * stream controls into the provider payload. Ollama documents decoding values
 * such as temperature under `options`, while `format` carries the JSON Schema.
 *
 * @param {{
 *   model: string,
 *   prompt: string,
 *   stream: boolean,
 *   temperature: number,
 *   format?: unknown,
 * }} request
 * @returns {{
 *   model: string,
 *   prompt: string,
 *   stream: boolean,
 *   options: { temperature: number },
 *   format?: unknown,
 * }}
 */
export function buildOllamaGenerateRequest({
  model,
  prompt,
  stream,
  temperature,
  format = null,
}) {
  const body = {
    model,
    prompt,
    stream,
    options: {
      temperature: format ? 0 : temperature,
    },
  };

  if (format) {
    return { ...body, format };
  }

  return body;
}
