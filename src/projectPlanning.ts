import {emptySop} from './sopModel'
import {sequencesFor,type DiagramSnapshot,type TestPlan} from './testModel'

export function captureDiagram(base:DiagramSnapshot,tests:TestPlan[],testId:string,sequenceId:string,working:Omit<DiagramSnapshot,'sequences'>){
 const source=testId==='baseline'?base:tests.find(t=>t.id===testId)??base;
 const sequences=sequencesFor(source.sop,source.sequences).map(s=>s.id===sequenceId?{...s,document:working.sop}:s);
 const snapshot={...working,sequences,sop:sequences[0]?.document??emptySop()};
 return testId==='baseline'?{base:snapshot,tests}:{base,tests:tests.map(t=>t.id===testId?{...t,...snapshot}:t)}
}
export function selectedDiagram(base:DiagramSnapshot,tests:TestPlan[],testId:string,sequenceId:string){
 const source=tests.find(t=>t.id===testId)??base;const sequences=sequencesFor(source.sop,source.sequences);const selected=sequences.find(s=>s.id===sequenceId)??sequences[0];return{source,sequences,selected}
}
