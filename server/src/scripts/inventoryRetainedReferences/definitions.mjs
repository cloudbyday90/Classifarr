/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
// Fixed lab identifiers only. Catalog evidence never becomes executable SQL.
export const RETAINED_REFERENCES = Object.freeze([
    Object.freeze({ table: 'cleanup_requests', column: 'routed_to_library_id', counter: 'requests_detached' }),
    Object.freeze({ table: 'cleanup_feedback', column: 'selected_library_id', counter: 'feedback_detached' }),
]);
