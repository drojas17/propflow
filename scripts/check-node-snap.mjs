import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import vm from 'node:vm'
const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const names=['radius','rotatePoint','portPoint','portAxis','snapConnectedNode']
const functions=names.map(name=>{
 const start=source.indexOf(`function ${name}(`);assert(start>=0)
 const end=name==='snapConnectedNode'?source.indexOf('\n}',start)+2:source.indexOf('\n',start)
 return source.slice(start,end)
}).join('\n')
const context=vm.createContext({});vm.runInContext(stripTypeScriptTypes(functions),context)
const plain=x=>JSON.parse(JSON.stringify(x))
// FTV-1 and its neighboring tee/check valve geometry from OSIRIS.
const valve={id:'v',kind:'valve',symbolType:'servo-ball',x:1544.5207629731824,y:479.51514145842486,portRx:18,portRy:40,portOffsets:{top:40,left:18,right:18,bottom:12}}
const tee={id:'j',kind:'junction',x:1490.5391091898002,y:477.98422326627}
const check={id:'c',kind:'control',symbolType:'check-valve',x:1674.5455888696792,y:valve.y,portRx:30,portRy:13}
const edges=[{id:'right',from:'v',to:'c',fromPort:'right',toPort:'left'},{id:'left',from:'v',to:'j',fromPort:'left'}]
const snap=(nodes,es,delta,moving=['v'])=>plain(context.snapConnectedNode(nodes[0],nodes,es,moving,delta))
const left=snap([valve,tee,check],edges,{x:20,y:-2})
assert.equal(left.axis,'x');assert.equal(left.guide,tee.y)
assert.equal(valve.y+left.delta.y,tee.y,'FTV-1 must align with its left tee even with a ported neighbor on the right')
assert.equal(left.delta.x,20)
const right=snap([valve,tee,check],edges,{x:20,y:1})
assert.equal(right.guide,check.y,'The nearest wired run must still win when dragging toward the right neighbor alignment')
const reverse=edges.map(e=>({...e,from:e.to,to:e.from,fromPort:e.toPort,toPort:e.fromPort}))
assert.deepEqual(snap([valve,tee,check],reverse,{x:20,y:-2}),left)
assert.equal(snap([valve,tee,check],edges,{x:20,y:-2},['v','j']).guide,check.y,'Moving nodes cannot serve as references')
assert.equal(snap([valve,tee,check],edges,{x:20,y:-2},['v','j','c']),null)
// Rotation and an off-center named port: align the actual port, not the symbol center.
const rotated={...valve,x:200,y:200,rotation:90,portOffsets:{left:18,right:18,top:40,bottom:12}},j2={...tee,x:260,y:350}
const vertical=snap([rotated,j2],[{id:'e',from:'v',to:'j',fromPort:'bottom'}],{x:46,y:40})
assert.equal(vertical.axis,'x')
const moved={...rotated,x:rotated.x+vertical.delta.x,y:rotated.y+vertical.delta.y}
assert.equal(context.portPoint(moved,'bottom').y,j2.y)
const asymmetric={...valve,x:200,y:200,portOffsets:{left:18,right:18,top:40,bottom:12}},j3={...tee,x:200,y:380}
const v=snap([asymmetric,j3],[{id:'e',from:'v',to:'j',fromPort:'bottom'}],{x:8,y:10})
assert.equal(v.axis,'y');assert.equal(v.delta.x,0);assert.equal(v.delta.y,10)
assert.equal(snap([valve],[],{x:10,y:20}),null)
console.log('Node snap regression checks passed: OSIRIS FTV-1 tee alignment, nearest run, reversed edges, moving-group exclusion, rotation, asymmetric ports and disconnected fallback.')
