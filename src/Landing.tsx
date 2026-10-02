import type { User } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, CircleGauge, FolderOpen, GitBranch, GraduationCap, Plus, Table2, Waypoints } from 'lucide-react'

export default function Landing({user,signIn,signOut,projects,onOpenProject,onNewProject,onTutorial}:{
  user:User|null;signIn:()=>void;signOut:()=>void;projects:string[];
  onOpenProject:(id:string)=>void;onNewProject:()=>void;onTutorial:()=>void;
}){
  return <div className="landing">
    <header className="landing-top">
      <div className="landing-brand"><span className="landing-mark"><Waypoints size={20}/></span><b>PropFlow</b><span>Flow Systems Studio</span></div>
      <div>{user
        ? <span className="landing-user">{user.email?.split('@')[0]}<button className="ghost" onClick={signOut}>Sign out</button></span>
        : <button className="ghost" onClick={signIn}>Sign in with MIT</button>}</div>
    </header>
    <main className="landing-hero">
      <div className="landing-kicker">MIT Rocket Team</div>
      <h1>Welcome to PropFlow</h1>
      <p className="landing-lede">MIT Rocket Team&apos;s publicly accessible hub for making P&amp;IDs, visualizing and calculating fluid flow, and authoring SOPs.</p>
      <div className="landing-pillars">
        <div className="pillar"><GitBranch size={22}/><b>Draw P&amp;IDs</b><span>Schematic capture with a real component library, smart connections, and auto-numbered tags.</span></div>
        <div className="pillar"><CircleGauge size={22}/><b>Visualize &amp; calculate flow</b><span>Run the simulation to see pressures across the system and catch design issues early.</span></div>
        <div className="pillar"><Table2 size={22}/><b>Author SOPs</b><span>Write step-by-step operating procedures with valve states validated against your diagram.</span></div>
      </div>
      <div className="landing-cta">
        <button className="primary" onClick={onTutorial}><BookOpen size={16}/> Take the tour</button>
        <span className="landing-or">or jump straight into a project</span>
      </div>
      <section className="landing-projects">
        <div className="landing-projects-head"><h2><FolderOpen size={17}/> Projects</h2><button className="ghost" onClick={onNewProject}><Plus size={15}/> New project</button></div>
        {projects.length===0&&<p className="landing-empty">No projects yet &mdash; create your first one.</p>}
        <div className="landing-grid">{projects.map(id=><button key={id} className="project-card" onClick={()=>onOpenProject(id)}><b>{id.toUpperCase()}</b><span>Open <ArrowRight size={14}/></span></button>)}</div>
      </section>
      <p className="landing-foot"><GraduationCap size={14}/> New here? The in-editor <b>Training lab</b> walks you through four hands-on lessons once you&apos;re inside.</p>
    </main>
  </div>
}
