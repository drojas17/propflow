import {useRef,useState} from 'react'
export default function SidebarResizers({sop=false}:{sop?:boolean}){
 const [widths,setWidths]=useState(()=>{
  try{
    const left=parseInt(localStorage.getItem('propflow-sidebar-left')||'250',10);
    return {left:isNaN(left)?250:left,right:300};
  }catch{return {left:250,right:300}}
}),drag=useRef<{x:number;width:number;side:'left'|'right'}|null>(null);
 return <>{(['left','right'] as const).filter(side=>!sop||side==='right').map(side=><div key={side} className="app-sidebar-resizer" role="separator" aria-label={`Resize ${side} sidebar`} aria-orientation="vertical" tabIndex={0} style={{[side]:`calc(var(--panel-${side}, ${widths[side]}px) - 4px)`}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();const app=e.currentTarget.closest('.app') as HTMLElement;const width=parseFloat(app.style.getPropertyValue(`--panel-${side}`))||widths[side];drag.current={x:e.clientX,width,side};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const width=Math.max(220,Math.min(600,drag.current.width+(e.clientX-drag.current.x)*(side==='left'?1:-1)));(e.currentTarget.closest('.app') as HTMLElement).style.setProperty(`--panel-${side}`,`${width}px`);setWidths(w=>({...w,[side]:width}));if(side==='left'){try{localStorage.setItem('propflow-sidebar-left',String(width))}catch{}}}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const width=Math.max(220,Math.min(600,widths[side]+(e.key==='ArrowRight'?20:-20)*(side==='left'?1:-1)));(e.currentTarget.closest('.app') as HTMLElement).style.setProperty(`--panel-${side}`,`${width}px`);setWidths(w=>({...w,[side]:width}))}}/>)}</>
}
