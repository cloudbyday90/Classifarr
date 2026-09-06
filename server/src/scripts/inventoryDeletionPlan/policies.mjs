/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const rules = Object.freeze([
    ['media_server_items', 'enrichment_retry_queue', 'media_item_id', 'CASCADE', 'delete_item_dependent'],
    ['media_server_items', 'media_identity_review_previews', 'item_id', 'CASCADE', 'delete_item_dependent'],
    ['libraries', 'media_server_collections', 'library_id', 'CASCADE', 'delete_parent_dependent'],
    ['media_server', 'media_server_collections', 'media_server_id', 'CASCADE', 'delete_parent_dependent'],
    ['libraries', 'media_server_sync_status', 'library_id', 'NO_ACTION', 'delete_parent_dependent'],
    ['media_server', 'media_server_sync_status', 'media_server_id', 'CASCADE', 'delete_parent_dependent'],
    ['libraries', 'classification_history', 'library_id', 'SET_NULL', 'preserve_history_detach'],
    ['libraries', 'media_server_items', 'library_id', 'CASCADE', 'drain_inventory'],
    ['media_server', 'media_server_items', 'media_server_id', 'CASCADE', 'drain_inventory'],
    ['media_server', 'libraries', 'media_server_id', 'CASCADE', 'drain_library'],
]);

export function proposedDisposition(edge) {
    return rules.find(([parent, child, column, action]) => edge.parent === `public.${parent}` && edge.child === `public.${child}` &&
        edge.childColumns?.length === 1 && edge.childColumns[0] === column && edge.parentColumns?.length === 1 &&
        edge.parentColumns[0] === 'id' && edge.onDelete === action)?.[4] ?? 'unresolved';
}
