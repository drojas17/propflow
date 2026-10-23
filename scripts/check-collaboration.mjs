import assert from 'node:assert/strict'
import {registerHooks,stripTypeScriptTypes} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c)}return next(s,c)},load(u,c,next){if(u.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8')),shortCircuit:true};return next(u,c)}})
const Y=await import('yjs')
const {createCollabDoc,projectToDoc,readDocState,pushStateToDoc,docToProject}=await import('../src/lib/collab.ts')
const seed={nodes:[{id:'a',kind:'valve',tag:'A',x:100,y:100},{id:'b',kind:'valve',tag:'B',x:300,y:100}],edges:[],shapes:[],canvasSize:{w:850,h:580},sop:null}
const docs=[]
const make=(id)=>{const c=createCollabDoc();if(id)c.doc.clientID=id;projectToDoc(c,structuredClone(seed));docs.push(c);return c}
const c=make(),base=readDocState(c),local=structuredClone(base);local.nodes[0].x=120
c.doc.transact(()=>c.nodes.set('b',{...c.nodes.get('b'),x:380}),'remote')
pushStateToDoc(c,local,base,new Set())
console.log('Unrelated peer edit + stale React state:',{expectedPeerX:380,actualPeerX:c.nodes.get('b').x})
assert.equal(c.nodes.get('b').x,380)
const d=make(),b2=readDocState(d),l2=structuredClone(b2);l2.nodes[0].x=120
d.doc.transact(()=>d.nodes.delete('b'),'remote');pushStateToDoc(d,l2,b2,new Set())
console.log('Peer deletion + unrelated stale React edit:',{deletedNodeResurrected:d.nodes.has('b')});assert(!d.nodes.has('b'))
// The same protection must apply to edges, shapes, parts, symbols, plans and procedures.
for(const [key,mapName,prefix] of [['edges','edges','edge'],['shapes','shapes','shape'],['parts','parts','part'],['customSymbols','customSymbols','customSymbol'],['testPlans','testPlans','testPlan'],['sequences','sequences','sequence']]){
 const test=make(),snapshot=structuredClone(seed);snapshot[key]=[{id:'entity',name:'before'}];if(key==='edges')snapshot[key]=[{id:'entity',from:'a',to:'b',name:'before'}];projectToDoc(test,snapshot)
 const previous=readDocState(test),stale=structuredClone(previous);stale.nodes[0].x=130
 test.doc.transact(()=>test[mapName].set('entity',{...test[mapName].get('entity'),name:'peer'}),'remote');pushStateToDoc(test,stale,previous,new Set());assert.equal(test[mapName].get('entity').name,'peer')
 test.doc.transact(()=>test[mapName].delete('entity'),'remote');pushStateToDoc(test,stale,previous,new Set());assert(!test[mapName].has('entity'))
}
const meta=make(),mb=readDocState(meta),ml=structuredClone(mb);ml.nodes[0].x=150
meta.doc.transact(()=>{meta.meta.set('canvasSize',{w:1300,h:900});meta.meta.set('sop',{title:'Peer procedure'})},'remote');pushStateToDoc(meta,ml,mb,new Set());assert.deepEqual(docToProject(meta).canvasSize,{w:1300,h:900});assert.equal(docToProject(meta).sop.title,'Peer procedure')
const fresh=make(),fb=readDocState(fresh),fl=structuredClone(fb);fl.nodes.push({id:'new',x:40,y:40});pushStateToDoc(fresh,fl,fb,new Set());assert(fresh.nodes.has('new'));fresh.undoManager.stopCapturing();const deleteBase=readDocState(fresh),deleted={...deleteBase,nodes:deleteBase.nodes.filter(n=>n.id!=='new')};pushStateToDoc(fresh,deleted,deleteBase,new Set(['node:new']));assert(!fresh.nodes.has('new'));fresh.undoManager.undo();assert(fresh.nodes.has('new'),'Explicit deletion stays undoable')
for(const doc of docs){doc.awareness.destroy();doc.doc.destroy()}
console.log('Collaboration regression checks passed: unrelated peer edits, remote deletion protection across collections, shared canvas/SOP, explicit adds/deletes and undo.')
