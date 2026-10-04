/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, describe, expect, it } from 'vitest'
import { focusAvailableTarget, getModalTabStops, isAvailableFocusTarget } from '@/utils/modalFocusTargets.js'

afterEach(() => { document.body.innerHTML = '' })
const stops = () => getModalTabStops(document.body).map(element => element.id)

describe('modal focus targets', () => {
  it.each(['hidden', 'inert', 'aria-hidden="true"', 'style="display:none"', 'style="visibility:hidden"', 'style="content-visibility:hidden"'])('rejects a blocked ancestor: %s', attribute => {
    document.body.innerHTML = `<div ${attribute}><button id="blocked">Hidden</button></div><button id="ok">OK</button>`
    expect(stops()).toEqual(['ok'])
    expect(focusAvailableTarget(document.getElementById('blocked'))).toBe(false)
  })

  it('respects inherited disabled fieldsets while retaining their first legend controls', () => {
    document.body.innerHTML = '<fieldset disabled><legend><button id="legend">Legend</button></legend><button id="disabled">Disabled</button><legend><button id="second">Second</button></legend></fieldset><button id="ok">OK</button>'
    expect(stops()).toEqual(['legend', 'ok'])
  })

  it('distinguishes programmatic focus from sequential stops and orders positive tabindex', () => {
    document.body.innerHTML = '<button id="normal">Normal</button><button id="negative" tabindex="-2">Programmatic</button><input id="hidden" type="hidden"><button id="third" tabindex="3">Third</button><a id="first" tabindex="1" href="#">First</a><div id="static">Text</div>'
    expect(stops()).toEqual(['first', 'third', 'normal'])
    expect(focusAvailableTarget(document.getElementById('negative'))).toBe(true)
    expect(focusAvailableTarget(document.getElementById('static'))).toBe(false)
  })

  it('includes only the first summary of closed details, then includes opened content', () => {
    document.body.innerHTML = '<details><summary id="summary">More</summary><summary id="extra">Extra</summary><button id="content">Content</button></details>'
    expect(stops()).toEqual(['summary'])
    document.querySelector('details').open = true
    expect(stops()).toContain('content')
  })

  it('uses one checked radio per form/group without interpolating radio names as selectors', () => {
    document.body.innerHTML = '<form><input id="a" type="radio" name="a[]"><input id="b" type="radio" name="a[]" checked></form><form><input id="c" type="radio" name="a[]"></form><input id="d" type="radio"><input id="e" type="radio" name="other">'
    expect(stops()).toEqual(['b', 'c', 'd', 'e'])
  })

  it('rejects missing/detached elements and accepts visibility explicitly restored on a child', () => {
    expect(isAvailableFocusTarget(null)).toBe(false)
    expect(isAvailableFocusTarget(document.createElement('button'))).toBe(false)
    expect(getModalTabStops(null)).toEqual([])
    document.body.innerHTML = '<div style="visibility:hidden"><button id="visible" style="visibility:visible">Visible</button></div>'
    expect(stops()).toEqual(['visible'])
  })
})
