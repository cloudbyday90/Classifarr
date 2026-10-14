/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getOllamaApplicationBinding } from '/app/src/services/ollamaApplicationScope.mjs';
// Observe native ESM evaluation, not only the async callback requesting import.
export const importedOwner = getOllamaApplicationBinding();
export const importedTimer = new Promise(resolve => { setTimeout(() => resolve(getOllamaApplicationBinding()), 5); });
