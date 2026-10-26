import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import vm from 'node:vm'
const source=readFileSync('src/App.tsx','utf8'),start=source.indexOf('function deleteDiagramEntities('),end=source.indexOf('\nfunction radius(',start),ctx=vm.createContext({})
vm.runInContext(stripTypeScriptTypes(source.slice(start,end)),ctx)
const n=(id,kind='junction')=>({id,kind,x:100,y:100}),e=(id,from,to)=>({id,from,to})
const nodes=[n('a','fitting'),n('j'),n('k'),n('b','sensor'),n('c','valve')],edges=[e('aj','a','j'),e('jk','j','k'),e('kb','k','b'),e('jc','j','c')]
let r=ctx.deleteDiagramEntities(nodes,edges,['a','b','c'],[])
assert.equal(r.nodes.length,0);assert.equal(r.edges.length,0);assert.equal(r.deletedEdges.size,4)
r=ctx.deleteDiagramEntities(nodes,edges,['c'],[])
assert.equal(r.nodes.length,4);assert.equal(r.edges.length,3)
r=ctx.deleteDiagramEntities(nodes,edges,[],['aj','kb'])
assert.deepEqual([...r.deletedNodes].sort(),['j','k']);assert.equal(r.edges.length,0)
r=ctx.deleteDiagramEntities([...nodes,n('unrelated')],[...edges,{id:'stub',start:{x:1,y:1},end:{x:5,y:5}}],['a','b','c'],[])
assert.equal(r.nodes.length,1);assert.equal(r.nodes[0].id,'unrelated');assert.equal(r.edges[0].id,'stub')
assert(!source.includes("nodes.filter(n=>n.kind!=='junction'&&n.x>=minX"))
assert(source.includes('const all=nodes.map(n=>n.id)'))
console.log('Junction checks passed: recursive orphan cleanup, surviving two-way junctions, deletion tombstones, unrelated nodes/stubs, group selection.')
