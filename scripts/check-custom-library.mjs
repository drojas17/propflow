import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const mergeUrl = moduleUrl(stripTypeScriptTypes(readFileSync('src/lib/customLibrary.ts', 'utf8')))
const { mergeCustomSymbols } = await import(mergeUrl)
const nozzle = { id: 'tca', name: 'TCA' }, pump = { id: 'pump', name: 'Pump' }
assert.deepEqual(mergeCustomSymbols([pump], [nozzle]), [pump, nozzle])
assert.deepEqual(mergeCustomSymbols([pump], [{ ...pump, name: 'Updated pump' }]), [{ ...pump, name: 'Updated pump' }])
assert.deepEqual(mergeCustomSymbols([], [nozzle]), [nozzle])

let row, readError, conflicts = 0, writes = 0
class Query {
  filters = []
  select() { return this }
  eq(key, value) { this.filters.push([key, value]); return this }
  is(key, value) { return this.eq(key, value) }
  maybeSingle() { return Promise.resolve({ data: structuredClone(row), error: readError }) }
  update(value) { this.value = value; return this }
  insert(value) { this.value = value; this.inserting = true; return this }
  then(resolve, reject) {
    return Promise.resolve().then(() => {
      writes++
      if (conflicts) {
        conflicts--
        row = { id: 1, data: { ...row.data, customSymbols: [...row.data.customSymbols, nozzle] }, updated_at: 'concurrent-version' }
        return { data: [], error: null }
      }
      if (!this.inserting && !this.filters.every(([key, value]) => row[key] === value)) return { data: [], error: null }
      row = structuredClone(this.value)
      return { data: [{ id: 1 }], error: null }
    }).then(resolve, reject)
  }
}
globalThis.libraryTestClient = { from: () => new Query() }
const dbSource = stripTypeScriptTypes(readFileSync('src/lib/db.ts', 'utf8'))
  .replace(/import .* from '\.\/supabase';/, 'const requireSupabase = () => globalThis.libraryTestClient;')
  .replace("'./customLibrary'", JSON.stringify(mergeUrl))
const { saveLibraryDoc } = await import(moduleUrl(dbSource))
row = { id: 1, data: { customSymbols: [nozzle], symbolOverrides: {}, tourReference: { nodes: ['keep'] } }, updated_at: 'v1' }
await saveLibraryDoc({ customSymbols: [pump], symbolOverrides: {} })
assert.deepEqual(row.data.customSymbols, [nozzle, pump])
assert.deepEqual(row.data.tourReference, { nodes: ['keep'] })
row = { id: 1, data: { customSymbols: [pump], symbolOverrides: {} }, updated_at: 'v2' }
conflicts = 1
await saveLibraryDoc({ customSymbols: [{ id: 'heater', name: 'Heater' }], symbolOverrides: {} })
assert.deepEqual(row.data.customSymbols.map(s => s.id), ['pump', 'tca', 'heater'])
readError = new Error('read denied')
const before = writes
await assert.rejects(saveLibraryDoc({ customSymbols: [], symbolOverrides: {} }), /read denied/)
assert.equal(writes, before)
readError = null
row = null
await saveLibraryDoc({ customSymbols: [nozzle], symbolOverrides: {} })
assert.deepEqual(row.data.customSymbols, [nozzle])
console.log('Custom library checks passed: project/shared union, shared precedence, stale saves, concurrent additions, read-error protection, first save, and preserved library metadata.')
