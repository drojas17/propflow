import { defineConfig,loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Connect } from 'vite'

const root=path.dirname(fileURLToPath(import.meta.url))
const safeProject=(value:string)=>value.toLowerCase().replace(/[^a-z0-9_-]/g,'')
const sessionCookie='propflow_session',stateCookie='propflow_oauth_state'
const authRequired=()=>process.env.PROPFLOW_REQUIRE_AUTH==='true'
const publicMode=()=>process.env.PROPFLOW_MODE==='public'
type SessionUser={sub:string;email:string;name:string;expires:number}
async function readJson(file:string){try{return JSON.parse(await readFile(file,'utf8'))}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}}
function cookieMap(header:string|undefined){return Object.fromEntries((header??'').split(';').map(part=>part.trim().split(/=(.*)/s)).filter(([key,value])=>key&&value!==undefined).map(([key,value])=>[key,decodeURIComponent(value)]))}
function sign(value:string){const secret=process.env.PROPFLOW_SESSION_SECRET;if(!secret)throw new Error('PROPFLOW_SESSION_SECRET is not configured');return createHmac('sha256',secret).update(value).digest('base64url')}
function seal(value:unknown){const body=Buffer.from(JSON.stringify(value)).toString('base64url');return `${body}.${sign(body)}`}
function unseal<T>(value:string|undefined):T|null{if(!value)return null;const [body,signature]=value.split('.');if(!body||!signature)return null;try{const expected=Buffer.from(sign(body)),actual=Buffer.from(signature);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;return JSON.parse(Buffer.from(body,'base64url').toString('utf8')) as T}catch{return null}}
function isSecure(req:Connect.IncomingMessage){return req.headers['x-forwarded-proto']==='https'||(req.socket as {encrypted?:boolean}).encrypted===true}
function setCookie(res:Connect.ServerResponse,name:string,value:string,maxAge:number,secure:boolean){res.setHeader('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`)}
function clearCookie(res:Connect.ServerResponse,name:string,secure:boolean){setCookie(res,name,'',0,secure)}
function currentUser(req:Connect.IncomingMessage){const cookie=cookieMap(req.headers.cookie)[sessionCookie],user=unseal<SessionUser>(cookie);return user&&user.expires>Date.now()?user:null}
function bodyJson(req:Connect.IncomingMessage){return new Promise<unknown>((resolve,reject)=>{const chunks:Buffer[]=[];req.on('data',chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)));req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(new Error('Invalid JSON body'))}});req.on('error',reject)})}
async function resolveShare(token:string){const tokenHash=createHash('sha256').update(token).digest('hex'),entries=await readdir(path.join(root,'projects'),{withFileTypes:true});for(const entry of entries){if(!entry.isDirectory())continue;const metadata=await readJson(path.join(root,'projects',entry.name,'sharing.json')) as {links?:{tokenHash:string;expiresAt:number}[]}|null;if(!metadata?.links?.some(link=>link.tokenHash===tokenHash&&link.expiresAt>Date.now()))continue;const project=await readJson(path.join(root,'projects',entry.name,'project.json'));if(project)return{id:entry.name,project}}return null}
async function writeJson(file:string,value:unknown){
  await mkdir(path.dirname(file),{recursive:true})
  const content=JSON.stringify(value,null,2)
  const previous=await readJson(file)
  if(previous){const backupDir=path.join(path.dirname(file),'backups');await mkdir(backupDir,{recursive:true});await writeFile(path.join(backupDir,`${path.basename(file)}.${Date.now()}.${crypto.randomUUID()}.json`),JSON.stringify(previous,null,2),'utf8')}
  const temp=`${file}.${crypto.randomUUID()}.tmp`
  await writeFile(temp,content,'utf8')
  await rename(temp,file)
}
function diskFileApi(req:Connect.IncomingMessage,res:Connect.ServerResponse,next:Connect.NextFunction){
  void(async()=>{
    const url=new URL(req.url??'/','http://localhost')
    const secure=isSecure(req),oauthClientId=process.env.GOOGLE_CLIENT_ID,oauthClientSecret=process.env.GOOGLE_CLIENT_SECRET,baseUrl=process.env.PROPFLOW_BASE_URL??`${req.headers['x-forwarded-proto']??'http'}://${req.headers.host??'localhost'}`
    if(publicMode()&&url.pathname.startsWith('/api/auth/')){res.setHeader('Content-Type','application/json');if(url.pathname==='/api/auth/me'){res.end(JSON.stringify({user:null}));return}res.statusCode=404;res.end(JSON.stringify({error:'Google sign-in is not enabled in public local-only mode'}));return}
    if(url.pathname==='/api/auth/google'&&req.method==='GET'){
      if(!oauthClientId||!oauthClientSecret){res.statusCode=503;res.end('Google sign-in is not configured');return}
      if(!process.env.PROPFLOW_SESSION_SECRET){res.statusCode=503;res.end('Google sign-in session secret is not configured');return}
      const state=randomBytes(32).toString('base64url'),redirectUri=`${baseUrl.replace(/\/$/,'')}/api/auth/google/callback`
      setCookie(res,stateCookie,seal({state,expires:Date.now()+10*60_000}),600,secure)
      const google=new URL('https://accounts.google.com/o/oauth2/v2/auth');google.searchParams.set('client_id',oauthClientId);google.searchParams.set('redirect_uri',redirectUri);google.searchParams.set('response_type','code');google.searchParams.set('scope','openid email profile');google.searchParams.set('state',state);google.searchParams.set('prompt','select_account')
      res.statusCode=302;res.setHeader('Location',google.toString());res.end();return
    }
    if(url.pathname==='/api/auth/google/callback'&&req.method==='GET'){
      const state=url.searchParams.get('state')??'',stored=unseal<{state:string;expires:number}>(cookieMap(req.headers.cookie)[stateCookie]);clearCookie(res,stateCookie,secure)
      if(url.searchParams.has('error')||!stored||stored.expires<Date.now()||!state||state!==stored.state){res.statusCode=400;res.end('Google sign-in could not be verified. Please try again.');return}
      if(!oauthClientId||!oauthClientSecret){res.statusCode=503;res.end('Google sign-in is not configured');return}
      const redirectUri=`${baseUrl.replace(/\/$/,'')}/api/auth/google/callback`,tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:url.searchParams.get('code')??'',client_id:oauthClientId,client_secret:oauthClientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'})})
      if(!tokenResponse.ok)throw new Error(`Google token exchange failed (${tokenResponse.status})`)
      const tokens=await tokenResponse.json() as {access_token?:string};if(!tokens.access_token)throw new Error('Google did not return an access token')
      const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});if(!profileResponse.ok)throw new Error('Could not verify Google account')
      const profile=await profileResponse.json() as {sub?:string;email?:string;email_verified?:boolean;name?:string};if(!profile.sub||!profile.email||!profile.email_verified){res.statusCode=403;res.end('Use a verified Google account to sign in.');return}
      const allowedDomain=process.env.PROPFLOW_ALLOWED_EMAIL_DOMAIN?.toLowerCase();if(allowedDomain&&!profile.email.toLowerCase().endsWith(`@${allowedDomain}`)){res.statusCode=403;res.end(`Sign-in is limited to ${allowedDomain} accounts.`);return}
      setCookie(res,sessionCookie,seal({sub:profile.sub,email:profile.email,name:profile.name??profile.email,expires:Date.now()+7*24*60*60_000} satisfies SessionUser),7*24*60*60,secure)
      res.statusCode=302;res.setHeader('Location',`${baseUrl.replace(/\/$/,'')}/`);res.end();return
    }
    if(url.pathname==='/api/auth/me'&&req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({user:currentUser(req)}));return}
    if(url.pathname==='/api/auth/logout'&&req.method==='POST'){clearCookie(res,sessionCookie,secure);res.statusCode=204;res.end();return}
    const shareMatch=url.pathname.match(/^\/api\/project\/([^/]+)\/share$/)
    if(shareMatch&&req.method==='POST'){
      if(publicMode()){res.statusCode=404;res.end(JSON.stringify({error:'Sharing is only available to MIT project accounts'}));return}
      const user=currentUser(req);if(!user){res.statusCode=401;res.end(JSON.stringify({error:'Sign in with Google to create a share link'}));return}
      const id=safeProject(decodeURIComponent(shareMatch[1]));if(!id){res.statusCode=404;res.end();return}
      const projectFile=path.join(root,'projects',id,'project.json');if(!await readJson(projectFile)){res.statusCode=404;res.end(JSON.stringify({error:'Project not found'}));return}
      const metadataFile=path.join(root,'projects',id,'sharing.json'),metadata=await readJson(metadataFile) as {ownerSub?:string;links?:{tokenHash:string;createdAt:number;expiresAt:number}[]}|null
      if(metadata?.ownerSub&&metadata.ownerSub!==user.sub){res.statusCode=403;res.end(JSON.stringify({error:'Only the project owner can create share links'}));return}
      const token=randomBytes(32).toString('base64url'),createdAt=Date.now(),expiresAt=createdAt+30*24*60*60_000,links=(metadata?.links??[]).filter(link=>link.expiresAt>createdAt)
      links.push({tokenHash:createHash('sha256').update(token).digest('hex'),createdAt,expiresAt})
      await writeJson(metadataFile,{ownerSub:metadata?.ownerSub??user.sub,ownerEmail:user.email,links})
      res.setHeader('Content-Type','application/json');res.statusCode=201;res.end(JSON.stringify({url:`${baseUrl.replace(/\/$/,'')}/?share=${token}`,expiresAt}));return
    }
    const sharedMatch=url.pathname.match(/^\/api\/shared\/([A-Za-z0-9_-]+)$/)
    if(sharedMatch&&req.method==='GET'){
      if(publicMode()){res.statusCode=404;res.end(JSON.stringify({error:'Sharing is only available to MIT project accounts'}));return}
      if(authRequired()&&!currentUser(req)){res.statusCode=401;res.end(JSON.stringify({error:'Sign in with an MIT account to open this project'}));return}
      const found=await resolveShare(sharedMatch[1])
      res.setHeader('Content-Type','application/json');if(!found){res.statusCode=404;res.end(JSON.stringify({error:'Share link is invalid or expired'}));return}res.end(JSON.stringify(found));return
    }
    if(url.pathname==='/api/projects'&&req.method==='POST'){
      if(publicMode()){res.statusCode=403;res.end(JSON.stringify({error:'Public projects are downloaded as JSON files'}));return}
      if(authRequired()&&!currentUser(req)){res.statusCode=401;res.end(JSON.stringify({error:'Sign in with Google first'}));return}
      const chunks:Buffer[]=[]
      req.on('data',chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)))
      req.on('end',()=>void(async()=>{
        try{
          const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as {id?:string}
          const id=safeProject(body.id??'')
          if(!id){res.statusCode=400;res.end(JSON.stringify({error:'Project name must include letters or numbers'}));return}
          const projectsDir=path.join(root,'projects'),entries=await readdir(projectsDir,{withFileTypes:true})
          if(entries.some(entry=>entry.isDirectory()&&entry.name.toLowerCase()===id)){
            res.statusCode=409;res.end(JSON.stringify({error:'A project with that name already exists'}));return
          }
          await writeJson(path.join(projectsDir,id,'project.json'),{nodes:[],edges:[],shapes:[],canvasSize:{w:850,h:580}})
          const user=currentUser(req);if(authRequired()&&user)await writeJson(path.join(projectsDir,id,'sharing.json'),{ownerSub:user.sub,ownerEmail:user.email,links:[]})
          res.statusCode=201;res.end(JSON.stringify({id}))
        }catch(error){
          console.error('[diskFileApi] project creation error:',error)
          res.statusCode=400;res.end(JSON.stringify({error:'Failed to create project'}))
        }
      })())
      return
    }
    if(url.pathname==='/api/projects'&&req.method==='GET'){
      if(publicMode()){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end('[]');return}
      if(authRequired()&&!currentUser(req)){res.statusCode=401;res.end(JSON.stringify({error:'Sign in with Google first'}));return}
      try{
        const entries=await readdir(path.join(root,'projects'),{withFileTypes:true})
        res.setHeader('Content-Type','application/json')
        res.setHeader('Cache-Control','no-store')
        res.end(JSON.stringify(entries.filter(e=>e.isDirectory()).map(e=>e.name)))
      }catch{
        res.setHeader('Content-Type','application/json')
        res.end(JSON.stringify(['osiris','polaris','helios']))
      }
      return
    }
    let file:string|undefined
    if(url.pathname==='/api/library')file=path.join(root,'library','symbols.json')
    else if(url.pathname.startsWith('/api/project/')){
      const rawId=decodeURIComponent(url.pathname.slice('/api/project/'.length))
      if(rawId.startsWith('share-')){
        if(publicMode()){res.statusCode=404;res.end(JSON.stringify({error:'Shared projects are available only in MIT project mode'}));return}
        if(authRequired()&&!currentUser(req)){res.statusCode=401;res.end(JSON.stringify({error:'Sign in with an MIT account to open this project'}));return}
        const token=rawId.slice(6),found=/^[A-Za-z0-9_-]{40,}$/.test(token)?await resolveShare(token):null;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
        if(req.method==='GET'){if(!found){res.statusCode=404;res.end(JSON.stringify({error:'Share link is invalid or expired'}));return}res.end(JSON.stringify(found.project));return}
        res.statusCode=403;res.end(JSON.stringify({error:'Shared projects are read-only'}));return
      }
      const id=safeProject(rawId)
      if(id)file=path.join(root,'projects',id,'project.json')
    }
    if(!file){next();return}
    if(publicMode()){
      res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store')
      if(req.method==='GET'){res.end(url.pathname==='/api/library'?'null':JSON.stringify({nodes:[],edges:[],shapes:[],canvasSize:{w:850,h:580}}));return}
      res.statusCode=403;res.end(JSON.stringify({error:'Public mode never saves projects to the server'}));return
    }
    const user=currentUser(req)
    if(authRequired()&&!user){res.statusCode=401;res.end(JSON.stringify({error:'Sign in with Google first'}));return}
    if(authRequired()&&file.includes(`${path.sep}projects${path.sep}`)&&req.method==='PUT'&&user){
      const metadataFile=path.join(path.dirname(file),'sharing.json'),metadata=await readJson(metadataFile) as {ownerSub?:string;ownerEmail?:string;links?:unknown[]}|null
      if(metadata?.ownerSub&&metadata.ownerSub!==user.sub){res.statusCode=403;res.end(JSON.stringify({error:'Only the project owner can edit this project'}));return}
      if(!metadata?.ownerSub)await writeJson(metadataFile,{ownerSub:user.sub,ownerEmail:user.email,links:metadata?.links??[]})
    }
    res.setHeader('Content-Type','application/json')
    res.setHeader('Cache-Control','no-store')
    if(req.method==='GET'){res.end(JSON.stringify(await readJson(file)));return}
    if(req.method==='PUT'){
      const chunks:Buffer[]=[]
      req.on('data',chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk)))
      req.on('end',()=>void(async()=>{
        try{
          const body=Buffer.concat(chunks).toString('utf8')
          await writeJson(file,JSON.parse(body))
          res.statusCode=204
          res.end()
        }catch(err){
          console.error('[diskFileApi] write error:',err)
          res.statusCode=400
          res.end(JSON.stringify({error:'Failed to write file'}))
        }
      })())
      return
    }
    res.statusCode=405;res.end(JSON.stringify({error:'Method not allowed'}))
  })().catch(error=>{res.statusCode=500;res.end(JSON.stringify({error:String(error)}))})
}
const filesPlugin={name:'propflow-local-files',configureServer(server:{middlewares:{use:(handler:typeof diskFileApi)=>void}}){server.middlewares.use(diskFileApi)},configurePreviewServer(server:{middlewares:{use:(handler:typeof diskFileApi)=>void}}){server.middlewares.use(diskFileApi)}}

export default defineConfig(({mode})=>{Object.assign(process.env,loadEnv(mode,root,''));return{plugins:[react(),filesPlugin]}})
