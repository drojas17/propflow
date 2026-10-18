import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL)
      if (existsSync(url)) return next(url.href, context)
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('.ts')) return { format: 'module', source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8')), shortCircuit: true }
    return next(url, context)
  },
})

const { encodeSymbolClipboard, decodeSymbolClipboard, pasteSymbolElements } = await import('../src/symbolClipboard.ts')
const marks = [
  { id: 'triangle', type: 'triangle', x1: 10, y1: 20, x2: 80, y2: 90, points: [{ x: 10, y: 20 }, { x: 80, y: 90 }, { x: 30, y: 85 }], rotation: 90, fill: 'solid', shadeOnClosed: false },
  { id: 'curve', type: 'curve', x1: 15, y1: 25, x2: 85, y2: 95, points: [{ x: 15, y: 25 }, { x: 40, y: 50 }, { x: 85, y: 95 }], fill: 'none' },
  { id: 'text', type: 'text', x1: 20, y1: 30, x2: 20, y2: 30, text: 'PT', fontSize: 18, rotation: 270, fill: 'accent' },
]
const encoded = encodeSymbolClipboard(marks)
assert.deepEqual(decodeSymbolClipboard(encoded), marks)
const copied = pasteSymbolElements(decodeSymbolClipboard(encoded), 20)
const again = pasteSymbolElements(decodeSymbolClipboard(encoded), 40)
assert.equal(new Set([...marks, ...copied, ...again].map(mark => mark.id)).size, 9)
for (let i = 0; i < marks.length; i++) {
  assert.equal(copied[i].x1, marks[i].x1 + 20)
  assert.equal(copied[i].y2, marks[i].y2 + 20)
  assert.equal(again[i].x1, marks[i].x1 + 40)
  for (const key of ['rotation', 'fill', 'shadeOnClosed', 'text', 'fontSize']) assert.equal(copied[i][key], marks[i][key])
  if (marks[i].points) assert.deepEqual(copied[i].points, marks[i].points.map(p => ({ x: p.x + 20, y: p.y + 20 })))
}
copied[0].points[0].x = 999
assert.equal(marks[0].points[0].x, 10)
assert.equal(decodeSymbolClipboard(encoded)[0].points[0].x, 10)
for (const text of ['hello', '{}', 'null', '{', encodeSymbolClipboard([]), encoded.replace('"version":1', '"version":2')]) assert.equal(decodeSymbolClipboard(text), null)
for (const patch of [{ x1: null }, { type: 'script' }, { points: [null, {}, {}] }, { rotation: '90' }, { fontSize: -1 }, { fill: 'url(bad)' }, { shadeOnClosed: 'yes' }]) {
  assert.equal(decodeSymbolClipboard(encodeSymbolClipboard([{ ...marks[0], ...patch }])), null)
}
console.log('Symbol clipboard checks passed: multi-shape round trip, fresh IDs, offsets, curve/triangle points, styles, independent copies and malformed clipboard rejection.')
