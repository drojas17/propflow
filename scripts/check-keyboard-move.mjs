import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import vm from 'node:vm'
const source=readFileSync('src/App.tsx','utf8'),names=['radius','rotatePoint','portPoint','boundaryToward','edgeAxis','edgeRoute','movedEdgeWaypoints','nudgeDiagram']
const code=names.map(name=>{const start=source.indexOf(`function ${name}(`);const end=['movedEdgeWaypoints','nudgeDiagram'].includes(name)?source.indexOf('\n}',start)+2:source.indexOf('\n',start);return source.slice(start,end)}).join('\n')
const ctx=vm.createContext({});vm.runInContext(stripTypeScriptTypes(code),ctx)
const plain=x=>JSON.parse(JSON.stringify(x)),size={w:850,h:580}
const nodes=[{id:'a',kind:'valve',x:180,y:240},{id:'j',kind:'junction',x:330,y:240},{id:'g',kind:'sensor',x:330,y:120},{id:'b',kind:'valve',x:480,y:240}]
const edges=[{id:'aj',from:'a',to:'j',fromPort:'right',waypoints:[{x:250,y:240}]},{id:'jg',from:'j',to:'g',toPort:'bottom',waypoints:[{x:330,y:200}]},{id:'jb',from:'j',to:'b',bend:390,bendAxis:'x'},{id:'free',start:{x:10,y:10},end:{x:40,y:10}}]
const all=new Set(nodes.map(n=>n.id)),original=JSON.stringify({nodes,edges})
for(const delta of [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},{x:10,y:0},{x:0,y:10}]){
 let state={nodes,edges};for(let i=0;i<20;i++)state=ctx.nudgeDiagram(state.nodes,state.edges,all,delta,size)
 for(let i=0;i<3;i++)assert.deepEqual(plain(ctx.edgeRoute(state.edges[i],state.nodes)),plain(ctx.edgeRoute(edges[i],nodes)).map(p=>({x:p.x+delta.x*20,y:p.y+delta.y*20})), 'Every route point must move with the selection')
 assert.equal(JSON.stringify(state.edges[3]),JSON.stringify(edges[3]))
}
let state={nodes,edges};for(let i=0;i<400;i++)state=ctx.nudgeDiagram(state.nodes,state.edges,all,{x:-1,y:0},size)
assert.equal(state.nodes[0].x,60);assert.equal(state.nodes[1].x-state.nodes[0].x,150,'Boundary clamp must preserve spacing')
const partial=ctx.nudgeDiagram(nodes,edges,new Set(['a']),{x:0,y:10},size),route=plain(ctx.edgeRoute(partial.edges[0],partial.nodes))
assert.deepEqual(route.at(-1),plain(ctx.edgeRoute(edges[0],nodes)).at(-1))
for(let i=1;i<route.length;i++)assert(route[i].x===route[i-1].x||route[i].y===route[i-1].y)
assert.equal(JSON.stringify({nodes,edges}),original,'Undo snapshot must not be mutated')
assert(source.includes('const next=nudgeDiagram(nodes,edges,ids,{x:dx,y:dy},canvasSize);setNodes(next.nodes);setEdges(next.edges);'))
console.log('Keyboard movement checks passed: repeated arrows, Shift-grid moves, waypoint/bend translation, partial selection, fixed ends, rigid boundary limits, immutable undo snapshots.')

