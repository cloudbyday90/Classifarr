/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export const gatewayError = (code, status = 503) => Object.assign(new Error(code), { code, status });
