/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export function isDatabaseStatementTimeoutError(error) {
  return error?.code === '57014' &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('statement timeout');
}
