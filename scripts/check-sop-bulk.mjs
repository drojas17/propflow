import assert from 'node:assert/strict'
import {registerHooks,stripTypeScriptTypes} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
import vm from 'node:vm'
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c)}return next(s,c)},load(u,c,next){if(u.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8')),shortCircuit:true};return next(u,c)}})
const {setSopComponentActions,sopState}=await import('../src/sopModel.ts')
const nodes=[{id:'nk',kind:'valve',symbolType:'manual-ball',tag:'NK-1',state:'open'},{id:'ntv',kind:'valve',symbolType:'solenoid',tag:'NTV-1',state:'closed'},{id:'pv',kind:'valve',symbolType:'pneumatic-ball',tag:'PV-1',state:'open'},{id:'heater',kind:'electrical',tag:'HTR-1',state:'open'}]
const make=(type,target,id=type+'-'+target)=>({id,type,target,name:'',value:0,text:''})
const doc={title:'Bulk regression',initial:{nk:'open',ntv:'open',pv:'closed',heater:'open'},regulators:{reg:150},safing:{nk:'closed'},steps:[{id:'previous',title:'Earlier',role:'SO',actions:[make('open','pv')]},{id:'active',title:'Selected',role:'SO',actions:[{...make('open','nk','existing-nk'),name:'Nitrogen isolation'},make('open','nk','duplicate-nk'),make('open','ntv','existing-ntv'),make('regulator','reg'),make('on','heater'),{...make('wait',''),value:5},{...make('verify','pt'),value:100}]},{id:'later',title:'Later',role:'SO',actions:[make('open','nk')]}]}
const original=structuredClone(doc)
const valves=nodes.filter(n=>n.kind==='valve')
for(const type of ['close','open']){
 const updates=valves.map(n=>make(type,n.id)),expected=type==='close'?'closed':'open'
 for(const index of [-1,1]){
  const changed=setSopComponentActions(doc,index,updates),states=sopState(nodes,changed,index)
  assert(states.filter(n=>n.kind==='valve').every(n=>n.state===expected),`${type} all must update every valve at index ${index}`)
  assert.equal(states.find(n=>n.id==='heater').state,'open')
  assert.deepEqual(changed.regulators,doc.regulators);assert.deepEqual(changed.safing,doc.safing)
  if(index===1){
   assert.deepEqual(changed.steps[0],doc.steps[0]);assert.deepEqual(changed.steps[2],doc.steps[2])
   assert.deepEqual(changed.steps[1].actions.filter(a=>!['open','close'].includes(a.type)),doc.steps[1].actions.filter(a=>!['open','close'].includes(a.type)))
   assert.equal(changed.steps[1].actions.filter(a=>a.target==='nk').length,1)
   assert.equal(changed.steps[1].actions.find(a=>a.target==='nk').id,'existing-nk')
   assert.equal(changed.steps[1].actions.find(a=>a.target==='nk').name,'Nitrogen isolation')
  }else assert.deepEqual(changed.steps,doc.steps)
 }
}
assert.deepEqual(doc,original,'batch edits must not mutate the history snapshot')
assert.equal(setSopComponentActions(doc,0,[]),doc)
assert.equal(setSopComponentActions(doc,100,[make('close','nk')]),doc)
// Execute the actual UI callbacks to check one change/undo gesture, including Default all.
const source=readFileSync('src/SopWorkspace.tsx','utf8')
let current=doc,calls=0
const context=vm.createContext({valves,componentAction:(node,type)=>make(type,node.id),setComponents:updates=>{calls++;current=setSopComponentActions(current,1,updates)}})
const functions=['openAllValves','closeAllValves','defaultAllValves'].map(name=>source.match(new RegExp(` const ${name}=([^\\n]+)`))[0]).join('\n')
vm.runInContext(stripTypeScriptTypes(functions)+'\nopenAllValves();',context)
assert.equal(calls,1);assert(sopState(nodes,current,1).filter(n=>n.kind==='valve').every(n=>n.state==='open'))
vm.runInContext('closeAllValves()',context);assert.equal(calls,2);assert(sopState(nodes,current,1).filter(n=>n.kind==='valve').every(n=>n.state==='closed'))
vm.runInContext('defaultAllValves()',context);assert.equal(calls,3)
const states=sopState(nodes,current,1)
assert.equal(states.find(n=>n.id==='nk').state,'closed','Default all preserves the manual valve')
assert.equal(states.find(n=>n.id==='ntv').state,'closed');assert.equal(states.find(n=>n.id==='pv').state,'open')
assert.equal(states.find(n=>n.id==='heater').state,'open')
console.log('SOP bulk regression checks passed: every valve, one update per click, initial/current-step changes, defaults, duplicate replacement, stable action IDs/names, unrelated actions/electrical states and immutable undo snapshots.')
