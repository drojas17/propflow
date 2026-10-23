import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import vm from 'node:vm'
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const names=['radius','rotatePoint','portPoint','boundaryToward','edgeAxis','edgeRoute','movedEdgeWaypoints']
const functions=names.map(name=>{const start=source.indexOf(`function ${name}(`);assert(start>=0);const end=name==='movedEdgeWaypoints'?source.indexOf('\n}',start)+2:source.indexOf('\n',start);return source.slice(start,end)}).join('\n')
const context=vm.createContext({});vm.runInContext(stripTypeScriptTypes(functions),context)
const plain=x=>JSON.parse(JSON.stringify(x))
const nodes=[{id:'v',kind:'valve',x:1544,y:479,portRx:18,portRy:40},{id:'j',kind:'junction',x:1601,y:479}]
const cases=[
 {waypoints:[{x:1543,y:479}]}, // OSIRIS: redundant waypoint behind the valve's right port.
 {waypoints:[{x:1580,y:479},{x:1580,y:600},{x:1601,y:600}]},
 {waypoints:[{x:1562,y:520},{x:1601,y:520}]},
]
let checks=0
for(const extra of cases){
 const original={id:'pipe',from:'v',to:'j',fromPort:'right',...extra},before=JSON.stringify(original)
 for(const moving of [['v'],['j'],['v','j']]){
  let current=original,lastNodes=nodes
  for(let frame=1;frame<=120;frame++){
   const delta={x:40*Math.sin(frame/10),y:frame/6},after=nodes.map(n=>moving.includes(n.id)?{...n,x:n.x+delta.x,y:n.y+delta.y}:n)
   current={...current,waypoints:plain(context.movedEdgeWaypoints(original,nodes,after))};lastNodes=after
   const route=plain(context.edgeRoute(current,after)),expected=plain(context.edgeRoute(original,after))
   assert.deepEqual(route[0],expected[0]);assert.deepEqual(route.at(-1),expected.at(-1))
   for(let i=1;i<route.length;i++)assert(Math.abs(route[i].x-route[i-1].x)<1e-7||Math.abs(route[i].y-route[i-1].y)<1e-7,'Dragging must not create diagonal pipe segments')
   assert(route.every(p=>Math.abs(p.x)<2000&&Math.abs(p.y)<1000),'Repeated pointer events must not propel a waypoint off canvas')
   checks++
  }
  assert.deepEqual(current.waypoints,plain(context.movedEdgeWaypoints(original,nodes,lastNodes)),'Many pointer events must equal one update at the final position')
 }
 assert.equal(JSON.stringify(original),before,'Drag-start geometry must remain immutable')
}
const diagonal={id:'diag',from:'v',to:'j',fromPort:'right',waypoints:[{x:1575,y:490}]}
const moved=nodes.map(n=>n.id==='v'?{...n,x:n.x+20,y:n.y+10}:n)
const diag=plain(context.movedEdgeWaypoints(diagonal,nodes,moved));assert(diag.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))
assert(source.includes('movedEdgeWaypoints(original,nodes,nextNodes)'),'Drag must use the original snapshot, not the preceding frame')
console.log(`Pipe drag regression checks passed: ${checks} frames, each endpoint and groups, straight/looped/bent routes, anchored ends, no diagonals or cumulative drift.`)
