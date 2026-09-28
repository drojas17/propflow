export type PneumaticNode={id:string;kind:string;symbolType?:string;connectedSolenoidId?:string}
export type PneumaticEdge={id:string;from?:string;to?:string;fromPort?:string;toPort?:string}
// Only the actuator terminal participates. Never walk through a process valve.
export function actuatorPaths<T extends PneumaticNode>(valve:T,nodes:T[],edges:PneumaticEdge[]){
 const queue=edges.flatMap(e=>e.from===valve.id&&e.fromPort==='actuator'&&e.to?[{id:e.to,path:[e.id]}]:e.to===valve.id&&e.toPort==='actuator'&&e.from?[{id:e.from,path:[e.id]}]:[]),seen=new Set([valve.id]),found:{node:T;path:string[]}[]=[];
 while(queue.length){const item=queue.shift()!;if(seen.has(item.id))continue;seen.add(item.id);const n=nodes.find(n=>n.id===item.id);if(!n)continue;if(n.symbolType==='solenoid'){found.push({node:n,path:item.path});continue}if(n.kind!=='fitting'&&n.kind!=='junction')continue;
  for(const e of edges){const other=e.from===n.id?e.to:e.to===n.id?e.from:undefined;if(other)queue.push({id:other,path:[...item.path,e.id]})}
 }return found;
}
export function linkedSolenoid<T extends PneumaticNode>(valve:T,nodes:T[],edges:PneumaticEdge[]){return actuatorPaths(valve,nodes,edges)[0]?.node??nodes.find(n=>n.id===valve.connectedSolenoidId&&n.symbolType==='solenoid')}
export function actuatorEdges(nodes:PneumaticNode[],edges:PneumaticEdge[]){const ids=new Set<string>();for(const n of nodes.filter(n=>n.symbolType==='pneumatic-ball'))for(const path of actuatorPaths(n,nodes,edges))for(const id of path.path)ids.add(id);for(const e of edges)if(e.fromPort==='actuator'||e.toPort==='actuator')ids.add(e.id);return ids}
