import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Part } from '../lib/db';
import './parts-dialog.css';
import { partSource } from '../lib/partSource';

type PartDialogProps = {
  part: Part | null;
  onSave: (part: Part) => void;
  onClose: () => void;
};

const commonCategories = ['Valves','Regulators','Tanks','Sensors','Gauges','Fittings','Tubing','Hoses','Actuators','Other'];

export default function PartDialog({ part, onSave, onClose }: PartDialogProps) {
  const [name, setName] = useState(part?.name ?? '');
  const [category, setCategory] = useState(part?.category ?? '');
  const [source, setSource] = useState(part ? partSource(part) : '');
  const [partNumber, setPartNumber] = useState(part?.partNumber ?? '');
  const [description, setDescription] = useState(part?.description ?? '');
  const [refillCost, setRefillCost] = useState(part?.refillCost?.toString() ?? '');
  const [fittings, setFittings] = useState<NonNullable<Part['fittings']>>(part?.fittings ?? {});
  const [unitCost, setUnitCost] = useState(part?.unitCost?.toString() ?? '');
  const [specs, setSpecs] = useState<{id:string;key:string;value:string}[]>(() =>
    Object.entries(part?.specs ?? {}).map(([key, value]) => ({ id: crypto.randomUUID(), key, value }))
  );
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !category.trim()) { setError('Name and category are required.'); return; }
    const cost = unitCost.trim() === '' ? undefined : Number(unitCost);
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) { setError('Unit cost must be a non-negative number.'); return; }
    const refill = refillCost.trim() === '' ? undefined : Number(refillCost);
    if (refill !== undefined && (!Number.isFinite(refill) || refill < 0)) { setError('Refill cost must be a non-negative number.'); return; }
    const activeSpecs = specs.filter(r => r.key.trim() || r.value.trim());
    onSave({
      id: part?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category: category.trim(),
      manufacturer: part && source.trim() === partSource(part) ? part.manufacturer : source.trim() || undefined,
      partNumber: partNumber.trim() || undefined,
      description: description.trim() || undefined,
      supplier: part && source.trim() === partSource(part) ? part.supplier : undefined,
      unitCost: cost,
      refillCost: refill,
      fittings: Object.keys(fittings).length ? fittings : undefined,
      specs: activeSpecs.length ? Object.fromEntries(activeSpecs.map(r => [r.key.trim(), r.value.trim()])) : undefined,
      createdAt: part?.createdAt ?? new Date().toISOString(),
    });
  }

  const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' } as const;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,0.75)' }}>
      <div className="parts-dialog" role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 24, borderRadius: 12, border: '1px solid #374151', background: '#111827', color: '#e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, flex: 1 }}>{part ? 'Edit part' : 'New part'}</h2>
          <button className="parts-dialog-close" aria-label="Close" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <label>Name *<input className="input" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></label>
            <label>Category *<input className="input" required list="part-cats" value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} />
              <datalist id="part-cats">{commonCategories.map((v) => (<option key={v} value={v} />))}</datalist>
            </label>
            <label>Manufacturer / supplier<input className="input" value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle} /></label>
            <label>Part number<input className="input" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} style={inputStyle} /></label>
            <label>Purchase cost per unit (USD)<input className="input" type="number" min="0" step="any" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} style={inputStyle} /></label>
          </div>
          <label>Refill cost per unit (USD, optional)<input className="input" type="number" min="0" step="any" value={refillCost} onChange={(e) => setRefillCost(e.target.value)} style={inputStyle} /></label>
          <fieldset style={{ border: '1px solid #374151', borderRadius: 8 }}>
            <legend>Port fittings (optional)</legend>
            <p>Use the symbol’s unrotated port positions. Enter matching standards and sizes consistently; warnings are preliminary.</p>
            {(['left', 'right', 'top', 'bottom', 'actuator'] as const).map(port => {
              const fitting = fittings[port];
              return <div key={port} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <label style={{ minWidth: 70 }}><input type="checkbox" checked={!!fitting} onChange={e => setFittings(prev => { const next = { ...prev }; if (e.target.checked) next[port] = { standard: '', size: '', end: 'other' }; else delete next[port]; return next; })} /> {port}</label>
                {fitting && <><input aria-label={`${port} fitting standard`} className="input" placeholder="Standard, e.g. NPT" value={fitting.standard} onChange={e => setFittings(prev => ({ ...prev, [port]: { ...fitting, standard: e.target.value } }))} /><input aria-label={`${port} fitting size`} className="input" placeholder="Size, e.g. 1/4 in" value={fitting.size} onChange={e => setFittings(prev => ({ ...prev, [port]: { ...fitting, size: e.target.value } }))} /><select aria-label={`${port} fitting end`} className="input" value={fitting.end} onChange={e => setFittings(prev => ({ ...prev, [port]: { ...fitting, end: e.target.value as 'male' | 'female' | 'other' } }))}><option value="other">Other / unknown</option><option value="male">Male</option><option value="female">Female</option></select></>}
              </div>;
            })}
          </fieldset>
          <label>Description<textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} /></label>
          <fieldset style={{ border: '1px solid #374151', borderRadius: 8 }}>
            <legend>Specifications</legend>
            <div style={{ display: 'grid', gap: 8, padding: 4 }}>
              {specs.map((row, i) => (
                <div key={row.id} style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="Key" value={row.key} onChange={(e) => setSpecs(specs.map(s => s.id === row.id ? { ...s, key: e.target.value } : s))} style={{ flex: 1 }} />
                  <input className="input" placeholder="Value" value={row.value} onChange={(e) => setSpecs(specs.map(s => s.id === row.id ? { ...s, value: e.target.value } : s))} style={{ flex: 1 }} />
                  <button className="button" type="button" onClick={() => setSpecs(specs.filter(s => s.id !== row.id))}><Trash2 size={16} /></button>
                </div>
              ))}
              <button className="button" type="button" onClick={() => setSpecs([...specs, { id: crypto.randomUUID(), key: '', value: '' }])}><Plus size={16} /> Add specification</button>
            </div>
          </fieldset>
          {error && <p style={{ margin: 0, color: '#fca5a5' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="button" type="button" onClick={onClose}>Cancel</button>
            <button className="button" type="submit">Save part</button>
          </div>
        </form>
      </div>
    </div>
  );
}
