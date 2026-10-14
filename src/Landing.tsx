import { useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, CircleGauge, Download, FolderOpen, GitBranch, Plus, Rocket, Table2, Upload, Waypoints } from 'lucide-react'
import rocketLogo from './assets/rocket-team-logo.png'

export default function Landing({user,signIn,signOut,projects,names,onRenameProject,onOpenProject,onNewProject,onTour,onImportJSON,onDownloadProject}:{
  user:User|null;signIn:()=>void;signOut:()=>void;projects:string[];
  onOpenProject:(id:string)=>void;onNewProject:()=>void;onTour:()=>void;
  onImportJSON:(file:File)=>void;onDownloadProject:(id:string)=>void;
  names:Record<string,string>;onRenameProject:(id:string,name:string)=>Promise<void>;
}){
  const fileRef=useRef<HTMLInputElement>(null)
  const [renameId,setRenameId]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="landing">
    <div className="landing-top">
      <div className="landing-brand"><span className="landing-mark"><Waypoints size={20}/></span><b>PropFlow</b><span>Flow Systems Studio</span></div>
      <div>{user
        ? <span className="landing-user">{user.email?.split('@')[0]}<button className="ghost" onClick={signOut}>Sign out</button></span>
        : <button className="ghost" onClick={signIn}>Sign in with MIT</button>}</div>
    </div>
    <div className="landing-hero">
      <div className="landing-intro">
        <img className="landing-logo" src={rocketLogo} alt="MIT Rocket Team"/>
        <div className="landing-intro-text">
          <h1>Welcome to PropFlow</h1>
          <p className="landing-lede">MIT Rocket Team&apos;s publicly accessible hub for making P&amp;IDs, visualizing and calculating fluid flow, and authoring SOPs.</p>
        </div>
      </div>
      <div className="landing-pillars">
        <div className="pillar"><GitBranch size={26}/><b>Draw P&amp;IDs</b><span>Schematic capture with a real component library, smart connections, and auto-numbered tags.</span></div>
        <div className="pillar"><CircleGauge size={26}/><b>Visualize &amp; calculate flow</b><span>Run the simulation to see pressures across the system and catch design issues early.</span></div>
        <div className="pillar"><Table2 size={26}/><b>Author SOPs</b><span>Write step-by-step operating procedures with valve states validated against your diagram.</span></div>
      </div>
      <div className="landing-cta">
        <button className="primary" onClick={onTour}><Rocket size={16}/> First time? Take a tour</button>
        <span className="landing-or">or jump straight into a project</span>
      </div>
      <div className="landing-projects">
        <div className="landing-projects-head"><h2><FolderOpen size={17}/> Projects</h2><span><button className="ghost" onClick={()=>fileRef.current?.click()}><Upload size={15}/> Import JSON</button><button className="ghost" onClick={onNewProject}><Plus size={15}/> New project</button></span></div>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)onImportJSON(f)}}/>
        {projects.length===0&&<p className="landing-empty">No projects yet &mdash; create your first one.</p>}
        <div className="landing-grid">{projects.map(id=><div key={id} className="project-card"><button className="project-open" onClick={()=>onOpenProject(id)}><b>{names[id]||id.toUpperCase()}</b><span>Open <ArrowRight size={14}/></span></button><button className="project-download" onClick={()=>onDownloadProject(id)} title={`Download ${id} as a JSON file`} aria-label={`Download ${id} JSON`}><Download size={15}/></button><button className="project-rename" onClick={()=>{setRenameId(id);setName(names[id]||id.toUpperCase());setError('')}} aria-label={`Rename ${names[id]||id}`}>Rename</button></div>)}</div>
      </div>
    </div>
    {renameId&&<div className="feedback-shade"><form className="feedback context-form" onSubmit={e=>{e.preventDefault();if(!name.trim()||busy)return;setBusy(true);void onRenameProject(renameId,name.trim()).then(()=>setRenameId('')).catch(e=>setError(e instanceof Error?e.message:'Could not rename project.')).finally(()=>setBusy(false))}}><h2>Rename project</h2><label>Name<input autoFocus required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<div className="context-form-actions"><button type="button" disabled={busy} onClick={()=>setRenameId('')}>Cancel</button><button disabled={busy||!name.trim()}>{busy?'Saving…':'Save'}</button></div></form></div>}
  </div>
}
