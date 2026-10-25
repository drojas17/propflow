import type {SymbolAppearance, SymbolBehavior} from './symbolBehavior'

export default function SymbolSettings({description, onDescription, behavior, onBehavior, appearance, onAppearance, custom}: {
  description: string; onDescription: (v: string) => void; behavior: SymbolBehavior; onBehavior: (v: SymbolBehavior) => void;
  appearance: SymbolAppearance; onAppearance: (v: SymbolAppearance) => void; custom: boolean;
}) {
  const electrical = behavior.kind === 'electrical';
  return <div className="symbol-settings">
    {custom && <>
      <label>Description<textarea value={description} onChange={e=>onDescription(e.target.value)} placeholder="Purpose, notes, manufacturer…"/></label>
      <label>Component behavior<select value={behavior.kind} onChange={e=>onBehavior({...behavior,kind:e.target.value as SymbolBehavior['kind']})}>
        <option value="passive">Passive / flow-through</option><option value="valve">Valve · Open / Closed</option>
        <option value="sensor">Sensor / instrument</option><option value="electrical">Electrical · On / Off</option>
      </select></label>
      <label className="workshop-checkbox-label"><input type="checkbox" checked={behavior.canVentToAmbient??false} onChange={e=>onBehavior({...behavior,canVentToAmbient:e.target.checked})}/><span>Can vent to ambient</span></label>
      <small>Allows “Vents to ambient” on each placed component. It stays off until you enable it there.</small>
      {(behavior.kind==='valve'||electrical)&&<label>Default state<select value={behavior.defaultState??'closed'} onChange={e=>onBehavior({...behavior,defaultState:e.target.value as 'open'|'closed'})}><option value="closed">{electrical?'Off':'Closed'}</option><option value="open">{electrical?'On':'Open'}</option></select></label>}
      {behavior.kind==='valve'&&<label>Default flow coefficient (Cv)<input type="number" min="0" step="0.05" value={behavior.cv??0} onChange={e=>onBehavior({...behavior,cv:Math.max(0,+e.target.value)})}/></label>}
      {behavior.kind==='sensor'&&<><label>Measures<select value={behavior.measurement??'pressure'} onChange={e=>{const measurement=e.target.value as SymbolBehavior['measurement'];onBehavior({...behavior,measurement,unit:measurement==='temperature'?'°C':measurement==='force'?'N':measurement==='pressure'?'psi':''})}}><option value="pressure">Pressure</option><option value="temperature">Temperature</option><option value="force">Force / load</option><option value="other">Other</option></select></label><label>Measurement unit<input value={behavior.unit??'psi'} maxLength={24} onChange={e=>onBehavior({...behavior,unit:e.target.value})}/></label></>}
      {electrical&&<small>On/Off controls and SOP actions. Power state does not open or close the fluid path; electrical and thermal simulation are not modeled.</small>}
    </>}
    <b>State appearance</b>
    {(['active','inactive'] as const).map(state=>{const key=state==='active'?'activeColor':'inactiveColor',label=state==='active'?(electrical?'On':'Open'):(electrical?'Off':'Closed');return <div className="symbol-state-color" key={state}>
      <label className="workshop-checkbox-label"><input type="checkbox" checked={!!appearance[key]} onChange={e=>onAppearance({...appearance,[key]:e.target.checked?(state==='active'?'#ff8a3d':'#8b9aa8'):undefined})}/><span>{label} color</span></label>
      {appearance[key]&&<input aria-label={`${label} color`} type="color" value={appearance[key]} onChange={e=>onAppearance({...appearance,[key]:e.target.value})}/>}
    </div>})}
    <small>Unchecked uses the fluid color. Colors apply to drawn shapes; imported images retain their colors. Select a shape to choose which state shows it.</small>
  </div>
}
