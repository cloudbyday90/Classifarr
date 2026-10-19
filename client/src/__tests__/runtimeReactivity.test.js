/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe,it,expect,afterEach } from 'vitest'
import { createPinia,defineStore,disposePinia,setActivePinia } from 'pinia'
import { shallowReactive,shallowRef,watch,nextTick,isReactive,defineComponent,ref } from 'vue'
import { mount } from '@vue/test-utils'

describe('pinned Vue and Pinia runtime contracts',()=>{
  let pinia,wrapper
  afterEach(()=>{wrapper?.unmount(); wrapper=undefined; if(pinia) disposePinia(pinia); pinia=undefined; setActivePinia(undefined)})

  it('preserves object identity when iterating a shallow reactive collection',()=>{
    const item={id:'synthetic'}, collection=shallowReactive(new Set([item]))
    expect([...collection][0]).toBe(item)
    expect(isReactive([...collection][0])).toBe(false)
  })

  it('notifies shallow-ref watchers when a store is patched with an object',async()=>{
    pinia=createPinia(); setActivePinia(pinia)
    const useStore=defineStore('runtime-contract',()=>({details:shallowRef({count:0})}))
    const store=useStore(), seen=[]
    const stop=watch(()=>store.details,value=>seen.push(value.count),{deep:true})
    try {store.$patch({details:{count:1}}); await nextTick(); expect(store.details.count).toBe(1); expect(seen).toEqual([1])}
    finally {stop()}
  })

  it('keeps v-show visibility correct when a style string is unchanged',async()=>{
    const visible=ref(true)
    wrapper=mount(defineComponent({setup:()=>({visible}),template:'<div v-show="visible" style="display: flex">System</div>'}))
    expect(wrapper.element.style.display).toBe('flex')
    visible.value=false; await nextTick(); expect(wrapper.element.style.display).toBe('none')
    visible.value=true; await nextTick(); expect(wrapper.element.style.display).toBe('flex')
  })
})
