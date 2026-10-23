import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'

const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const names=new Set(['radius','rotatePoint','portPoint','boundaryToward','edgeAxis','edgeRoute','projectToRoute','splitRenderedEdge'])
const functions=[...names].map(name=>{
 const start=source.indexOf(`function ${name}(`)
 assert(start>=0,`Missing ${name}`)
 const end=name==='splitRenderedEdge'?source.indexOf('\n}',start)+2:source.indexOf('\n',start)
 return source.slice(start,end)
}).join('\n')
const context=vm.createContext({uid:(()=>{let n=0;return()=>`split-${++n}`})()})
vm.runInContext(stripTypeScriptTypes(functions),context)
const plain=x=>JSON.parse(JSON.stringify(x))
const simplify=points=>points.reduce((out,p)=>{
 if(out.length&&Math.hypot(p.x-out.at(-1).x,p.y-out.at(-1).y)<1e-8)return out
 while(out.length>1){const a=out.at(-2),b=out.at(-1);if(Math.abs((b.x-a.x)*(p.y-b.y)-(b.y-a.y)*(p.x-b.x))>1e-7)break;out.pop()}
 out.push(p);return out
},[])
const nodes=[{id:'a',kind:'sensor',x:100,y:100},{id:'b',kind:'sensor',x:600,y:300}]
const cases=[
 {fromPort:'right',toPort:'left',bend:240,bendAxis:'x'},
 {fromPort:'bottom',toPort:'top',bend:180,bendAxis:'y'},
 {fromPort:'right',toPort:'left',waypoints:[{x:200,y:100},{x:200,y:220},{x:450,y:220},{x:450,y:300}]},
 {}, // Legacy implicit endpoints must stay fixed when the opposite endpoint becomes a tee.
 {fromPort:'border:13:7',toPort:'border:-13:-7',bend:350},
]
let splits=0
for(const extra of cases){
 const edge={id:'original',from:'a',to:'b',lineType:'flex',assembly:[{id:'part',type:'adapter',label:'Adapter'}],...extra}
 const original=plain(context.edgeRoute(edge,nodes))
 for(let i=0;i<original.length-1;i++){
  const a=original[i],b=original[i+1];if(Math.hypot(a.x-b.x,a.y-b.y)<1e-8)continue
  for(const fraction of [0,.25,.75,1]){
   const raw={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction},hit=context.projectToRoute(raw,original),j={id:'j',kind:'junction',x:hit.p.x,y:hit.p.y}
   const halves=plain(context.splitRenderedEdge(edge,nodes,hit,j.id)),routes=halves.map(e=>plain(context.edgeRoute(e,[...nodes,j])))
   assert.deepEqual(simplify([...routes[0],...routes[1]]),simplify(original))
   assert.equal(halves[0].fromPort,extra.fromPort??halves[0].fromPort)
   assert.equal(halves[1].toPort,extra.toPort??halves[1].toPort)
   for(const half of halves){assert.equal(half.lineType,'flex');assert.deepEqual(half.assembly,edge.assembly);assert.notEqual(half.id,edge.id)}
   assert.deepEqual(plain(context.edgeRoute(halves[0],[...nodes,j])),routes[0])
   // Repeated branches on an already split run must also preserve its geometry.
   const nextHit=context.projectToRoute(routes[0][1],routes[0]),j2={id:'j2',kind:'junction',...nextHit.p}
   const quarters=context.splitRenderedEdge(halves[0],[...nodes,j],nextHit,'j2')
   assert.deepEqual(simplify(plain(quarters.flatMap(e=>context.edgeRoute(e,[...nodes,j,j2])))),simplify(routes[0]))
   splits++
  }
 }
}
assert(!source.includes('edgePoints('),'Hit testing must use the rendered route')
console.log(`Pipe split regression checks passed: ${splits} split positions, x/y bends, waypoints, legacy and explicit ports, metadata and repeated branches.`)
