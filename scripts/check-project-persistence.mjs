import assert from 'node:assert/strict'
import {registerHooks,stripTypeScriptTypes} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
registerHooks({resolve(s,c,next){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c)}return next(s,c)},load(u,c,next){if(u.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8')),shortCircuit:true};return next(u,c)}})
const Y=await import('yjs')
const {createCollabDoc,projectToDoc,docToProject,readDocState,pushStateToDoc,mergeRemoteProject}=await import('../src/lib/collab.ts')
const {persistedProject,restoreProject,loadCanonicalProject,createProjectPersistence,mergePersistedProject}=await import('../src/lib/projectPersistence.ts')
const seed={nodes:[{id:'a',x:100,y:100},{id:'b',x:300,y:100}],edges:[{id:'ab',from:'a',to:'b'},{id:'stub',start:{x:1,y:2},end:{x:3,y:4}}],shapes:[],canvasSize:{w:850,h:580},sop:null,parts:[{id:'part',name:'Valve'}]}
const docs=[]
const make=(doc=seed)=>{const c=createCollabDoc();restoreProject(c,structuredClone(doc));docs.push(c);return c}
const edit=(c,id,x)=>c.doc.transact(()=>c.nodes.set(id,{...c.nodes.get(id),x}),'local')
const mockStore=(doc=seed)=>{
 let row=doc?{doc:structuredClone(doc),updatedAt:'1'}:null,revision=1,conflicts=0,writes=0
 const store={async load(){return structuredClone(row)},async compareAndSwap(doc,previous){await Promise.resolve();if((row?.updatedAt??null)!==(previous?.updatedAt??null)){conflicts++;return null}row={doc:structuredClone(doc),updatedAt:String(++revision)};writes++;return structuredClone(row)}}
 return {store,get row(){return row},get conflicts(){return conflicts},get writes(){return writes}}
}
const writer=(c,store,hooks={})=>createProjectPersistence(c,store,{isActive:()=>true,onAcknowledged:()=>{},...hooks})
try {
 // Two tabs opening legacy JSON simultaneously must persist exactly ONE seed.
 const normalize=doc=>({...doc,nodes:doc.nodes.map(n=>({...n,portRx:42}))})
 const migration=mockStore(),[s1,s2]=await Promise.all([loadCanonicalProject(migration.store,normalize),loadCanonicalProject(migration.store,normalize)])
 assert.equal(s1.doc._collab.state,s2.doc._collab.state);assert.equal(migration.writes,1)
 assert.equal(s1.doc.nodes[0].portRx,42,'Normalize before exposing an editable document, not as competing peer seed writes')
 const a=make(s1.doc),late=make(s2.doc);a.doc.clientID=100;late.doc.clientID=200;edit(a,'a',222)
 Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(late.doc),'remote');Y.applyUpdate(late.doc,Y.encodeStateAsUpdate(a.doc),'remote')
 assert.equal(a.nodes.get('a').x,222);assert.deepEqual(docToProject(a),docToProject(late))
 console.log('PASS: simultaneous migration and stale late join preserve live edits')
 // No websocket delivery at all: simultaneous saves must retain BOTH edits.
 const db=mockStore(s1.doc),left=make(s1.doc),right=make(s1.doc);edit(left,'a',501);edit(right,'b',702)
 await Promise.all([writer(left,db.store).save(),writer(right,db.store).save()])
 const reopened=make(db.row.doc);assert.equal(reopened.nodes.get('a').x,501);assert.equal(reopened.nodes.get('b').x,702);assert(db.conflicts>0)
 mergePersistedProject(left,db.row.doc,s1.doc);mergePersistedProject(right,db.row.doc,s1.doc);assert.deepEqual(docToProject(left),docToProject(right))
 console.log('PASS: racing conditional saves retry and survive fresh reload without broadcasts')
 // Save serialization + edits made while the request is in flight.
 const slowDb=mockStore(s1.doc),slow=make(s1.doc);let release,started
 const gate=new Promise(r=>{release=r}),begun=new Promise(r=>{started=r});let first=true,active=0,maxActive=0
 const slowStore={...slowDb.store,async compareAndSwap(doc,previous){active++;maxActive=Math.max(maxActive,active);if(first){first=false;started();await gate}try{return await slowDb.store.compareAndSwap(doc,previous)}finally{active--}}}
 edit(slow,'a',600);let acknowledgedWhileDirty=false
 const saver=writer(slow,slowStore,{onAcknowledged:hash=>{if(JSON.stringify(docToProject(slow))!==hash)acknowledgedWhileDirty=true}})
 const pending=saver.save();await begun;edit(slow,'b',800);const same=saver.save();assert.equal(same,pending);release();await pending
 assert.equal(maxActive,1);assert(acknowledgedWhileDirty);assert.equal(make(slowDb.row.doc).nodes.get('b').x,800)
 console.log('PASS: one save in flight; newer edits stay dirty and drain before manual save resolves')
 // A failed server read must never degrade into an unconditional write.
 let unsafeWrites=0
 await assert.rejects(writer(make(s1.doc),{load:async()=>{throw new Error('offline')},compareAndSwap:async()=>{unsafeWrites++;return null}}).save(),/offline/);assert.equal(unsafeWrites,0)
 console.log('PASS: read failures cannot overwrite unknown server content')
 const originalTimer=globalThis.setTimeout
 try {
  globalThis.setTimeout=(fn,ms,...args)=>originalTimer(fn,ms===15000?1:ms,...args)
  await assert.rejects(writer(make(s1.doc),{load:()=>new Promise(()=>{}),compareAndSwap:async()=>{unsafeWrites++;return null}}).save(),/timed out/)
  assert.equal(unsafeWrites,0)
 } finally {globalThis.setTimeout=originalTimer}
 console.log('PASS: hung requests time out without reporting a successful save')
 // Concurrent delete vs unrelated edit, plus dangling-pipe cleanup and stubs.
 const deletionDb=mockStore(s1.doc),del=make(s1.doc),other=make(s1.doc)
 del.doc.transact(()=>{del.nodes.delete('b');del.edges.delete('ab')},'local');edit(other,'a',911)
 await Promise.all([writer(del,deletionDb.store).save(),writer(other,deletionDb.store).save()]);const after=make(deletionDb.row.doc)
 assert(!after.nodes.has('b'));assert(!after.edges.has('ab'));assert(after.edges.has('stub'));assert.equal(after.nodes.get('a').x,911)
 const legacy=make();legacy.nodes.delete('b');mergeRemoteProject(legacy,seed,seed);assert(!legacy.nodes.has('b'));assert(!legacy.edges.has('ab'));assert(legacy.edges.has('stub'))
 console.log('PASS: deletions survive racing saves and stale legacy snapshots; free stubs remain')
 // Local undo after a peer edit must not revert the peer's change.
 const ua=make(s1.doc),ub=make(s1.doc);edit(ua,'a',123);edit(ub,'b',456);Y.applyUpdate(ua.doc,Y.encodeStateAsUpdate(ub.doc),'remote');ua.undoManager.undo();assert.equal(ua.nodes.get('a').x,100);assert.equal(ua.nodes.get('b').x,456)
 await writer(ua,mockStore(s1.doc).store).save()
 console.log('PASS: canonical-history merge keeps undo local')
 // Portable project copy creates fresh identities and can coexist with original.
 const { _collab,...portable}=db.row.doc;const copy=make(portable);assert.notEqual(persistedProject(copy)._collab.state,db.row.doc._collab.state)
 console.log('PASS: portable JSON copies do not reuse source collaboration history')
} finally {for(const c of docs){c.awareness.destroy();c.doc.destroy()}}
