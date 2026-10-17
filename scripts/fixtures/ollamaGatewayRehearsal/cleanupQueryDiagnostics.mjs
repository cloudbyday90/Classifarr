/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import pg from '/app/node_modules/pg/lib/index.js';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE,'isolated');
const query = pg.Client.prototype.query;
pg.Client.prototype.query = function (...args) {
  const result = query.apply(this,args);
  if (!result?.catch) return result;
  return result.catch(error => {
    const code = ['57014','55P03','42501'].includes(error.code) ? error.code : 'unclassified';
    // Emit only fixed-function/line references, never SQL text, parameters or arbitrary error content.
    const frames = [...(error.where ?? '').matchAll(/PL\/pgSQL function gateway_cleanup\.([a-z_]+)\([^\n]*\) line ([0-9]+) at/g)]
      .filter(match => ['execute_batch','admit','reconcile','check_pair','require_worker'].includes(match[1]))
      .map(match => ({ function: match[1],line: Number(match[2]) }));
    const statements = [...(error.where ?? '').matchAll(/SQL statement "(DELETE FROM|UPDATE|SELECT) (ollama_gateway\.(?:request_binding|completion_receipt|upstream_peer_observation)|jsonb_agg)/g)]
      .map(match => ({ operation: match[1],target: match[2] }));
    process.stdout.write(`${JSON.stringify({ fixture: 'query_error',code,frames,statements })}\n`);
    throw error;
  });
};
