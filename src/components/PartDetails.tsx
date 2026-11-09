import type { Part } from '../lib/db';
import { partSource } from '../lib/partSource';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export default function PartDetails({ part, sidebar = false }: { part: Part; sidebar?: boolean }) {
  return <div style={{ fontSize: 13, lineHeight: 1.6, color: sidebar ? 'var(--symbol-text)' : '#cbd5e1', overflowWrap: 'anywhere' }}>
    {partSource(part) && <div>Manufacturer / supplier: {partSource(part)}</div>}
    {part.partNumber && <div>Part number: {part.partNumber}</div>}
    <div>Category: {part.category}</div>
    <div>Purchase cost: {part.unitCost === undefined ? 'Not set' : currency.format(part.unitCost)}</div>
    {part.refillCost !== undefined && <div>Refill cost: {currency.format(part.refillCost)}</div>}
    {part.description && <p>{part.description}</p>}
    {part.specs && Object.keys(part.specs).length > 0 && <div><b>Specifications</b>{Object.entries(part.specs).map(([key, value]) => <div key={key}>{key}: {value}</div>)}</div>}
    {part.fittings && Object.keys(part.fittings).length > 0 && <div><b>Port fittings</b>{Object.entries(part.fittings).map(([port, fitting]) => fitting && <div key={port}>{port}: {[fitting.size, fitting.end, fitting.standard].filter(Boolean).join(' ')}</div>)}</div>}
    {part.links && part.links.length > 0 && <div><b>Links</b>{part.links.map((link, i) => { let safe = false; try { safe = ['http:', 'https:'].includes(new URL(link.url).protocol); } catch { /* invalid imported URL */ } return <div key={i}>{safe ? <a href={link.url} target="_blank" rel="noopener noreferrer" style={{color:sidebar ? 'var(--cyan)' : '#83dfff'}}>{link.label}</a> : link.label}</div>; })}</div>}
  </div>;
}
