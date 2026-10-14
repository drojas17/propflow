import assert from 'node:assert/strict'
import {registerHooks,stripTypeScriptTypes} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
registerHooks({
 resolve(specifier,context,next){if(specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier)){const url=new URL(specifier+'.ts',context.parentURL);if(existsSync(url))return next(url.href,context)}return next(specifier,context)},
 load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8')),shortCircuit:true};return next(url,context)}
})
const {emptySop}=await import('../src/sopModel.ts')
const {appliesTo,wouldCycle,evaluateFailure,validateExtensions}=await import('../src/testModel.ts')
const {captureDiagram,selectedDiagram}=await import('../src/projectPlanning.ts')
const {parseProjectFile,prepareProjectAppend,validateDiagramData}=await import('../src/projectImport.ts')
const {createCollabDoc,projectToDoc,docToProject,readDocState,pushStateToDoc,mergeRemoteProject}=await import('../src/lib/collab.ts')
const sop={...emptySop(),title:'Pressurize',initial:{valve:'closed'},steps:[{id:'step',title:'Open supply',role:'SO',actions:[{id:'action',type:'open',target:'valve',name:'supply',value:0,text:''}]}]}
const sequence={id:'seq',name:'Pressurization',document:sop}
const diagram={nodes:[{id:'valve',kind:'valve',tag:'MV-1',x:100,y:100,state:'closed'},{id:'tank',kind:'tank',tag:'TK-1',x:300,y:100}],edges:[{id:'pipe',from:'valve',to:'tank'},{id:'stub',start:{x:20,y:20},end:{x:40,y:20}}],shapes:[],canvasSize:{w:850,h:580},sop,sequences:[sequence]}
const plan={...structuredClone(diagram),id:'cold',name:'Cold flow',type:'cold-flow'}
const event=(id,kind='event',children=[])=>({id,title:id,kind,category:'Fluid',children,componentIds:['valve'],detection:'PT rise',response:'Abort'})
const events=[event('loss'),event('stuck'),event('or','or',['loss','stuck']),event('and','and',['loss','stuck'])]
const tree={id:'tree',title:'Pressure loss',rootId:'or',scopes:[]}
assert.equal(evaluateFailure(events,'or',new Set(['loss'])),true)
assert.equal(evaluateFailure(events,'and',new Set(['loss'])),false)
assert.equal(evaluateFailure(events,'and',new Set(['loss','stuck'])),true)
assert.equal(evaluateFailure([event('incomplete','or',['loss']),...events],'incomplete',new Set()),null)
assert.equal(wouldCycle(events,'loss','or'),true)
assert.equal(wouldCycle(events,'or','loss'),false)
assert.equal(appliesTo(tree,'cold','seq','step'),true)
assert.equal(appliesTo({...tree,scopes:[{testId:'cold',sequenceId:'seq',stepId:'step'}]},'cold','seq','other'),false)
assert.equal(appliesTo({...tree,scopes:[{testId:'cold'}]},'cold','new-sop','new-step'),true)
const captured=captureDiagram(diagram,[plan],'cold','seq',{...diagram,nodes:diagram.nodes.slice(0,1),edges:[diagram.edges[1]],sop:{...sop,title:'Cold only'}})
assert.equal(captured.base.nodes.length,2)
assert.equal(captured.base.sop.title,'Pressurize')
assert.equal(captured.tests[0].nodes.length,1)
assert.equal(captured.tests[0].sop.title,'Cold only')
assert.equal(selectedDiagram(captured.base,captured.tests,'baseline','seq').selected.document.title,'Pressurize')
const second={id:'second',name:'Drain',document:emptySop()}
const sequenceCapture=captureDiagram({...diagram,sequences:[sequence,second]},[],'baseline','second',{...diagram,sop:{...emptySop(),title:'New drain'}})
assert.equal(sequenceCapture.base.sop.title,'Pressurize')
assert.equal(sequenceCapture.base.sequences[1].document.title,'New drain')
const doc={...diagram,testPlans:[plan],projectName:'Review project',failureAnalysis:{events,trees:[tree]},parts:[],customSymbols:[],symbolOverrides:{}}
const file=new File([JSON.stringify({format:'propflow-project',version:2,...doc})],'review.json')
const parsed=await parseProjectFile(file)
assert.deepEqual(parsed.doc.testPlans,[plan])
const appended=prepareProjectAppend(doc)
assert.equal(appended.plans.length,2)
assert.notEqual(appended.plans[0].nodes[0].id,'valve')
assert.equal(appended.plans[0].edges[0].from,appended.plans[0].nodes[0].id)
assert.equal(appended.plans[0].sequences[0].document.steps[0].actions[0].target,appended.plans[0].nodes[0].id)
assert.equal(appended.failureAnalysis.events[0].componentIds[0],appended.plans[0].nodes[0].id)
assert.equal(appended.failureAnalysis.trees[0].scopes.length,2)
assert.equal(appended.plans[0].nodes[0].id,appended.plans[1].nodes[0].id)
await assert.rejects(()=>parseProjectFile(new File([JSON.stringify({...doc,testPlans:[{...plan,nodes:[{id:'bad',kind:'valve',tag:'BAD',x:null,y:5}]}]})],'bad.json')),/component/)
await assert.rejects(()=>parseProjectFile(new File([JSON.stringify({...doc,sop:{...sop,steps:[{...sop.steps[0],actions:[{type:'open'}]}]}})],'bad.json')),/SOP action/)
assert.throws(()=>validateExtensions({...doc,failureAnalysis:{events:[event('cycle','or',['cycle'])],trees:[]}},v=>validateDiagramData(v,[])),/cycle/)
const warnings=[];const normalized=validateDiagramData({...diagram,edges:[...diagram.edges,{id:'dangling',from:'missing',to:'valve'}]},warnings)
assert.equal(normalized.edges.length,2);assert.equal(warnings.length,1)
const c=createCollabDoc();projectToDoc(c,doc);const base=readDocState(c)
assert.deepEqual(docToProject(c).failureAnalysis,doc.failureAnalysis)
pushStateToDoc(c,{...base,testPlans:captured.tests},base)
assert.equal(docToProject(c).nodes.length,2)
assert.equal(docToProject(c).testPlans[0].nodes.length,1)
const changedBase=readDocState(c)
const remote={...docToProject(c),failureAnalysis:{...doc.failureAnalysis,events:events.map(e=>e.id==='loss'?{...e,title:'Remote change'}:e)}}
mergeRemoteProject(c,remote,changedBase)
pushStateToDoc(c,{...changedBase,projectName:'Renamed'},changedBase)
assert.equal(docToProject(c).failureAnalysis.events.find(e=>e.id==='loss').title,'Remote change')
const beforeDelete=readDocState(c);pushStateToDoc(c,{...beforeDelete,testPlans:[]},beforeDelete,new Set(['testPlan:cold']))
assert.equal(docToProject(c).testPlans.length,0);assert.equal(docToProject(c).nodes.length,2)
c.undoManager.undo();assert.equal(docToProject(c).testPlans.length,1)
c.doc.destroy()
console.log('Planning regression checks passed: test/sequence isolation, scopes, gates, cycles, import validation/remapping, Yjs persistence, stale-peer protection, delete/undo, dangling edges and stubs.')
