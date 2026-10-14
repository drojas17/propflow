import {useState} from 'react'
import type {Sequence,TestPlan} from './testModel'

export default function ProjectControls({name,onRename,tests,testId,onTest,sequences,sequenceId,onSequence,onAddTest,onAddSequence,onEditTest,onDeleteTest,onRenameSequence,onDeleteSequence,readOnly}:{name:string;onRename:(name:string)=>Promise<void>;tests:TestPlan[];testId:string;onTest:(id:string)=>void;sequences:Sequence[];sequenceId:string;onSequence:(id:string)=>void;onAddTest:(name:string,type:TestPlan['type'])=>void;onAddSequence:(name:string,copy:boolean)=>void;onEditTest:(name:string,type:TestPlan['type'])=>void;onDeleteTest:()=>void;onRenameSequence:(name:string)=>void;onDeleteSequence:()=>void;readOnly:boolean}){
 const [form,setForm]=useState<'rename'|'test'|'edit-test'|'sequence'|'rename-sequence'|null>(null),[draft,setDraft]=useState(''),[type,setType]=useState<TestPlan['type']>('cold-flow'),[copy,setCopy]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const current=tests.find(t=>t.id===testId),sequence=sequences.find(s=>s.id===sequenceId)??sequences[0];
 const open=(f:NonNullable<typeof form>,value='')=>{setForm(f);setDraft(value);setError('');setCopy(false);setType(current?.type??'cold-flow')};
 const submit=async()=>{if(!draft.trim()||busy)return;setBusy(true);try{if(form==='rename')await onRename(draft.trim());else if(form==='test')onAddTest(draft.trim(),type);else if(form==='edit-test')onEditTest(draft.trim(),type);else if(form==='rename-sequence')onRenameSequence(draft.trim());else onAddSequence(draft.trim(),copy);setForm(null)}catch(e){setError(e instanceof Error?e.message:'Could not save.')}finally{setBusy(false)}};
 return <><div className="project-context">
  <b title={name}>{name}</b><button disabled={readOnly} onClick={()=>open('rename',name)}>Rename project</button>
  <label>Test configuration<select aria-label="Test configuration" value={testId} onChange={e=>onTest(e.target.value)}><option value="baseline">Baseline</option>{tests.map(t=><option key={t.id} value={t.id}>{t.name} · {t.type.replace('-',' ')}</option>)}</select></label>
  <button disabled={readOnly} onClick={()=>open('test')}>+ Test configuration</button>{current&&<button disabled={readOnly} onClick={()=>open('edit-test',current.name)}>Edit test</button>}
  <label>SOP sequence<select aria-label="SOP sequence" value={sequenceId} onChange={e=>onSequence(e.target.value)}>{sequences.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  <button disabled={readOnly} onClick={()=>open('sequence')}>+ SOP sequence</button><button disabled={readOnly} onClick={()=>open('rename-sequence',sequence?.name)}>Rename SOP</button>
 </div>{form&&<div className="feedback-shade"><form className="feedback context-form" onSubmit={e=>{e.preventDefault();void submit()}}>
  <h2>{form==='rename'?'Rename project':form==='test'?'Add test configuration':form==='edit-test'?'Edit test configuration':form==='rename-sequence'?'Rename SOP sequence':'Add SOP sequence'}</h2>
  <label>Name<input autoFocus maxLength={120} required value={draft} onChange={e=>setDraft(e.target.value)}/></label>
  {(form==='test'||form==='edit-test')&&<><label>Test type<select aria-label="Test type" value={type} onChange={e=>setType(e.target.value as TestPlan['type'])}><option value="cold-flow">Cold flow</option><option value="hot-fire">Hot fire</option><option value="hover">Hover test</option><option value="other">Other</option></select></label>{form==='test'&&<p>Starts with a copy of the current diagram and SOP sequences. Changes belong to this test configuration.</p>}</>}
  {form==='sequence'&&<label className="check-label"><input type="checkbox" checked={copy} onChange={e=>setCopy(e.target.checked)}/>Copy the current SOP sequence</label>}
  {error&&<p role="alert">{error}</p>}<div className="context-form-actions"><button type="button" disabled={busy} onClick={()=>setForm(null)}>Cancel</button><button disabled={!draft.trim()||busy}>{busy?'Saving…':'Save'}</button></div>
  {form==='edit-test'&&<button type="button" className="danger" onClick={()=>{if(window.confirm(`Delete test configuration “${current?.name}”? You can undo this edit.`)){onDeleteTest();setForm(null)}}}>Delete this test configuration</button>}
  {form==='rename-sequence'&&sequences.length>1&&<button type="button" className="danger" onClick={()=>{if(window.confirm('Delete this SOP sequence? You can undo this edit.')){onDeleteSequence();setForm(null)}}}>Delete this sequence</button>}
 </form></div>}</>
}
