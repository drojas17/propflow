import assert from 'node:assert/strict'
import {registerHooks,stripTypeScriptTypes} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
const calls=[]
globalThis.shareTest={calls,projectId:'shared-project',error:null}
registerHooks({
 resolve(s,c,next){if(s==='@supabase/supabase-js')return{url:'test:supabase',shortCircuit:true};if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(u))return next(u.href,c)}return next(s,c)},
 load(u,c,next){if(u==='test:supabase')return{format:'module',shortCircuit:true,source:`export function createClient(url,key,options){const t=globalThis.shareTest;t.calls.push({url,key,options});return{async rpc(name,args){if(!options?.auth||options.auth.persistSession!==false)throw new Error('Authenticated session cannot call the anonymous-only resolver');t.calls.push({rpc:name,args});return{data:t.projectId?[{project_id:t.projectId}]:[],error:t.error}}}}`};if(u.endsWith('.ts')){let source=stripTypeScriptTypes(readFileSync(new URL(u),'utf8'));if(u.endsWith('/supabase.ts'))source=source.replaceAll('import.meta.env','({VITE_SUPABASE_URL:"https://example.supabase.co",VITE_SUPABASE_ANON_KEY:"test-anon"})');return{format:'module',source,shortCircuit:true}}return next(u,c)}
})
const {requireSupabase,requireShareResolver}=await import('../src/lib/supabase.ts')
const {resolveShareToken}=await import('../src/lib/db.ts')
const signedIn=requireSupabase(),token='a'.repeat(43)
assert.deepEqual(await resolveShareToken(token),{projectId:'shared-project'})
assert.notEqual(requireShareResolver(),signedIn)
assert.equal(calls[1].options.auth.persistSession,false);assert.equal(calls[1].options.auth.autoRefreshToken,false);assert.equal(calls[1].options.auth.detectSessionInUrl,false)
assert.equal(calls[2].rpc,'resolve_share_token');assert.equal(calls[2].args.p_hash.length,64)
const before=calls.length;assert.equal(await resolveShareToken('invalid'),null);assert.equal(calls.length,before)
globalThis.shareTest.projectId=null;assert.equal(await resolveShareToken(token),null)
globalThis.shareTest.error=new Error('resolver unavailable');await assert.rejects(resolveShareToken(token),/resolver unavailable/)
console.log('Share-link checks passed: signed-in callers use isolated anonymous resolution; token hashing/validation, expired links and errors preserved.')
