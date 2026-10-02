import { useMemo } from 'react';
import { Download, Package, X } from 'lucide-react';
import type { Part } from '../lib/db';

type Node = { id: string; tag: string; symbolType?: string; part?: string; kind: string; };
type BOMViewProps = { nodes: Node[]; parts: Part[]; onClose: () => void; };

const symbolLabels: Record<string, string> = {
  solenoid: 'Solenoid Valve', 'manual-ball': 'Manual Ball Valve', 'pneumatic-ball': 'Pneumatic Ball Valve',
  'servo-ball': 'Servo Ball Valve', 'check-valve': 'Check Valve', 'relief-valve': 'Relief Valve',
  regulator: 'Regulator', 'burst-disk': 'Burst Disk', tank: 'Tank', tca: 'TCA', asi: 'ASI',
  transducer: 'Pressure Transducer', thermocouple: 'Thermocouple', 'load-cell': 'Load Cell',
  gauge: 'Pressure Gauge', tee: 'Tee', cross: 'Cross', adapter: 'Adapter', tube: 'Tube',
  'flex-hose': 'Flex Hose', continuation: 'Continuation', custom: 'Custom',
};
function symbolLabel(t: string) {
  return symbolLabels[t] ?? t.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const cell = { padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #374151', verticalAlign: 'top' } as const;

export default function BOMView({ nodes, parts, onClose }: BOMViewProps) {
  const { rows, unlinked, missing, counts, total } = useMemo(() => {
    const byId = new Map(parts.map((p) => [p.id, p]));
    const grouped = new Map<string, { part: Part; nodes: Node[] }>();
    const unlinked: Node[] = [];
    const missing: Node[] = [];
    const counts = new Map<string, number>();
    for (const n of nodes) {
      const t = n.symbolType || n.kind || 'custom';
      counts.set(t, (counts.get(t) ?? 0) + 1);
      if (!n.part?.trim()) { unlinked.push(n); continue; }
      const p = byId.get(n.part);
      if (!p) { missing.push(n); continue; }
      const g = grouped.get(p.id);
      if (g) g.nodes.push(n); else grouped.set(p.id, { part: p, nodes: [n] });
    }
    const rows = [...grouped.values()].sort((a, b) => a.part.name.localeCompare(b.part.name));
    return {
      rows, unlinked, missing,
      counts: [...counts.entries()].sort(([a],[b]) => symbolLabel(a).localeCompare(symbolLabel(b))),
      total: rows.reduce((s, r) => s + (r.part.unitCost ?? 0) * r.nodes.length, 0),
    };
  }, [nodes, parts]);

  function exportCSV() {
    const esc = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines: string[] = [];
    lines.push(['Part Name','Part Number','Manufacturer','Qty','Unit Cost','Extended Cost','Used By'].map(esc).join(','));
    for (const { part, nodes: ns } of rows) {
      const uc = part.unitCost ?? '';
      const ec = typeof part.unitCost === 'number' ? (part.unitCost * ns.length).toFixed(2) : '';
      lines.push([part.name, part.partNumber ?? '', part.manufacturer ?? '', ns.length, uc, ec, ns.map((n) => n.tag || n.id).join('; ')].map(esc).join(','));
    }
    lines.push(['Total (USD)','','','','',total.toFixed(2),''].map(esc).join(','));
    lines.push('');
    lines.push(['Unlinked Components'].map(esc).join(','));
    lines.push(['Tag','Type'].map(esc).join(','));
    for (const n of unlinked) lines.push([n.tag || n.id, symbolLabel(n.symbolType || n.kind || 'custom')].map(esc).join(','));
    lines.push('');
    lines.push(['Component Type Counts'].map(esc).join(','));
    lines.push(['Type','Qty'].map(esc).join(','));
    for (const [t, c] of counts) lines.push([symbolLabel(t), c].map(esc).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bom.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section aria-label="Bill of materials" style={{ width: '100%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', padding: 24, background: '#111827', color: '#e5e7eb', borderRadius: 12, border: '1px solid #374151' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Package size={22} /><h2 style={{ margin: 0, flex: 1 }}>Bill of Materials</h2>
          <button className="button" type="button" onClick={exportCSV}><Download size={16} /> Export CSV</button>
          <button className="button" type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr>{['Part Name','Part Number','Manufacturer','Qty','Unit Cost','Extended Cost','Used By'].map((h) => (<th key={h} style={cell}>{h}</th>))}</tr></thead>
            <tbody>
              {rows.map(({ part, nodes: ns }) => (
                <tr key={part.id}>
                  <td style={cell}>{part.name}</td>
                  <td style={cell}>{part.partNumber || '-'}</td>
                  <td style={cell}>{part.manufacturer || '-'}</td>
                  <td style={cell}>{ns.length}</td>
                  <td style={cell}>{typeof part.unitCost === 'number' ? currency.format(part.unitCost) : '-'}</td>
                  <td style={cell}>{typeof part.unitCost === 'number' ? currency.format(part.unitCost * ns.length) : '-'}</td>
                  <td style={cell}>{ns.map((n) => n.tag || n.id).join(', ')}</td>
                </tr>
              ))}
              {rows.length === 0 && (<tr><td colSpan={7} style={cell}>No components linked to parts yet.</td></tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ fontWeight: 700, marginTop: 12 }}>Total: {currency.format(total)}</p>
        {unlinked.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h3>Unlinked components ({unlinked.length})</h3>
            <ul>{unlinked.map((n) => (<li key={n.id}>{n.tag || n.id} — {symbolLabel(n.symbolType || n.kind || 'custom')}</li>))}</ul>
          </section>
        )}
        {missing.length > 0 && (
          <section style={{ marginTop: 16 }}>
            <h3>Missing part references ({missing.length})</h3>
            <ul>{missing.map((n) => (<li key={n.id}>{n.tag || n.id} — references "{n.part}"</li>))}</ul>
          </section>
        )}
        <section style={{ marginTop: 24 }}>
          <h3>Component counts</h3>
          <ul style={{ columns: 2 }}>
            {counts.map(([t, c]) => (<li key={t}>{c}x {symbolLabel(t)}{c === 1 ? '' : 's'}</li>))}
          </ul>
        </section>
      </section>
    </div>
  );
}
