import assert from 'node:assert/strict'
import {registerHooks,stripTypeScriptTypes} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c)}return next(s,c)},load(u,c,next){if(u.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8')),shortCircuit:true};return next(u,c)}})
const Y=await import('yjs')
const {createCollabDoc,projectToDoc,readDocState,pushStateToDoc,docToProject}=await import('../src/lib/collab.ts')
const seed={nodes:[{id:'a',kind:'valve',tag:'A',x:100,y:100},{id:'b',kind:'valve',tag:'B',x:300,y:100}],edges:[],shapes:[],canvasSize:{w:850,h:580},sop:null}
const docs=[]
const make=(id)=>{const c=createCollabDoc();if(id)c.doc.clientID=id;projectToDoc(c,structuredClone(seed));docs.push(c);return c}
const a=make(100),late=make(200);a.doc.transact(()=>a.nodes.set('a',{...a.nodes.get('a'),x:222}),'local')
Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(late.doc),'remote');Y.applyUpdate(late.doc,Y.encodeStateAsUpdate(a.doc),'remote')
console.log('Late peer seeds older JSON + full-state handshake:',{expectedEditedX:222,actualX:a.nodes.get('a').x,converged:JSON.stringify(docToProject(a))===JSON.stringify(docToProject(late))});const joinedX=a.nodes.get('a').x
for(const doc of docs){doc.awareness.destroy();doc.doc.destroy()}
assert.equal(joinedX,222,'Late join must preserve the live edit; this diagnostic currently fails because an older independent seed wins')
