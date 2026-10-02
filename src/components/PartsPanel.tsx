import { useMemo, useState } from 'react';
import { Box, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import type { Part } from '../lib/db';

type PartsPanelProps = {
  parts: Part[];
  onAdd: () => void;
  onEdit: (part: Part) => void;
  onDelete: (id: string) => void;
  onSelect?: (part: Part) => void;
  selectedId?: string;
};

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function PartsPanel({
  parts,
  onAdd,
  onEdit,
  onDelete,
  onSelect,
  selectedId,
}: PartsPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const categories = useMemo(
    () => [...new Set(parts.map((part) => part.category))].sort(),
    [parts],
  );

  const filteredParts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return parts.filter((part) => {
      const matchesSearch = [
        part.name,
        part.partNumber,
        part.manufacturer,
        part.category,
      ].some((value) => value?.toLowerCase().includes(query));
      return matchesSearch && (!category || part.category === category);
    });
  }, [parts, search, category]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, color: '#e5e7eb', background: '#111827', minWidth: 280, height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Box size={20} aria-hidden="true" />
        <h2 style={{ margin: 0, flex: 1, fontSize: 18 }}>Parts</h2>
        <button className="button" type="button" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" /> Add
        </button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Search size={16} aria-hidden="true" />
        <input className="input" aria-label="Search parts" placeholder="Search parts..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
      </label>
      <select className="select" aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All categories</option>
        {categories.map((v) => (<option key={v} value={v}>{v}</option>))}
      </select>
      <div style={{ display: 'grid', gap: 8, overflowY: 'auto' }}>
        {filteredParts.map((part) => (
          <div key={part.id} style={{ padding: 12, borderRadius: 8, border: '1px solid ' + (selectedId === part.id ? '#60a5fa' : '#374151'), background: selectedId === part.id ? '#172554' : '#1f2937' }}>
            <strong style={{ overflowWrap: 'anywhere' }}>{part.name}</strong>
            <div style={{ marginTop: 6, fontSize: 13, color: '#cbd5e1' }}>
              <div>{part.partNumber || 'No part number'}</div>
              <div>{part.manufacturer || 'No manufacturer'}</div>
              <div>{typeof part.unitCost === 'number' && Number.isFinite(part.unitCost) ? currency.format(part.unitCost) : 'Cost not set'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="button" type="button" onClick={() => onEdit(part)} aria-label={'Edit ' + part.name}><Edit3 size={14} /> Edit</button>
              <button className="button" type="button" onClick={() => onDelete(part.id)} aria-label={'Delete ' + part.name}><Trash2 size={14} /> Delete</button>
              {onSelect && <button className="button" type="button" onClick={() => onSelect(part)}>Select</button>}
            </div>
          </div>
        ))}
        {filteredParts.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
            <p>{parts.length === 0 ? 'No parts yet.' : 'No matching parts.'}</p>
            {parts.length === 0 && <button className="button full" type="button" onClick={onAdd}><Plus size={16} /> Add your first part</button>}
          </div>
        )}
      </div>
    </div>
  );
}
