import nitrogen from './nitrogenProperties.json'
import type {SopNode} from './sopModel'

export const PSI=6894.757293168, ATM=101325, R_N2=296.803, GAMMA=1.4
export type Material='stainless'|'copper'
export const roughnessMm:Record<Material,number>={stainless:.015,copper:.0015}
export const tubeSizes=[{label:'3/8 in OD · 0.305 in ID',id:.305},{label:'1/2 in OD · 0.430 in ID',id:.430},{label:'3/4 in OD · 0.652 in ID',id:.652}]
export type LineSpec={lengthM?:number;idIn?:number;material?:Material;roughnessMm?:number}
export type HydraulicNode=SopNode&{cv?:number;volume?:number}
export type HydraulicEdge={id:string;from?:string;to?:string;fromPort?:string;toPort?:string;hydraulics?:LineSpec}
export type HydraulicPath={nodes:string[];edges:HydraulicEdge[]}
export type PathSearch={paths:HydraulicPath[];truncated:boolean}

/** Port names are local to the symbol. App supplies inferred local ports for legacy edges. */
export function findPaths(nodes:HydraulicNode[],edges:HydraulicEdge[],source:string,destination:string):PathSearch{
 const byId=new Map(nodes.map(n=>[n.id,n])),adj=new Map<string,{edge:HydraulicEdge;other:string;out?:string;input?:string}[]>()
 const add=(a:string,b:string,e:HydraulicEdge,out?:string,input?:string)=>adj.set(a,[...(adj.get(a)??[]),{edge:e,other:b,out,input}])
 for(const e of edges){if(!e.from||!e.to||!byId.has(e.from)||!byId.has(e.to)||[e.fromPort,e.toPort].some(p=>p==='actuator'))continue;add(e.from,e.to,e,e.fromPort,e.toPort);add(e.to,e.from,e,e.toPort,e.fromPort)}
 const continuations=new Map<string,HydraulicNode[]>()
 for(const n of nodes)if(n.symbolType==='continuation')continuations.set(n.tag,[...(continuations.get(n.tag)??[]),n])
 for(const group of continuations.values())if(group.length===2){const[a,b]=group,e={id:`continuation:${a.id}:${b.id}`,from:a.id,to:b.id,hydraulics:{lengthM:0}};add(a.id,b.id,e);add(b.id,a.id,e)}
 const paths:HydraulicPath[]=[],seen=new Set<string>();let budget=20000,truncated=false
 const visit=(id:string,ids:string[],es:HydraulicEdge[],input?:string)=>{
  if(--budget<0||paths.length>=16||ids.length>=512){truncated=true;return}
  const n=byId.get(id);if(!n||seen.has(id))return
  if(ids.length&&n.kind==='tank'&&id!==destination)return // No implicit gas/liquid tank transfer.
  if(ids.length&&n.fluidLocked&&n.fluid&&n.fluid!==byId.get(source)?.fluid)return
  if(n.kind==='electrical')return
  const directional=n.symbolType==='check-valve',regulator=n.kind==='regulator'
  if(directional&&ids.length&&input!=='left')return
  // Existing regulators have source-derived process direction, including drawings wired right-to-left.
  // Their top/bottom ports are excluded so a dome/control supply cannot become a process route.
  if(regulator&&ids.length&&input!=='left'&&input!=='right')return
  const next=[...ids,id]
  if(id===destination){paths.push({nodes:next,edges:es});return}
  if(ids.length&&(n.boundary==='ambient'||n.ventsToAmbient))return
  seen.add(id)
  for(const link of adj.get(id)??[]){if(directional&&link.out!=='right')continue;if(link.out==='actuator'||regulator&&(link.out!=='left'&&link.out!=='right'||link.out===input))continue;visit(link.other,next,[...es,link.edge],link.input);if(budget<0||paths.length>=16)break}
  seen.delete(id)
 }
 if(source!==destination)visit(source,[],[])
 return{paths,truncated}
}

export function frictionFactor(re:number,rr:number):number{
 if(!(re>0)||!Number.isFinite(re)||rr<0||!Number.isFinite(rr))throw Error('Invalid Reynolds number or roughness.')
 if(re<2300)return 64/re
 const turbulent=(r:number)=>{let low=.005,high=.2;for(let i=0;i<80;i++){const f=(low+high)/2,residual=1/Math.sqrt(f)+2*Math.log10(rr/3.7+2.51/(r*Math.sqrt(f)));if(residual>0)low=f;else high=f}return(low+high)/2}
 if(re>=4000)return turbulent(re)
 const t=(re-2300)/1700;return(1-t)*64/2300+t*turbulent(4000)
}
export function nitrogenProperties(t:number,p:number){
 const ts=nitrogen.temperatures,ps=nitrogen.pressures
 if(!Number.isFinite(t)||!Number.isFinite(p)||t<ts[0]||t>ts.at(-1)!||p<ps[0]||p>ps.at(-1)!)throw Error('Nitrogen properties require 200–500 K and 0–5786.8 psig (400 bar absolute).')
 const bracket=(xs:number[],v:number)=>{let i=0;while(i<xs.length-2&&xs[i+1]<v)i++;return i}
 const i=bracket(ts,t),j=bracket(ps,p),a=(t-ts[i])/(ts[i+1]-ts[i]),b=(p-ps[j])/(ps[j+1]-ps[j])
 const props=[0,1,2].map(k=>(1-a)*((1-b)*nitrogen.rows[i][j][k]+b*nitrogen.rows[i][j+1][k])+a*((1-b)*nitrogen.rows[i+1][j][k]+b*nitrogen.rows[i+1][j+1][k]))
 return{density:props[0],viscosity:props[1],sound:props[2]}
}
export type CaseInputs={flow:number;temperatureK:number;lengthM:number;idIn:number;material:Material;roughnessMm:number;useDiagram:boolean;fluid:'nitrogen'|'liquid';density:number;viscosity:number;sourcePsig:number}
export type LadderRow={id:string;label:string;pressure:number|null;drop:number|null;model:string;re?:number;factor?:number;mach?:number}
export type LadderResult={rows:LadderRow[];warnings:string[];outlet:number|null;loss:number;valid:boolean}
export function solvePath(path:HydraulicPath,nodes:HydraulicNode[],c:CaseInputs):LadderResult{
 const rows:LadderRow[]=[],warnings:string[]=[],byId=new Map(nodes.map(n=>[n.id,n])),positive=(v:number)=>Number.isFinite(v)&&v>0
 let p=c.sourcePsig*PSI+ATM,loss=0,valid=true,blocked=false,gasReference=p,gasFriction=0
 const result=():LadderResult=>({rows,warnings:[...new Set(warnings)],outlet:blocked||!valid?null:(p-ATM)/PSI,loss,valid:valid&&!blocked})
 if(!positive(c.temperatureK)||!positive(c.idIn)||!Number.isFinite(c.lengthM)||c.lengthM<0||!Number.isFinite(c.roughnessMm)||c.roughnessMm<0||!Number.isFinite(c.flow)||c.flow<0||!Number.isFinite(p)||p<ATM){warnings.push('Enter finite, nonnegative gauge pressure, flow, length and roughness, and positive temperature and ID.');valid=false;return result()}
 if(c.fluid==='liquid'&&(!positive(c.density)||!positive(c.viscosity))){warnings.push('Enter single-phase liquid density (kg/m³) and dynamic viscosity (Pa·s).');valid=false;return result()}
 const props=()=>c.fluid==='nitrogen'?nitrogenProperties(c.temperatureK,p):{density:c.density,viscosity:c.viscosity,sound:Infinity}
 const push=(id:string,label:string,model:string,drop:number|null=0,extra:Partial<LadderRow>={})=>rows.push({id,label,model,pressure:blocked||!valid?null:(p-ATM)/PSI,drop,...extra})
 const takeLoss=(dp:number,label:string)=>{if(dp===0)return;if(!Number.isFinite(dp)||dp<0||dp>=p-ATM){warnings.push(`${label}: demand exceeds available gauge pressure; downstream result unavailable.`);valid=false;return}if(c.fluid==='nitrogen'&&(gasFriction+dp)/gasReference>=.1){warnings.push(`${label}: cumulative friction ΔP ≥ 10% of absolute inlet pressure since source/regulator; compressible-flow model required.`);valid=false;return}p-=dp;gasFriction+=dp;loss+=dp/PSI}
 for(let i=0;i<path.nodes.length;i++){
  const n=byId.get(path.nodes[i]);if(!n){valid=false;warnings.push('Path refers to a missing component.');break}
  if(i){const edge=path.edges[i-1],virtual=edge.id.startsWith('continuation:'),line=c.useDiagram?edge.hydraulics:undefined
   // An entered total route length is distributed evenly only for segments missing physical length.
   const missing=path.edges.filter(e=>!e.id.startsWith('continuation:')&&(!c.useDiagram||e.hydraulics?.lengthM===undefined)).length
   const length=virtual?0:line?.lengthM??c.lengthM/Math.max(1,missing),id=(line?.idIn??c.idIn)*.0254,rough=(line?.roughnessMm??(line?.material?roughnessMm[line.material]:c.roughnessMm))/1000
   let re=0,f=0,mach=0,dp=0
   try{if(!Number.isFinite(length)||length<0||!positive(id)||!Number.isFinite(rough)||rough<0)throw Error('Invalid physical line length, ID or roughness.');if(!blocked&&valid&&c.flow>0){const q=props(),area=Math.PI*id*id/4,v=c.flow/(q.density*area);re=q.density*v*id/q.viscosity;f=frictionFactor(re,rough/id);mach=v/q.sound;dp=f*length/id*q.density*v*v/2;if(mach>=.3){warnings.push('Mach ≥ 0.3: compressible-flow model required.');valid=false}if(re>=2300&&re<4000)warnings.push('Transitional friction factor is approximate.');if(valid)takeLoss(dp,`Line ${i}`)}}catch(e){warnings.push(String((e as Error).message));valid=false}
   push(edge.id,virtual?'Numbered continuation':`Line ${i} · ${length.toFixed(3)} m · ${(id/.0254).toFixed(3)} in ID`,virtual?'Virtual connection':'Darcy–Weisbach',valid&&!blocked?dp/PSI:null,{re,factor:f,mach})
  }
  if(blocked||!valid){push(n.id,n.tag||n.kind,blocked?'Isolated · trapped pressure unknown':'Unavailable',null);continue}
  if(n.kind==='valve'&&n.state!=='open'){push(n.id,n.tag,'Closed · upstream pressure');blocked=true;warnings.push(`${n.tag} is closed; pressure beyond it may be trapped, not zero.`);continue}
  if(i<path.nodes.length-1&&(n.boundary==='ambient'||n.ventsToAmbient)){blocked=true;warnings.push(`${n.tag} vents before the destination.`);push(n.id,n.tag,'Open vent · no steady demand solution',null);continue}
  if(n.kind==='regulator'){
   push(`${n.id}:in`,`${n.tag} inlet`,'Regulator inlet')
   const setting=n.pressure
   if(setting===undefined||!Number.isFinite(setting)||setting<=0){blocked=true;warnings.push(`${n.tag}: enter a positive nominal regulator setpoint.`);push(n.id,`${n.tag} outlet`,'Unset / closed regulator',null);continue}
   const target=setting*PSI+ATM
   if(target>p){valid=false;warnings.push(`${n.tag}: nominal outlet exceeds available inlet pressure.`)}else{p=target;gasReference=p;gasFriction=0}
   push(n.id,`${n.tag} outlet`,'Ideal nominal setpoint · no droop',null)
  }else{
   let dp=0
   if(n.cv&&n.cv>0&&c.flow>0){try{dp=c.flow*c.flow/(2*props().density*(n.cv*1.697e-5)**2);takeLoss(dp,n.tag)}catch(e){valid=false;warnings.push((e as Error).message)}}
   push(n.id,n.tag||n.kind,n.cv&&n.cv>0?'Cv · low pressure-drop approximation':'Open tubing · no extra component loss',valid?dp/PSI:null)
  }
 }
 const last=byId.get(path.nodes.at(-1)??'')
 if(last?.ventsToAmbient||last?.boundary==='ambient')warnings.push('Ambient outlet: prescribed demand does not solve free-discharge flow. Outlet is the pressure available upstream of the exit.')
 return result()
}

/** Isothermal ideal-N2 reservoir, compressible orifice, numerical ∫ dm/mdot. CdA is user supplied. */
export function ventTime(volumeL:number,startPsig:number,targetPsig:number,t:number,diameterMm:number,cd:number){
 if(![volumeL,startPsig,targetPsig,t,diameterMm,cd].every(Number.isFinite)||volumeL<=0||targetPsig<=0||startPsig<=targetPsig||t<200||t>500||diameterMm<=0||cd<=0||cd>1)throw Error('Use positive volume and diameter, 200–500 K, 0 < Cd ≤ 1, and initial pressure > target > 0 psig.')
 const p0=startPsig*PSI+ATM,p1=targetPsig*PSI+ATM,area=cd*Math.PI*(diameterMm/1000)**2/4,critical=(2/(GAMMA+1))**(GAMMA/(GAMMA-1))
 const mdot=(p:number)=>{const ratio=ATM/p;return area*p/Math.sqrt(R_N2*t)*(ratio<=critical?Math.sqrt(GAMMA)*(2/(GAMMA+1))**((GAMMA+1)/(2*(GAMMA-1))):Math.sqrt(2*GAMMA/(GAMMA-1)*(ratio**(2/GAMMA)-ratio**((GAMMA+1)/GAMMA))))}
 let seconds=0;const n=4000,step=Math.log(p0/p1)/n,cap=volumeL/1000/(R_N2*t)
 for(let i=0;i<n;i++){const high=p0*Math.exp(-i*step),low=p0*Math.exp(-(i+1)*step);seconds+=cap*(high-low)/mdot(Math.sqrt(high*low))}
 return{seconds,initialFlow:mdot(p0),initiallyChoked:ATM/p0<=critical}
}
