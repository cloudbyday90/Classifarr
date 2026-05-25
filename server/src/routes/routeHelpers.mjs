/** @internal */
export function sendNotFound(res, message = 'Resource not found') {
  return res.status(404).json({ error: message });
}

export function requireRow(result, res, message = 'Resource not found') {
  if (result.rows.length === 0) {
    return sendNotFound(res, message);
  }
  return null;
}
