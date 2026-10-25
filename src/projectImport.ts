import {validateSymbolMetadata} from './symbolBehavior'
import type {ProjectDoc} from './lib/db'
import {validateSop,validateExtensions,type DiagramSnapshot} from './testModel'
import {uid} from './lib/uid'
import {sequencesFor,type TestPlan,type Sequence} from './testModel'

/** Append imported configurations with new identities; never replace the current diagram/library. */
export function prepareProjectAppend(doc:ProjectDoc){
 const nodeIds=new Map<string,string>(),partIds=new Map((doc.parts??[]).map(p=>[p.id,uid()])),customIds=new Map((doc.customSymbols??[]).map(s=>[(s as {id:string}).id,uid()]));
 const original=[{...doc,id:'baseline',name:doc.projectName??'Imported diagram',type:'other'},...(doc.testPlans??[])];
 for(const t of original)for(const n of t.nodes as {id:string}[])if(!nodeIds.has(n.id))nodeIds.set(n.id,uid());
 const testIds=new Map(original.map(t=>[t.id,uid()])),sequenceIds=new Map<string,string>(),stepIds=new Map<string,string>();
 const plans=original.map(t=>{
  const sequences:Sequence[]=sequencesFor(validateSop(t.sop),t.sequences).map(s=>{
   const id=uid();sequenceIds.set(`${t.id}:${s.id}`,id);const d=s.document;
   const states=<T,>(r:Record<string,T>):Record<string,T>=>Object.fromEntries(Object.entries(r).map(([k,v])=>[nodeIds.get(k)??k,v]));
   return {id,name:s.name,document:{...d,initial:states(d.initial),regulators:states(d.regulators),...(d.safing?{safing:states(d.safing)}:{}),steps:d.steps.map(step=>{
    const sid=uid();stepIds.set(`${t.id}:${s.id}:${step.id}`,sid);
    return {...step,id:sid,actions:step.actions.map(a=>({...a,id:uid(),target:nodeIds.get(a.target)??a.target}))};
   })}};
  });
  return {...t,id:testIds.get(t.id)!,nodes:(t.nodes as Record<string,unknown>[]).map(n=>({...n,id:nodeIds.get(n.id as string),...(n.customId?{customId:customIds.get(n.customId as string)??n.customId}:{}),...(n.part?{part:partIds.get(n.part as string)??n.part}:{}),...(n.connectedSolenoidId?{connectedSolenoidId:nodeIds.get(n.connectedSolenoidId as string)??n.connectedSolenoidId}:{}),...(n.slide?{slide:{a:nodeIds.get((n.slide as {a:string}).a),b:nodeIds.get((n.slide as {b:string}).b)}}:{})})),edges:(t.edges as Record<string,unknown>[]).map(e=>({...e,id:uid(),...(e.from?{from:nodeIds.get(e.from as string)}:{}),...(e.to?{to:nodeIds.get(e.to as string)}:{})})),shapes:(t.shapes as Record<string,unknown>[]).map(s=>({...s,id:uid()})),sop:sequences[0].document,sequences} as TestPlan;
 });
 const eventIds=new Map((doc.failureAnalysis?.events??[]).map(e=>[e.id,uid()]));
 return {plans,parts:(doc.parts??[]).map(p=>({...p,id:partIds.get(p.id)!})),customSymbols:(doc.customSymbols??[]).map(s=>({...s as object,id:customIds.get((s as {id:string}).id)!})),failureAnalysis:{events:(doc.failureAnalysis?.events??[]).map(e=>({...e,id:eventIds.get(e.id)!,children:e.children.map(id=>eventIds.get(id)!),componentIds:e.componentIds.map(id=>nodeIds.get(id)??id)})),trees:(doc.failureAnalysis?.trees??[]).map(t=>({...t,id:uid(),rootId:eventIds.get(t.rootId)!,scopes:t.scopes.length?t.scopes.map(s=>({testId:testIds.get(s.testId)??s.testId,...(s.sequenceId?{sequenceId:sequenceIds.get(`${s.testId}:${s.sequenceId}`)??s.sequenceId}:{}),...(s.stepId?{stepId:stepIds.get(`${s.testId}:${s.sequenceId}:${s.stepId}`)??s.stepId}:{})})):plans.map(p=>({testId:p.id}))}))}}
}

export function validateDiagramData(p:Record<string,unknown>,warnings:string[]):DiagramSnapshot{
 if(!Array.isArray(p.nodes)||!Array.isArray(p.edges)||p.nodes.length>5000||p.edges.length>10000)throw new Error('Missing or oversized project diagram.');
 const ids=new Set<string>();for(const n of p.nodes){if(!n||typeof n.id!=='string'||!n.id||ids.has(n.id)||typeof n.tag!=='string'||!['tank','valve','sensor','regulator','control','ambient','junction','fitting','custom','electrical'].includes(n.kind)||!Number.isFinite(n.x)||!Number.isFinite(n.y))throw new Error('Invalid or duplicate component.');ids.add(n.id)}
 const edgeIds=new Set<string>();const point=(v:unknown)=>{const p=v as {x:number;y:number};return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)};
 for(const e of p.edges){if(!e||typeof e.id!=='string'||!e.id||edgeIds.has(e.id)||e.from!==undefined&&typeof e.from!=='string'||e.to!==undefined&&typeof e.to!=='string'||e.start!==undefined&&!point(e.start)||e.end!==undefined&&!point(e.end)||e.waypoints!==undefined&&(!Array.isArray(e.waypoints)||!e.waypoints.every(point))||e.bend!==undefined&&!Number.isFinite(e.bend))throw new Error('Invalid or duplicate pipe.');edgeIds.add(e.id)}
 const edges=p.edges.filter(e=>(!e.from||ids.has(e.from))&&(!e.to||ids.has(e.to)));const dropped=p.edges.length-edges.length;if(dropped)warnings.push(`${dropped} pipe${dropped===1?'':'s'} pointed at missing components and ${dropped===1?'was':'were'} removed.`);
 const shapes=p.shapes??[];if(!Array.isArray(shapes))throw new Error('Invalid shapes.');const shapeIds=new Set<string>();for(const s of shapes){if(!s||typeof s.id!=='string'||!s.id||shapeIds.has(s.id)||!['line','rect','ellipse'].includes(s.type)||![s.x1,s.y1,s.x2,s.y2].every(Number.isFinite)||typeof s.stroke!=='string'||typeof s.fill!=='string')throw new Error('Invalid or duplicate shape.');shapeIds.add(s.id)}
 const canvasSize=(p.canvasSize??{w:850,h:580}) as {w:number;h:number};if(!Number.isFinite(canvasSize.w)||!Number.isFinite(canvasSize.h)||canvasSize.w<50||canvasSize.h<50||canvasSize.w>20000||canvasSize.h>20000)throw new Error('Invalid canvas dimensions.');
 return {nodes:p.nodes,edges,shapes,canvasSize,sop:validateSop(p.sop),sequences:[]}
}
export async function parseProjectFile(file:File){
 if(file.size>10*1024*1024)throw new Error('That file is too large (10 MB max).');let raw:unknown;try{raw=JSON.parse(await file.text())}catch{throw new Error('This file is not valid JSON.')}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('This file is not a PropFlow project JSON.');const p=raw as Record<string,unknown>,warnings:string[]=[];
 if(p.format!==undefined&&p.format!=='propflow-project')throw new Error('This file is not a PropFlow project JSON.');if(p.version!==undefined&&(!Number.isInteger(p.version)||Number(p.version)<1||Number(p.version)>2))throw new Error('Unsupported PropFlow JSON version.');if(p.format===undefined)warnings.push('Legacy export: parts or symbols may not be included.');
 const diagram=validateDiagramData(p,warnings),extensions=validateExtensions(p,v=>validateDiagramData(v,warnings));
 const parts=p.parts??[],customSymbols=p.customSymbols??[];if(!Array.isArray(parts)||!Array.isArray(customSymbols))throw new Error('Invalid parts or symbols.');
 for(const [items,label] of [[parts,'part'],[customSymbols,'symbol']] as [Record<string,unknown>[],string][]){const ids=new Set<string>();for(const x of items){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id)||label==='symbol'&&!Array.isArray(x.elements))throw new Error(`Invalid or duplicate ${label}.`);ids.add(x.id);if(label==='symbol')validateSymbolMetadata(x)}}
 const symbolOverrides:Record<string,unknown>={};if(p.symbolOverrides&&typeof p.symbolOverrides==='object'&&!Array.isArray(p.symbolOverrides))for(const [k,v] of Object.entries(p.symbolOverrides)){if(['__proto__','constructor','prototype'].includes(k)){warnings.push(`Ignored unsafe symbol override "${k}".`);continue}symbolOverrides[k]=v}
 const projectName=typeof p.projectName==='string'&&p.projectName.trim()?p.projectName.trim():file.name.replace(/\.json$/i,'');const name=projectName.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').replace(/^local-/,'')||'imported-project';
 return {doc:{...diagram,...extensions,projectName,parts,customSymbols,symbolOverrides} as ProjectDoc,name,warnings}
}
