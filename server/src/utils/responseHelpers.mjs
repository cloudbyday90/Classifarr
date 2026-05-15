/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function sendData(res, data, status = 200) {
  return res.status(status).json(data);
}

export function sendSuccess(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export function sendPaginated(res, items, { page, limit, total }) {
  const totalPages = Math.ceil(total / limit) || 1;
  return res.json({
    data: items,
    pagination: { page, limit, total, totalPages },
  });
}

export function sendError(res, message, status = 400, extra = {}) {
  return res.status(status).json({ error: message, ...extra });
}
