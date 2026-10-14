import {useEffect,useRef,useState} from 'react'

export default function ComponentFinder({nodes,onPick}:{nodes:{id:string;tag:string;kind:string;symbolType?:string;fluid?:string;name?:string}[];onPick:(id:string)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[index,setIndex]=useState(0);const input=useRef<HTMLInputElement>(null);
 const matches=nodes.filter(n=>n.kind!=='junction'&&`${n.tag} ${n.kind} ${n.symbolType??''} ${n.fluid??''} ${n.name??''}`.toLowerCase().includes(query.trim().toLowerCase()));
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&['f','k'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();setOpen(true);requestAnimationFrame(()=>input.current?.select())}else if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',key,{capture:true});return()=>window.removeEventListener('keydown',key,{capture:true})},[]);
 const pick=(id:string)=>{onPick(id);setOpen(false)};
 return <><button className="ghost" onClick={()=>setOpen(true)} title="Find a component on the diagram (Ctrl/Cmd+F)">Find component <kbd>Ctrl F</kbd></button>{open&&<div className="feedback-shade" onClick={()=>setOpen(false)}><section className="feedback component-finder" role="dialog" aria-modal="true" aria-label="Find component" onClick={e=>e.stopPropagation()}>
  <div className="finder-heading"><h2>Find component</h2><button onClick={()=>setOpen(false)} aria-label="Close component search">×</button></div>
  <input ref={input} autoFocus aria-label="Search diagram components" placeholder="Tag, component type, or fluid…" value={query} onChange={e=>{setQuery(e.target.value);setIndex(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setIndex(i=>Math.min(matches.length-1,i+1))}else if(e.key==='ArrowUp'){e.preventDefault();setIndex(i=>Math.max(0,i-1))}else if(e.key==='Enter'&&matches[Math.max(0,Math.min(index,matches.length-1))])pick(matches[Math.max(0,Math.min(index,matches.length-1))].id)}}/>
  <p>{matches.length} matching components in this test configuration</p><div className="finder-results">{matches.map((n,i)=><button className={i===index?'active':''} key={n.id} onClick={()=>pick(n.id)}><b>{n.tag||'Untagged component'}</b><span>{n.name??n.symbolType??n.kind} · {n.fluid??''}</span></button>)}{!matches.length&&<p>No matching components.</p>}</div>
 </section></div>}</>
}
