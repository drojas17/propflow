import { ArrowLeft, Cable, CircleGauge, ClipboardList, GraduationCap, Layers, MousePointer2, Package, Rocket, Share2, Tag, Users } from 'lucide-react'

const sections:{icon:React.ReactNode;title:string;body:string;where:string}[]=[
 {icon:<Tag size={20}/>,title:'Tags that number themselves',body:'Drop a valve and it becomes MV-1; the next one is MV-2, automatically. Numbered continuation flags pair themselves too. Double-click any label to rename it.',where:'Component library  •  double-click a label'},
 {icon:<Cable size={20}/>,title:'Connections that snap into place',body:'The connect and branch tools figure out which port you meant from the geometry, and snap guides keep your runs tidy while you draw.',where:'Drawing toolbar  •  connect / branch tools'},
 {icon:<MousePointer2 size={20}/>,title:'Labels go where you want',body:'Drag any tag label to reposition it. For pixel-perfect placement, nudge it with Label X / Label Y in the Inspector (Tab to commit).',where:'Canvas  •  Inspector'},
 {icon:<Users size={20}/>,title:'Work together, live',body:'See teammates’ cursors and selections in their colors, spot who’s online in the header, and never think about saving — every change autosaves, and undo / redo just works.',where:'Header  •  automatic'},
 {icon:<Layers size={20}/>,title:'Two views of the same system',body:'Schematic is the logic. Flip to Assembly for the physical build — select a line there to spec its tube and flex-hose runs.',where:'Diagram toolbar  •  Schematic / Assembly toggle'},
 {icon:<CircleGauge size={20}/>,title:'Run the simulation',body:'Hit Run simulation to walk the pressure ladder: per-step pressures across the system, with findings that flag isolation problems, dead ends, and over-pressure risks.',where:'Header  •  Run simulation'},
 {icon:<ClipboardList size={20}/>,title:'Author SOPs that check themselves',body:'The SOP workspace turns your diagram into step-by-step procedures with valve states per step — validated against the diagram as you write.',where:'Diagram toolbar  •  SOP states'},
 {icon:<Package size={20}/>,title:'Real parts, real BOM',body:'Link inventory parts to symbols from the Inspector and generate a bill of materials when the design firms up. Need something the library doesn’t have? Draw it in the symbol workshop.',where:'Inspector  •  Inventory / BOM  •  Symbol workshop'},
 {icon:<Share2 size={20}/>,title:'Share safely',body:'The Share button mints an expiring read-only link — perfect for design reviews with people outside the team.',where:'Header  •  Share'},
 {icon:<GraduationCap size={20}/>,title:'Training lab',body:'Four guided, hands-on lessons live in the editor header. They watch the canvas and check your work as you go.',where:'Header  •  Training lab'},
]

export default function Tutorial({onBack,onOpenEditor}:{onBack:()=>void;onOpenEditor:()=>void}){
  return <div className="landing tutorial">
    <header className="landing-top">
      <button className="ghost" onClick={onBack}><ArrowLeft size={15}/> Home</button>
      <button className="primary" onClick={onOpenEditor}><Rocket size={15}/> Open the app</button>
    </header>
    <main className="landing-hero">
      <div className="landing-kicker">PropFlow tutorial</div>
      <h1>Small touches, big time savings</h1>
      <p className="landing-lede">PropFlow does a lot of the tedious work for you. Here are the quality-of-life features people miss on their first visit &mdash; and where to find them.</p>
      <div className="tutorial-grid">{sections.map(s=><article key={s.title} className="tutorial-card"><span className="tutorial-icon">{s.icon}</span><div><b>{s.title}</b><p>{s.body}</p><small>{s.where}</small></div></article>)}</div>
      <div className="landing-cta"><button className="primary" onClick={onOpenEditor}><Rocket size={16}/> Open the app and try them</button></div>
    </main>
  </div>
}
