import assert from 'node:assert/strict'
import {registerHooks, stripTypeScriptTypes} from 'node:module'
import {existsSync, readFileSync} from 'node:fs'
import vm from 'node:vm'
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c)}return next(s,c)},load(u,c,next){if(u.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8')),shortCircuit:true};return next(u,c)}})
const {applyCustomBehavior,stateLabel,shapeVisible,appearanceColor,ventsToAmbient,isPressureInstrument,validateSymbolMetadata}=await import('../src/symbolBehavior.ts')
const {sopState,sopSentence,sopProblems,emptySop}=await import('../src/sopModel.ts')
const {parseProjectFile,prepareProjectAppend}=await import('../src/projectImport.ts')
const base={id:'heater',customId:'heater-symbol',kind:'custom',tag:'HTR-1',x:200,y:140}
const heaterSymbol={id:'heater-symbol',name:'Heater',description:'Resistance heater',elements:[{id:'outline',type:'rect',x1:100,y1:80,x2:300,y2:200},{id:'glow',type:'line',x1:120,y1:100,x2:280,y2:180,visibleIn:'active'}],behavior:{kind:'electrical',defaultState:'closed'},appearance:{activeColor:'#ff8800',inactiveColor:'#8395a7'}}
const heater=applyCustomBehavior(base,heaterSymbol)
assert.equal(heater.kind,'electrical');assert.equal(stateLabel(heater),'Off')
assert.equal(applyCustomBehavior({...heater,state:'open'},heaterSymbol).state,'open','library edits preserve placed power states')
assert.equal(applyCustomBehavior(heater,heaterSymbol),heater,'normalization must stabilize without autosave loops')
const valve=applyCustomBehavior({...base,id:'valve',customId:'valve-symbol'},{behavior:{kind:'valve',defaultState:'open',cv:0.8,canVentToAmbient:true}})
assert.equal(valve.kind,'valve');assert.equal(valve.state,'open');assert.equal(valve.cv,0.8)
assert.equal(valve.ventsToAmbient,undefined,'supporting vents must not enable them automatically')
const nozzle=applyCustomBehavior({...base,id:'nozzle',customId:'nozzle-symbol',ventsToAmbient:true},{behavior:{kind:'passive',canVentToAmbient:true}})
assert(ventsToAmbient(nozzle),'passive nozzles vent without a fake open state')
assert(!ventsToAmbient({...valve,state:'closed',ventsToAmbient:true}))
assert(ventsToAmbient({...valve,state:'open',ventsToAmbient:true}))
assert(!applyCustomBehavior(nozzle,{behavior:{kind:'passive',canVentToAmbient:false}}).ventsToAmbient)
const sensor=applyCustomBehavior({...base,id:'tc',customId:'tc-symbol'},{behavior:{kind:'sensor',measurement:'temperature',unit:'°C'}})
assert(!isPressureInstrument(sensor));assert(isPressureInstrument({...sensor,measurement:'pressure'}))
const action=(type,target)=>({id:type,type,target,name:'',value:0,text:''})
const doc={...emptySop(),steps:[{id:'step-on',title:'Heat',role:'SO',actions:[action('on','heater')]},{id:'step-off',title:'Stop',role:'SO',actions:[action('off','heater')]}]}
assert.equal(stateLabel(sopState([heater],doc,-1)[0]),'Off')
assert.equal(stateLabel(sopState([heater],doc,0)[0]),'On')
assert.equal(stateLabel(sopState([heater],doc,1)[0]),'Off')
assert.match(sopSentence(doc.steps[0].actions[0],[heater]),/^Turn on/)
assert.deepEqual(sopProblems(doc,[heater]),[])
assert(sopProblems({...doc,steps:[{...doc.steps[0],actions:[action('open','heater')]}]},[heater]).length)
assert.match(sopSentence({...action('verify','tc'),value:80},[sensor]),/80 °C/)
assert(!shapeVisible({visibleIn:'active'},false));assert(shapeVisible({visibleIn:'inactive'},false));assert(shapeVisible({},true))
assert.equal(appearanceColor(heaterSymbol.appearance,true,'#ffffff'),'#ff8800')
const payload={format:'propflow-project',version:2,projectName:'Behavior test',nodes:[heater],edges:[],shapes:[],canvasSize:{w:850,h:580},sop:doc,customSymbols:[heaterSymbol]}
const file=value=>({size:100,name:'test.json',text:async()=>JSON.stringify(value)})
const parsed=await parseProjectFile(file(payload)),appended=prepareProjectAppend(parsed.doc)
assert.deepEqual(parsed.doc.customSymbols,[heaterSymbol])
assert.equal(appended.plans[0].nodes[0].customId,appended.customSymbols[0].id)
assert.equal(appended.plans[0].sop.steps[0].actions[0].target,appended.plans[0].nodes[0].id)
assert.deepEqual(appended.customSymbols[0].behavior,heaterSymbol.behavior)
for(const patch of [{behavior:{kind:'bogus'}},{appearance:{activeColor:'url(bad)'}},{behavior:{kind:'valve',cv:-1}},{elements:[{...heaterSymbol.elements[0],visibleIn:'sometimes'}]}])await assert.rejects(parseProjectFile(file({...payload,customSymbols:[{...heaterSymbol,...patch}]})),/Invalid/)
// Exercise the actual fluid traversal: switching a heater off must not shut its fluid path.
const source=readFileSync('src/App.tsx','utf8')
const functions=['inferredPort','trace','ventingReceiverTanks'].map(name=>{const start=source.indexOf(`function ${name}(`),end=name==='inferredPort'?source.indexOf('\n',start):source.indexOf('\n}',start)+2;return source.slice(start,end)}).join('\n')
const context=vm.createContext({ventsToAmbient,rotatePoint:p=>p});vm.runInContext(stripTypeScriptTypes(functions),context)
const tank={id:'tank',kind:'tank',tag:'TK-1',x:0,y:140,pressure:100,fluid:'GN2',tankRole:'receiver',transientSource:true}
const edges=[{id:'e1',from:'tank',to:'heater'},{id:'e2',from:'heater',to:'nozzle'}]
for(const state of ['open','closed']){const nodes=[tank,{...heater,state},{...nozzle,x:400}];assert(context.trace(nodes,edges,true).activeNodes.has('nozzle'));assert(context.ventingReceiverTanks(nodes,edges).has('tank'))}
assert(!context.trace([tank,{...valve,id:'heater',state:'closed'},nozzle],edges,true).activeNodes.has('nozzle'))
validateSymbolMetadata(heaterSymbol)
console.log('Symbol behavior checks passed: passive venting, valve flow blocking/Cv, electrical On/Off SOP inheritance without fluid blocking, measurement units, state appearance, stable defaults, JSON round trip/remapping and invalid metadata rejection.')
