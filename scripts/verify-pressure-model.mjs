import assert from 'node:assert/strict'
import fs from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {execFileSync} from 'node:child_process'

async function loadModel(file){
 let code=stripTypeScriptTypes(fs.readFileSync(file,'utf8'))
 code=code.replace(/import nitrogen from '.\/nitrogenProperties.json';?/,`const nitrogen=${fs.readFileSync('src/nitrogenProperties.json','utf8')};`)
 code=code.replace(/export \{\s*stateLabel\s*\} from '.\/symbolBehavior';?/,'')
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
}
const m=await loadModel('src/pressureModel.ts'),sop=await loadModel('src/sopModel.ts')
const node=(id,kind='fitting',extra={})=>({id,tag:id,kind,x:0,y:0,...extra})
const nodes=[node('s','tank',{tankRole:'source',fluid:'GN2',pressure:700}),node('v','valve',{state:'open'}),node('d','sensor')]
const edges=[{id:'a',from:'s',to:'v'},{id:'b',from:'v',to:'d'}]
const path=m.findPaths(nodes,edges,'s','d').paths[0]
const inputs={flow:.12545422357,temperatureK:300,lengthM:1.5,idIn:.430,material:'stainless',roughnessMm:.015,useDiagram:false,fluid:'nitrogen',density:NaN,viscosity:NaN,sourcePsig:700}
const direct={nodes:['s','d'],edges:[{id:'a',from:'s',to:'d'}]}
const fixture=JSON.parse(execFileSync('python',['-c',String.raw`
import json,math
import CoolProp.CoolProp as C
rows=[]
for t in (250,277.3,300,350):
 p=700*6894.757293168+101325;d=.430*.0254;rho=C.PropsSI('D','T',t,'P',p,'Nitrogen');mu=C.PropsSI('V','T',t,'P',p,'Nitrogen');v=.12545422357/(rho*math.pi*d*d/4);re=rho*v*d/mu
 lo,hi=.005,.2
 for _ in range(80):
  f=(lo+hi)/2
  if 1/math.sqrt(f)+2*math.log10(1.5e-5/d/3.7+2.51/(re*math.sqrt(f)))>0:lo=f
  else:hi=f
 dp=(lo+hi)/2*1.5/d*rho*v*v/2/6894.757293168
 rows.append({'t':t,'rho':rho,'mu':mu,'dp':dp})
print(json.dumps(rows))
`],{encoding:'utf8'}))
let maxError=0
for(const f of fixture){const q=m.nitrogenProperties(f.t,700*m.PSI+m.ATM),r=m.solvePath(direct,nodes,{...inputs,temperatureK:f.t});assert(r.valid);const error=Math.abs(r.loss/f.dp-1);maxError=Math.max(maxError,error);assert(error<.001,`CoolProp pressure-drop mismatch: ${error}`);assert(Math.abs(q.density/f.rho-1)<.001)}
assert.equal(m.frictionFactor(1000,0),.064)
const r=m.solvePath(path,nodes,inputs);assert(r.valid);assert(r.outlet<700)
assert(m.solvePath(path,nodes,{...inputs,roughnessMm:.0015}).loss<r.loss)
assert(m.solvePath(path,nodes,{...inputs,idIn:.652}).loss<r.loss)
const closed=m.solvePath(path,nodes.map(n=>n.id==='v'?{...n,state:'closed'}:n),inputs);assert.equal(closed.outlet,null);assert.equal(closed.rows.at(-1).pressure,null)
assert(!m.solvePath(path,nodes,{...inputs,flow:10}).valid)
assert(!m.solvePath(path,nodes,{...inputs,temperatureK:100}).valid)
assert(!m.solvePath(path,nodes,{...inputs,sourcePsig:NaN}).valid)
assert(!m.solvePath(path,nodes,{...inputs,fluid:'liquid'}).valid)
assert(m.solvePath(path,nodes,{...inputs,flow:0}).valid)
assert(m.solvePath(path,nodes,{...inputs,fluid:'liquid',density:800,viscosity:.002,flow:.01}).valid)
assert(m.solvePath(path,nodes.map(n=>n.id==='v'?{...n,cv:2}:n),inputs).loss>r.loss)
const physical={...direct,edges:[{...direct.edges[0],hydraulics:{lengthM:3,idIn:.652,material:'copper'}}]}
assert(m.solvePath(physical,nodes,{...inputs,useDiagram:true}).loss<m.solvePath(physical,nodes,inputs).loss)
const regs=[nodes[0],node('r','regulator',{pressure:600}),nodes[2]],regPath={nodes:['s','r','d'],edges}
const regulated=m.solvePath(regPath,regs,inputs);assert(regulated.valid);assert(regulated.rows.some(r=>r.id==='r:in'));assert(regulated.outlet<600)
assert(!m.solvePath(regPath,regs.map(n=>n.id==='r'?{...n,pressure:800}:n),inputs).valid)
const directional=[nodes[0],node('v','valve',{state:'open',symbolType:'check-valve'}),nodes[2]]
const de=[{...edges[0],toPort:'left'},{...edges[1],fromPort:'right'}]
assert.equal(m.findPaths(directional,de,'s','d').paths.length,1)
assert.equal(m.findPaths(directional,de,'d','s').paths.length,0)
assert.equal(m.findPaths(nodes,[{...edges[0],toPort:'actuator'},edges[1]],'s','d').paths.length,0)
const doc={title:'test',initial:{v:'closed'},regulators:{},steps:[{id:'1',title:'Open',role:'operator',actions:[{id:'a',type:'open',target:'v',name:'',value:0,text:''}]}]}
assert.equal(sop.sopState(nodes,doc,-1)[1].state,'closed');assert.equal(sop.sopState(nodes,doc,0)[1].state,'open')
const v=m.ventTime(10,700,1,300,2,.7);assert(v.seconds>0&&v.initiallyChoked)
assert(Math.abs(m.ventTime(20,700,1,300,2,.7).seconds/v.seconds-2)<1e-12)
assert(Math.abs(m.ventTime(10,700,1,300,4,.7).seconds/v.seconds-.25)<1e-12)
// Independently integrate in linear pressure coordinates (trapezoid), rather than log-midpoint.
let seconds=0;const N=200000,dp=(700-1)*m.PSI/N,A=.7*Math.PI*.002**2/4,k=1.4,R=296.803
const rate=p=>{const ratio=Math.max(m.ATM/p,(2/(k+1))**(k/(k-1)));return A*p*Math.sqrt(2*k/(R*300*(k-1))*(ratio**(2/k)-ratio**((k+1)/k)))}
for(let i=0;i<N;i++){const p=m.ATM+m.PSI+(i+.5)*dp;seconds+=.01/(R*300)*dp/rate(p)}
assert(Math.abs(seconds/v.seconds-1)<1e-5)
assert.throws(()=>m.ventTime(10,700,0,300,2,.7))
console.log(`Pressure model checks passed; CoolProp reference pressure-drop max error ${(maxError*100).toFixed(5)}%; vent independent integral ${(Math.abs(seconds/v.seconds-1)*100).toFixed(6)}%.`)
