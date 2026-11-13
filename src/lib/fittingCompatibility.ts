import type { Part } from './db';
type Port = 'left' | 'right' | 'top' | 'bottom' | 'actuator' | 'pressureLeft' | 'pressureRight';
type Node = { id: string; tag: string; part?: string; kind?: string; pressureTap?: {regulatorId:string;side:'left'|'right'} };
type Edge = { id: string; from?: string; to?: string; fromPort?: string; toPort?: string; assembly?: {type:string}[] };
const ports = new Set<string>(['left', 'right', 'top', 'bottom', 'actuator']);
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
export function fittingWarnings(nodes: Node[], edges: Edge[], parts: Part[]) {
  const byNode = new Map(nodes.map(node => [node.id, node]));
  const byPart = new Map(parts.map(part => [part.id, part]));
  const ordinary = edges.flatMap(edge => {
    // An adapter separates the two component fittings; comparing them directly
    // would report a mismatch even when the adapter is the intended transition.
    if (edge.assembly?.some(item => item.type === 'adapter')) return [];
    if (!edge.from || !edge.to || !edge.fromPort || !edge.toPort || !ports.has(edge.fromPort) || !ports.has(edge.toPort)) return [];
    const a = byNode.get(edge.from), b = byNode.get(edge.to);
    const af = a?.part && byPart.get(a.part)?.fittings?.[edge.fromPort as Port];
    const bf = b?.part && byPart.get(b.part)?.fittings?.[edge.toPort as Port];
    if (!a || !b || !af || !bf || !af.standard.trim() || !bf.standard.trim() || !af.size.trim() || !bf.size.trim() || af.end === 'other' || bf.end === 'other') return [];
    if (normalize(af.standard) === normalize(bf.standard) && normalize(af.size) === normalize(bf.size) && af.end !== bf.end) return [];
    return [{ id: edge.id, message: `${a.tag || a.id} (${af.size} ${af.end} ${af.standard}) <-> ${b.tag || b.id} (${bf.size} ${bf.end} ${bf.standard})` }];
  });
  const taps = nodes.flatMap(junction => {
    const tap = junction.pressureTap, reg = tap && byNode.get(tap.regulatorId);
    if (!tap || junction.kind !== 'junction' || reg?.kind !== 'regulator' || !edges.some(e => (e.from===junction.id && e.to===reg.id)||(e.to===junction.id && e.from===reg.id))) return [];
    const fitting = reg.part && byPart.get(reg.part)?.fittings?.[tap.side === 'left' ? 'pressureLeft' : 'pressureRight'];
    if (!fitting || !fitting.standard.trim() || !fitting.size.trim() || fitting.end==='other') return [];
    return edges.flatMap(edge => {
      if (edge.assembly?.some(item => item.type === 'adapter')) return [];
      const otherId = edge.from===junction.id ? edge.to : edge.to===junction.id ? edge.from : undefined;
      const port = edge.from===junction.id ? edge.toPort : edge.fromPort;
      const other = otherId && byNode.get(otherId);
      if (!other || other.kind!=='sensor' || !port || !ports.has(port)) return [];
      const instrument = other.part && byPart.get(other.part)?.fittings?.[port as Port];
      if (!instrument || !instrument.standard.trim() || !instrument.size.trim() || instrument.end==='other') return [];
      if (normalize(fitting.standard)===normalize(instrument.standard) && normalize(fitting.size)===normalize(instrument.size) && fitting.end!==instrument.end) return [];
      return [{id:edge.id,message:`${reg.tag} ${tap.side} pressure port (${fitting.size} ${fitting.end} ${fitting.standard}) <-> ${other.tag} (${instrument.size} ${instrument.end} ${instrument.standard})`}];
    });
  });
  return [...ordinary,...taps];
}
