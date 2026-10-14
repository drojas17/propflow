import {emptySop, type SopDocument} from './sopModel'

export type Sequence = {id:string; name:string; document:SopDocument}
export type DiagramSnapshot = {nodes:unknown[]; edges:unknown[]; shapes:unknown[]; canvasSize:{w:number;h:number}; sop:SopDocument; sequences:Sequence[]}
export type TestPlan = DiagramSnapshot & {id:string; name:string; type:'cold-flow'|'hot-fire'|'hover'|'other'}
export type FailureEvent = {id:string; title:string; kind:'event'|'and'|'or'; category:string; children:string[]; componentIds:string[]; detection:string; response:string}
export type FailureScope = {testId:string; sequenceId?:string; stepId?:string}
export type FailureTree = {id:string; title:string; rootId:string; scopes:FailureScope[]}
export type FailureAnalysis = {events:FailureEvent[]; trees:FailureTree[]}
export const emptyFailures = ():FailureAnalysis=>({events:[],trees:[]})
export const baselineSequence = (sop:SopDocument):Sequence=>({id:'baseline-sop',name:sop.title||'Operating procedure',document:sop})
export function sequencesFor(sop:SopDocument,sequences?:Sequence[]):Sequence[]{return sequences?.length?sequences:[baselineSequence(sop)]}

// An empty scope list applies everywhere. A test-only scope applies to all its sequences and steps.
export function appliesTo(tree:FailureTree,testId:string,sequenceId:string,stepId?:string){
 return !tree.scopes.length||tree.scopes.some(s=>s.testId===testId&&(!s.sequenceId||s.sequenceId===sequenceId)&&(!s.stepId||s.stepId===stepId))
}
export function wouldCycle(events:FailureEvent[],parent:string,child:string):boolean{
 const byId=new Map(events.map(e=>[e.id,e])),seen=new Set<string>(),pending=[child];while(pending.length){const id=pending.pop()!;if(id===parent)return true;if(seen.has(id))continue;seen.add(id);pending.push(...(byId.get(id)?.children??[]))}return false
}
export function evaluateFailure(events:FailureEvent[],rootId:string,occurred:Set<string>):boolean|null{
 const byId=new Map(events.map(e=>[e.id,e])),memo=new Map<string,boolean|null>();const visit=(id:string,path:Set<string>):boolean|null=>{
  const e=byId.get(id);if(!e||path.has(id)||path.size>100)return null;if(memo.has(id))return memo.get(id)!;if(e.kind==='event')return occurred.has(id);
  if(e.children.length<2)return null;const next=new Set(path).add(id),values=e.children.map(c=>visit(c,next));
  const result=e.kind==='and'?(values.includes(false)?false:values.includes(null)?null:true):(values.includes(true)?true:values.includes(null)?null:false);memo.set(id,result);return result;
 };return visit(rootId,new Set())
}
export function failureProblems(analysis:FailureAnalysis,componentIds:Set<string>):string[]{
 const issues:string[]=[];const ids=new Set(analysis.events.map(e=>e.id));
 for(const e of analysis.events){if(!e.title.trim())issues.push('An event has no title.');if(e.kind!=='event'&&e.children.length<2)issues.push(`${e.title}: a ${e.kind.toUpperCase()} gate needs at least two causes.`);for(const id of e.children){if(!ids.has(id))issues.push(`${e.title}: missing cause.`);else if(wouldCycle(analysis.events,e.id,id))issues.push(`${e.title}: cycle in causes.`)}for(const id of e.componentIds)if(!componentIds.has(id))issues.push(`${e.title}: linked component was removed.`)}
 for(const t of analysis.trees)if(!ids.has(t.rootId))issues.push(`${t.title}: choose a top event.`);
 return [...new Set(issues)]
}

// Validate every added field before an import can reach the editor. Legacy documents omit them.
export function validateSop(raw:unknown):SopDocument{
 if(raw==null)return emptySop();const d=raw as SopDocument;
 const record=(v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v);
 if(!record(d)||typeof d.title!=='string'||!record(d.initial)||!record(d.regulators)||!Array.isArray(d.steps))throw new Error('Invalid SOP document.');
 if(Object.values(d.initial).some(v=>v!=='open'&&v!=='closed')||Object.values(d.regulators).some(v=>!Number.isFinite(v)||v<0)||d.safing&&(!record(d.safing)||Object.values(d.safing).some(v=>v!=='open'&&v!=='closed')))throw new Error('Invalid SOP initial or safing state.');
 const ids=new Set<string>();for(const s of d.steps){if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||typeof s.title!=='string'||typeof s.role!=='string'||!Array.isArray(s.actions))throw new Error('Invalid or duplicate SOP step.');ids.add(s.id);const actions=new Set<string>();for(const a of s.actions){if(!a||typeof a.id!=='string'||!a.id||actions.has(a.id)||!['open','close','regulator','wait','verify','instruction'].includes(a.type)||typeof a.target!=='string'||typeof a.name!=='string'||typeof a.text!=='string'||!Number.isFinite(a.value))throw new Error('Invalid SOP action.');actions.add(a.id)}}
 if(d.sections&&(!Array.isArray(d.sections)||d.sections.some(s=>!s||typeof s.id!=='string'||typeof s.title!=='string')||new Set(d.sections.map(s=>s.id)).size!==d.sections.length))throw new Error('Invalid SOP sections.');return d
}
export function validateExtensions(raw:Record<string,unknown>,validateDiagram:(v:Record<string,unknown>)=>DiagramSnapshot){
 const sequences=(v:unknown):Sequence[]=>{if(v===undefined)return[];if(!Array.isArray(v)||v.length>100)throw new Error('Invalid SOP sequences.');const seen=new Set<string>();return v.map(s=>{if(!s||typeof s.id!=='string'||!s.id||seen.has(s.id)||typeof s.name!=='string')throw new Error('Invalid or duplicate SOP sequence.');seen.add(s.id);return {...s,document:validateSop(s.document)}})};
 let testPlans:TestPlan[]=[];if(raw.testPlans!==undefined){if(!Array.isArray(raw.testPlans)||raw.testPlans.length>100)throw new Error('Invalid test configurations.');const seen=new Set<string>();testPlans=raw.testPlans.map(t=>{if(!t||typeof t.id!=='string'||!t.id||t.id==='baseline'||seen.has(t.id)||typeof t.name!=='string'||!['cold-flow','hot-fire','hover','other'].includes(t.type))throw new Error('Invalid or duplicate test configuration.');seen.add(t.id);return {...t,...validateDiagram(t),sequences:sequences(t.sequences)}})}
 const failureAnalysis=(raw.failureAnalysis??emptyFailures()) as FailureAnalysis;
 if(!failureAnalysis||!Array.isArray(failureAnalysis.events)||!Array.isArray(failureAnalysis.trees)||failureAnalysis.events.length>5000||failureAnalysis.trees.length>500)throw new Error('Invalid failure analysis.');
 const eventIds=new Set<string>(),treeIds=new Set<string>();for(const e of failureAnalysis.events){if(!e||typeof e.id!=='string'||!e.id||eventIds.has(e.id)||typeof e.title!=='string'||!['event','and','or'].includes(e.kind)||typeof e.category!=='string'||typeof e.detection!=='string'||typeof e.response!=='string'||!Array.isArray(e.children)||e.children.some(x=>typeof x!=='string')||new Set(e.children).size!==e.children.length||!Array.isArray(e.componentIds)||e.componentIds.some(x=>typeof x!=='string'))throw new Error('Invalid failure event.');eventIds.add(e.id)}
 for(const t of failureAnalysis.trees){if(!t||typeof t.id!=='string'||!t.id||treeIds.has(t.id)||typeof t.title!=='string'||typeof t.rootId!=='string'||!eventIds.has(t.rootId)||!Array.isArray(t.scopes)||t.scopes.some(s=>!s||typeof s.testId!=='string'||s.sequenceId!==undefined&&typeof s.sequenceId!=='string'||s.stepId!==undefined&&typeof s.stepId!=='string'))throw new Error('Invalid failure tree.');treeIds.add(t.id)}
 for(const e of failureAnalysis.events)for(const id of e.children)if(!eventIds.has(id)||wouldCycle(failureAnalysis.events,e.id,id))throw new Error('Failure trees contain a missing cause or a cycle.');
 return {sequences:sequences(raw.sequences),testPlans,failureAnalysis}
}
