/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { setImmediate as turn } from 'node:timers/promises';
import process from 'node:process';
const require = createRequire(import.meta.url), { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1/' });
const { document } = dom.window;
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'Event', 'MouseEvent']) {
  globalThis[key] = key === 'window' ? dom.window : dom.window[key];
}
const vue = require('vue'), compiler = require('@vue/compiler-dom'), sfc = require('@vue/compiler-sfc');
const mode = process.argv[2];
try {
  if (mode === 'dispose') {
    let before = 0, after = 0;
    const scope = vue.effectScope();
    scope.run(() => { vue.onScopeDispose(() => before++); scope.stop(); vue.onScopeDispose(() => after++); });
    assert.equal(before, 1); assert.equal(after, 1); scope.stop(); assert.equal(before, 1); assert.equal(after, 1);
  } else if (mode === 'booleans') {
    let saves = 0;
    const source = '<form @submit.prevent="save">' + '<p>static</p>'.repeat(20) +
      '<button :disabled="0">Save</button><input type="checkbox" :checked="!1"></form>';
    const { code } = compiler.compile(source, { mode: 'function', hoistStatic: true, prefixIdentifiers: true });
    assert.ok(code.includes('createStaticVNode'));
    const render = new Function('Vue', code)(vue), container = document.createElement('div');
    document.body.append(container); const app = vue.createApp({ setup: () => ({ save: () => saves++ }), render });
    try {
      app.mount(container); const button = container.querySelector('button');
      assert.equal(button.disabled, false); assert.equal(container.querySelector('input').checked, false);
      button.click(); assert.equal(saves, 1);
    } finally { app.unmount(); container.remove(); }
  } else if (mode === 'catch' || mode === 'switch') {
    const statement = mode === 'catch' ? "try { throw {message:'caught'} } catch ({message}) { return message }"
      : "switch(0) {case 0: const message='case'; return message}";
    const source = '<script setup>const {message}=defineProps(["message"]);function inspect(){' + statement +
      '};function readProp(){return message}</script>';
    const { descriptor } = sfc.parse(source);
    const out = sfc.compileScript(descriptor, { id: 'patch-control', genDefaultAs: '_sfc_' });
    const component = new Function(out.content + ';return _sfc_')();
    const bindings = component.setup({ message: 'prop' }, { expose() {} });
    assert.equal(bindings.inspect(), mode === 'catch' ? 'caught' : 'case'); assert.equal(bindings.readProp(), 'prop');
  } else if (mode === 'async-unmount') {
    let settle, setups = 0, mounts = 0;
    const pending = new Promise(resolve => { settle = resolve; });
    const Async = vue.defineAsyncComponent(() => pending), container = document.createElement('div');
    document.body.append(container); const app = vue.createApp({ render: () => vue.h(Async) });
    app.mount(container); app.unmount();
    settle({ setup() { setups++; vue.onMounted(() => mounts++); return () => vue.h('p', 'late'); } });
    await turn(); await vue.nextTick(); await turn();
    assert.equal(setups, 0); assert.equal(mounts, 0); assert.equal(container.innerHTML, ''); container.remove();
  } else if (mode === 'directive') {
    const value = vue.ref('one'), updates = [], directive = { updated(_el, binding) { updates.push([binding.value, binding.oldValue]); } };
    const container = document.createElement('div'); document.body.append(container);
    const app = vue.createApp({ render: () => vue.withDirectives(vue.h('p', value.value), [[directive, value.value]]) });
    try {
      app.mount(container); value.value = 'two'; await vue.nextTick(); value.value = 'three'; await vue.nextTick();
      assert.deepEqual(updates, [['two', 'one'], ['three', 'two']]); assert.equal(container.textContent, 'three');
    } finally { app.unmount(); container.remove(); }
  } else if (mode === 'ssr') {
    const { renderToString } = require('vue/server-renderer');
    const result = await renderToString(vue.createSSRApp({ render: () => vue.h('div', {
      style: { color: 'red', fontSize: '12px' }, 'data-id': '42',
    }, '<safe>') }));
    assert.equal(result, '<div style="color:red;font-size:12px;" data-id="42">&lt;safe&gt;</div>');
  } else throw new Error('unknown_vue_probe');
  process.stdout.write(JSON.stringify({ mode, passed: true }) + '\n');
} finally { dom.window.close(); }
