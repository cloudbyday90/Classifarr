/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
export class SourceEnumerationError extends Error {
  constructor(reason) {
    super(`Source enumeration incomplete (${reason}); existing records retained; scheduled sync will retry.`);
    this.name = 'SourceEnumerationError';
    this.reason = reason;
  }
}
