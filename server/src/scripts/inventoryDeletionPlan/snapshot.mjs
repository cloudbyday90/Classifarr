/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { readWriterSchemaEvidence } from '../inventoryWriterCompatibility/schemaEvidence.mjs';
import { buildInventoryDeletionPlan } from './graph.mjs';
const qualify = name => name.includes('.') ? name : `public.${name}`;

export function assessDeletionSnapshot(source) {
    if (typeof source !== 'string' || Buffer.byteLength(source) > 16 * 1024 * 1024) throw new Error('Deletion snapshot exceeds bound');
    const parsed = readWriterSchemaEvidence(source);
    const edges = parsed.edges.map((edge, index) => ({ id: `snapshot-fk-${index}`, parent: qualify(edge.parent), child: qualify(edge.child),
        onDelete: edge.onDelete === 'NO_ACTION' ? 'NO_ACTION_OR_RESTRICT' : edge.onDelete,
        childColumns: null, parentColumns: null, validated: null, enforced: null, childIndex: null }));
    return buildInventoryDeletionPlan({ source: { kind: 'repository_snapshot', sha256: createHash('sha256').update(source).digest('hex') }, edges,
        tables: [...new Set(edges.flatMap(edge => [edge.parent, edge.child]))].sort().map(name => ({ name, kind: 'unknown', rls: null })),
        gaps: [{ reason: 'snapshot_parser_does_not_establish_columns_indexes_validation_or_trigger_closure' }] });
}
