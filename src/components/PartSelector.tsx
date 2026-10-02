import { useMemo, useState } from 'react';
import { Package, Plus, Search, X } from 'lucide-react';
import type { Part } from '../lib/db';

type PartSelectorProps = {
  parts: Part[];
  onSelect: (part: Part) => void;
  onClose: () => void;
  onCreateNew: () => void;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function PartSelector({ parts, onSelect, onClose, onCreateNew }: PartSelectorProps) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parts.filter((p) =>
      [p.name, p.partNumber, p.manufacturer, p.category].some((v) => v?.toLowerCase().includes(q))
    );
  }, [parts, search]);

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1001, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,0.75)' }}>
      <div role="dialog" aria-modal="true" style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 600, maxHeight: '90vh', padding: 24, borderRadius: 12, border: '1px solid #374151', background: '#111827', color: '#e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Package size={22} />
          <h2 style={{ margin: 0, flex: 1 }}>Select a part</h2>
          <button className="button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={18} />
          <input className="input" placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        </label>
        <div style={{ display: 'grid', gap: 8, overflowY: 'auto' }}>
          {filtered.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid #374151', borderRadius: 8, background: '#1f2937' }}>
              <div style={{ flex: 1 }}>
                <strong>{p.name}</strong>
                <div style={{ fontSize: 13, color: '#cbd5e1' }}>{[p.partNumber, p.manufacturer].filter(Boolean).join(' \u00b7 ') || 'No part number'}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.category} \u00b7 {typeof p.unitCost === 'number' ? currency.format(p.unitCost) : 'Cost not set'}</div>
              </div>
              <button className="button" type="button" onClick={() => onSelect(p)}>Select</button>
            </div>
          ))}
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8' }}>{parts.length === 0 ? 'No parts yet.' : 'No matching parts.'}</p>}
        </div>
        <button className="button full" type="button" onClick={onCreateNew}><Plus size={16} /> Create new part</button>
      </div>
    </div>
  );
}
