import { useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Part } from '../lib/db';

type PartDialogProps = {
  part: Part | null;
  onSave: (part: Part) => void;
  onClose: () => void;
};

const commonCategories = ['Valves','Regulators','Tanks','Sensors','Gauges','Fittings','Tubing','Hoses','Actuators','Other'];

export default function PartDialog({ part, onSave, onClose }: PartDialogProps) {
  const [name, setName] = useState(part?.name ?? '');
  const [category, setCategory] = useState(part?.category ?? '');
  const [manufacturer, setManufacturer] = useState(part?.manufacturer ?? '');
  const [partNumber, setPartNumber] = useState(part?.partNumber ?? '');
  const [description, setDescription] = useState(part?.description ?? '');
  const [supplier, setSupplier] = useState(part?.supplier ?? '');
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
    const activeSpecs = specs.filter(r => r.key.trim() || r.value.trim());
    onSave({
      id: part?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category: category.trim(),
      manufacturer: manufacturer.trim() || undefined,
      partNumber: partNumber.trim() || undefined,
      description: description.trim() || undefined,
      supplier: supplier.trim() || undefined,
      unitCost: cost,
      specs: activeSpecs.length ? Object.fromEntries(activeSpecs.map(r => [r.key.trim(), r.value.trim()])) : undefined,
      createdAt: part?.createdAt ?? new Date().toISOString(),
    });
  }

  const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' } as const;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,0.75)' }}>
      <div role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 24, borderRadius: 12, border: '1px solid #374151', background: '#111827', color: '#e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, flex: 1 }}>{part ? 'Edit part' : 'New part'}</h2>
          <button className="button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <label>Name *<input className="input" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></label>
            <label>Category *<input className="input" required list="part-cats" value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} />
              <datalist id="part-cats">{commonCategories.map((v) => (<option key={v} value={v} />))}</datalist>
            </label>
            <label>Manufacturer<input className="input" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} style={inputStyle} /></label>
            <label>Part number<input className="input" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} style={inputStyle} /></label>
            <label>Supplier<input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} style={inputStyle} /></label>
            <label>Unit cost (USD)<input className="input" type="number" min="0" step="any" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} style={inputStyle} /></label>
          </div>
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
