/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Node 24 provides Error.isError; our ES2024 compile library does not declare it.
// This type bridge changes neither the runtime API nor the project's global lib.
export const isNativeError = /** @type {ErrorConstructor & { isError(value: unknown): value is Error }} */ (Error).isError;
