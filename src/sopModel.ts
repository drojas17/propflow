export {stateLabel} from './symbolBehavior'
export type SopNode={id:string;tag:string;kind:string;measurement?:string;unit?:string;symbolType?:string;state?:'open'|'closed';pressure?:number;fluid?:string;fluidLocked?:boolean;tankRole?:string;boundary?:string;ventsToAmbient?:boolean;x:number;y:number;rotation?:number;connectedSolenoidId?:string;transientSource?:boolean}
export type SopAction={id:string;type:'open'|'close'|'on'|'off'|'regulator'|'wait'|'verify'|'instruction';target:string;name:string;value:number;text:string}
export type SopStep={id:string;title:string;role:string;actions:SopAction[];sectionId?:string}
export type SopDocument={title:string;initial:Record<string,'open'|'closed'>;regulators:Record<string,number>;safing?:Record<string,'open'|'closed'>;steps:SopStep[];sections?:{id:string;title:string}[];sidebarWidth?:number}
export function moveSopStep(doc:SopDocument,id:string,sectionId:string,beforeId?:string){
 const step=doc.steps.find(s=>s.id===id);if(!step||id===beforeId)return doc;
 const remaining=doc.steps.filter(s=>s.id!==id),position=beforeId?remaining.findIndex(s=>s.id===beforeId):-1;
 const moved={...step,sectionId:sectionId||undefined};
 if(position>=0)remaining.splice(position,0,moved);else remaining.push(moved);
 const order=['',...(doc.sections??[]).map(s=>s.id)];
 return {...doc,steps:order.flatMap(group=>remaining.filter(s=>(s.sectionId??'')===group))};
}
export const emptySop=():SopDocument=>({title:'Operating procedure',initial:{},regulators:{},steps:[]})
export function withSopSections(doc:SopDocument):SopDocument{
 const sections=[...(doc.sections??[])],known=new Set(sections.map(s=>s.id));
 if(!sections.length||doc.steps.some(s=>!s.sectionId||!known.has(s.sectionId))){
  let id='default-section';while(known.has(id))id+='-';
  sections.unshift({id,title:'General'});
  return {...doc,sections,steps:doc.steps.map(s=>s.sectionId&&known.has(s.sectionId)?s:{...s,sectionId:id})};
 }
 return doc;
}
export function initialValve(n:SopNode,doc:SopDocument){return doc.initial[n.id]??n.state??'closed'}
export function sopSentence(action:SopAction,nodes:SopNode[]){
 const node=nodes.find(n=>n.id===action.target),tag=node?.tag??'[missing component]',name=action.name.trim()|| (action.type==='regulator'?'line':action.type==='verify'?'instrument':action.type==='on'||action.type==='off'?'device':'valve');
 if(node?.symbolType==='pneumatic-ball'&&(action.type==='open'||action.type==='close')){const solenoid=nodes.find(n=>n.id===node.connectedSolenoidId);return `${action.type==='open'?'Open':'Close'} ${name} (${tag}${solenoid?` [${solenoid.tag}]`:''}).`}
 switch(action.type){case 'on':case 'off':return `Turn ${action.type} the ${name} (${tag}).`;case 'open':case 'close':return `${action.type==='open'?'Open':'Close'} the ${name} (${tag}).`;case 'regulator':return `Set the ${name} regulator (${tag}) to ${action.value} psi.`;case 'wait':return `Wait ${action.value} seconds.`;case 'verify':return `Verify that ${name} (${tag}) reads ${action.value} ${node?.unit??(node?.symbolType==='thermocouple'?'°C':node?.symbolType==='load-cell'?'N':'psi')}.`;case 'instruction':return action.text.trim();}
}
export function sopState<T extends SopNode>(nodes:T[],doc:SopDocument,index:number){
 const states=new Map(nodes.filter(n=>n.kind==='valve'||n.kind==='electrical').map(n=>[n.id,initialValve(n,doc)])),regulators={...doc.regulators};
 for(const step of doc.steps.slice(0,Math.max(0,index+1)))for(const a of step.actions){if(['open','close','on','off'].includes(a.type)){const state=a.type==='open'||a.type==='on'?'open':'closed',target=nodes.find(n=>n.id===a.target);if(!target||((a.type==='on'||a.type==='off')?target.kind!=='electrical':target.kind!=='valve'))continue;states.set(a.target,state);const solenoidId=target?.symbolType==='pneumatic-ball'?target.connectedSolenoidId:target?.symbolType==='solenoid'?target.id:undefined;if(solenoidId){states.set(solenoidId,state);for(const n of nodes)if(n.symbolType==='pneumatic-ball'&&n.connectedSolenoidId===solenoidId)states.set(n.id,state)}}if(a.type==='regulator')regulators[a.target]=a.value}
 return nodes.map(n=>({...n,state:states.get(n.id)??n.state,...(n.kind==='regulator'?{pressure:regulators[n.id]??0}: {})}));
}
export function sopProblems(doc:SopDocument,nodes:SopNode[]){return doc.steps.flatMap((s,i)=>{
 const prefix=`Step ${i+1}: `,issues:string[]=[];
 if(!s.role.trim())issues.push(prefix+'choose an operator role.');
 if(!s.actions.length)issues.push(prefix+'add an action.');
 for(const a of s.actions){
  if(a.type==='instruction'){if(!a.text.trim())issues.push(prefix+'enter the instruction.');continue}
  if(['regulator','verify','wait'].includes(a.type)&&(!Number.isFinite(a.value)||a.type!=='verify'&&a.value<0))issues.push(prefix+'enter a valid numeric value (waits and regulator settings must be nonnegative).');
  if(a.type==='wait')continue;
  const node=nodes.find(n=>n.id===a.target),allowed=a.type==='regulator'?['regulator']:a.type==='verify'?['sensor','tank']:a.type==='on'||a.type==='off'?['electrical']:['valve'];
  if(!node||!allowed.includes(node.kind))issues.push(prefix+'select a compatible existing component.');
 }
 return issues;
})}
