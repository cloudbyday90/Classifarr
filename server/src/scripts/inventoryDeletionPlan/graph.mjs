/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { proposedDisposition } from './policies.mjs';

export const DELETION_ROOTS = Object.freeze(['public.libraries', 'public.media_server', 'public.media_server_items']);
export const DELETION_PLAN_LIMITS = Object.freeze({ edges: 10000, nodes: 4096, depth: 128, cycles: 128 });
const ordered = values => [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ?
    Object.fromEntries(ordered(Object.keys(value)).map(key => [key, stable(value[key])])) : value;

/** Structural FK closure only. No returned identifier is ever executed as SQL. */
export function buildInventoryDeletionPlan(evidence, roots = DELETION_ROOTS) {
    if (!Array.isArray(roots) || !roots.length || roots.length > 16 || roots.some(root => typeof root !== 'string' || root.length > 260)) throw new Error('Invalid deletion roots');
    if (!Array.isArray(evidence.edges) || evidence.edges.length > DELETION_PLAN_LIMITS.edges) throw new Error('Deletion edge budget exceeded');
    const all = [...evidence.edges].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (all.some(edge => !edge.id || !edge.parent || !edge.child) || new Set(all.map(edge => edge.id)).size !== all.length) throw new Error('Invalid deletion edge identity');
    const byParent = new Map();
    for (const edge of all) { if (!byParent.has(edge.parent)) byParent.set(edge.parent, []); byParent.get(edge.parent).push(edge); }
    const reachable = new Set(roots), selected = new Map(), queue = ordered(reachable), gaps = [...(evidence.gaps ?? [])];
    for (let at = 0; at < queue.length; at++) {
        for (const edge of byParent.get(queue[at]) ?? []) {
            selected.set(edge.id, edge);
            if (!reachable.has(edge.child)) {
                if (reachable.size === DELETION_PLAN_LIMITS.nodes) throw new Error('Deletion node budget exceeded');
                reachable.add(edge.child); queue.push(edge.child);
            }
        }
    }
    const colors = new Map(), cycles = [], dependencyOrder = [];
    function visit(node, path) {
        if (colors.get(node) === 2) return;
        if (colors.get(node) === 1) {
            if (cycles.length < DELETION_PLAN_LIMITS.cycles) cycles.push([...path.slice(path.indexOf(node)), node]);
            else gaps.push({ reason: 'cycle_report_limit' });
            return;
        }
        if (path.length >= DELETION_PLAN_LIMITS.depth) { colors.set(node, 2); gaps.push({ table: node, reason: 'depth_limit' }); return; }
        colors.set(node, 1);
        for (const edge of byParent.get(node) ?? []) visit(edge.child, [...path, node]);
        colors.set(node, 2); dependencyOrder.push(node);
    }
    for (const root of ordered(new Set(roots))) visit(root, []);
    const edges = [...selected.values()].map(edge => ({ ...edge, disposition: proposedDisposition(edge) }));
    const tables = (evidence.tables ?? []).filter(table => reachable.has(table.name)).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const root of roots) if (!tables.some(table => table.name === root)) gaps.push({ table: root, reason: 'root_not_observed' });
    const triggers = (evidence.triggers ?? []).filter(trigger => reachable.has(trigger.table))
        .sort((a, b) => `${a.table}.${a.name}` < `${b.table}.${b.name}` ? -1 : `${a.table}.${a.name}` > `${b.table}.${b.name}` ? 1 : 0);
    const rules = (evidence.rules ?? []).filter(rule => reachable.has(rule.table))
        .sort((a, b) => `${a.table}.${a.name}` < `${b.table}.${b.name}` ? -1 : `${a.table}.${a.name}` > `${b.table}.${b.name}` ? 1 : 0);
    const blockers = edges.flatMap(edge => [
        ...(edge.disposition === 'unresolved' ? [{ edge: edge.id, reason: 'unresolved_disposition' }] : []),
        ...(edge.validated !== true || edge.enforced !== true ? [{ edge: edge.id, reason: 'constraint_not_proven' }] : []),
        ...(edge.childIndex !== true ? [{ edge: edge.id, reason: 'referencing_index_not_proven' }] : [])]);
    for (const table of tables) if (table.rls || table.kind !== 'r') blockers.push({ table: table.name, reason: 'table_execution_contract_unproven' });
    if (triggers.length) blockers.push({ reason: 'trigger_semantics_require_validation' });
    if (rules.length) blockers.push({ reason: 'rewrite_semantics_require_validation' });
    if (cycles.length) blockers.push({ reason: 'dependency_cycles' });
    const content = { source: evidence.source, roots: ordered(new Set(roots)), tables, edges, triggers, rules, cycles,
        dependencyOrder: cycles.length || gaps.length ? null : dependencyOrder, gaps, blockers };
    const canonical = stable(content);
    return { contract: 'inventory.deletion-plan.v1', ...content,
        fingerprint: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
        measuredAt: evidence.measuredAt ?? null, scope: 'declared_foreign_keys', executable: false, productionReady: false };
}
