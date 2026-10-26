import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import vm from 'node:vm'

const app=readFileSync('src/App.tsx','utf8'),model=readFileSync('src/sopModel.ts','utf8')
const extract=(source,name)=>{const start=source.search(new RegExp(`function ${name}(?:<[^>]+>)?\\(`)),end=source.indexOf('\n}',start)+2;return source.slice(start,end)}
const context=vm.createContext({rotatePoint:(p,c,a)=>{const r=a*Math.PI/180,x=p.x-c.x,y=p.y-c.y;return{x:c.x+x*Math.cos(r)-y*Math.sin(r),y:c.y+x*Math.sin(r)+y*Math.cos(r)}},ventsToAmbient:n=>n.boundary==='ambient'||n.ventsToAmbient&&(n.kind!=='valve'||n.state==='open')})
const inferred=app.slice(app.indexOf('function inferredPort('),app.indexOf('\n',app.indexOf('function inferredPort(')))
vm.runInContext(stripTypeScriptTypes([inferred,...['trace','displacedReceiverTanks','sopFluidPreview'].map(n=>extract(app,n)),extract(model,'initialValve').split('\n')[0],extract(model,'sopState')].join('\n')),context)
const n=(id,kind,extra={})=>({id,tag:id,kind,x:0,y:0,...extra})
const nodes=[n('nitrogen','tank',{fluid:'GN2',pressure:1000,tankRole:'source'}),n('reg','regulator',{pressure:250}),n('tank','tank',{fluid:'IPA',fluidLocked:true,tankRole:'receiver'}),n('throttle','valve',{state:'open'}),n('vent','ambient',{boundary:'ambient'})]
const edges=[['nitrogen','reg'],['reg','tank'],['tank','throttle'],['throttle','vent']].map(([from,to],i)=>({id:`e${i}`,from,to,fromPort:'right',toPort:'left'}))
const doc={initial:{throttle:'closed'},regulators:{reg:250},steps:[{actions:[{type:'open',target:'throttle'}]},{actions:[{type:'close',target:'throttle'}]}]}
const preview=index=>context.sopFluidPreview(nodes,edges,doc,index,context.sopState(nodes,doc,index))
let flow=preview(-1)
assert.equal(flow.initial.nodeFluids.get('tank'),'IPA')
assert.equal(flow.displaced.size,0,'closed outlet must not consume the tank contents')
flow=preview(0)
assert.equal(flow.initial.edgeFluids.get('e3'),'IPA','opening the throttle starts with the tank contents')
assert.equal(flow.settled.edgeFluids.get('e3'),'GN2','nitrogen must reach the entire downstream path')
assert.equal(flow.settled.nodeFluids.get('tank'),'GN2')
assert.equal(preview(1).initial.nodeFluids.get('tank'),'GN2','following steps retain displaced contents')
assert.equal(preview(-1).initial.nodeFluids.get('tank'),'IPA','rewind recomputes from the original drawing')
assert.equal(nodes[2].fluid,'IPA','preview must never mutate project metadata')
assert(!context.trace(nodes,edges,true).activeNodes.has('vent'),'normal diagram tracing stays unchanged')
for(const patch of [{state:'closed',kind:'valve'},{pressure:0,kind:'regulator'}]){
 const blocked=nodes.map(n=>n.id==='reg'?{...n,...patch}:n)
 assert.equal(context.sopFluidPreview(blocked,edges,{...doc,steps:[]},-1,blocked).displaced.size,0)
}
const supply=nodes.map(n=>n.id==='tank'?{...n,tankRole:'source',pressure:200}:n)
assert.equal(context.trace(supply,edges,true,new Map()).nodeFluids.get('tank'),'IPA','filled supply tanks are not receivers')
const reversed=nodes.map(n=>n.id==='throttle'?{...n,kind:'control',symbolType:'check-valve'}:n)
const wrongWay=edges.map(e=>e.from==='throttle'?{...e,fromPort:'left'}:e.to==='throttle'?{...e,toPort:'right'}:e)
assert.equal(context.displacedReceiverTanks(reversed,wrongWay,context.trace(reversed,wrongWay,true,new Map())).size,0,'reverse check valve blocks discharge')
if(process.argv[2]){
 const project=JSON.parse(readFileSync(process.argv[2],'utf8'))
 const p=context.sopFluidPreview(project.nodes,project.edges,project.sop,12,context.sopState(project.nodes,project.sop,12))
 const throttle=project.nodes.find(n=>n.tag==='FTV-1'),tank=project.nodes.find(n=>n.tag==='TK-1')
 assert.equal(p.initial.nodeFluids.get(throttle.id),'IPA')
 assert.equal(p.settled.nodeFluids.get(throttle.id),'GN2')
 assert.equal(p.settled.nodeFluids.get(tank.id),'GN2')
 assert.equal(context.sopFluidPreview(project.nodes,project.edges,project.sop,13,context.sopState(project.nodes,project.sop,13)).initial.nodeFluids.get(tank.id),'GN2')
 console.log('OSIRIS steps 13/14: FTV-1 starts IPA, settles GN2, and TK-1 retains GN2 after closing.')
}
console.log('SOP fluid checks passed: nitrogen displacement, closed/disabled supplies, check-valve direction, supply isolation, step inheritance, rewind and immutable drawing.')
