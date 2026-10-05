import { useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, CircleGauge, Download, FolderOpen, GitBranch, Plus, Rocket, Table2, Upload, Waypoints } from 'lucide-react'
import rocketLogo from './assets/rocket-team-logo.png'

export default function Landing({user,signIn,signOut,projects,onOpenProject,onNewProject,onTour,onImportJSON,onDownloadProject}:{
  user:User|null;signIn:()=>void;signOut:()=>void;projects:string[];
  onOpenProject:(id:string)=>void;onNewProject:()=>void;onTour:()=>void;
  onImportJSON:(file:File)=>void;onDownloadProject:(id:string)=>void;
}){
  const fileRef=useRef<HTMLInputElement>(null)
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
        <div className="landing-grid">{projects.map(id=><div key={id} className="project-card"><button className="project-open" onClick={()=>onOpenProject(id)}><b>{id.toUpperCase()}</b><span>Open <ArrowRight size={14}/></span></button><button className="project-download" onClick={()=>onDownloadProject(id)} title={`Download ${id} as a JSON file`} aria-label={`Download ${id} JSON`}><Download size={15}/></button></div>)}</div>
      </div>
    </div>
  </div>
}
