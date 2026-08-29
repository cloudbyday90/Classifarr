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
 *   keepAlive?: string | number | null,
 *   think?: boolean | 'low' | 'medium' | 'high' | 'max',
 * }} request
 * @returns {{
 *   model: string,
 *   prompt: string,
 *   stream: boolean,
 *   options: { temperature: number },
 *   format?: unknown,
 *   keep_alive?: string | number,
 *   think?: boolean | 'low' | 'medium' | 'high' | 'max',
 * }}
 */
export function buildOllamaGenerateRequest({
  model,
  prompt,
  stream,
  temperature,
  format = null,
  keepAlive = null,
  think = undefined,
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
    body.format = format;
  }

  if (typeof keepAlive === 'string' || Number.isFinite(keepAlive)) {
    body.keep_alive = keepAlive;
  }

  // Ollama's `think` control is a top-level Generate API field, not a
  // decoding option. Keep it narrowly allowlisted so Classifarr-only or
  // arbitrary provider controls cannot cross the provider boundary.
  if (typeof think === 'boolean' || ['low', 'medium', 'high', 'max'].includes(think)) {
    body.think = think;
  }

  return body;
}
