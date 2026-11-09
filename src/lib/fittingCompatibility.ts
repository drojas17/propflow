import type { Part } from './db';
type Port = 'left' | 'right' | 'top' | 'bottom' | 'actuator';
type Node = { id: string; tag: string; part?: string };
type Edge = { id: string; from?: string; to?: string; fromPort?: string; toPort?: string };
const ports = new Set<string>(['left', 'right', 'top', 'bottom', 'actuator']);
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
export function fittingWarnings(nodes: Node[], edges: Edge[], parts: Part[]) {
  const byNode = new Map(nodes.map(node => [node.id, node]));
  const byPart = new Map(parts.map(part => [part.id, part]));
  return edges.flatMap(edge => {
    if (!edge.from || !edge.to || !edge.fromPort || !edge.toPort || !ports.has(edge.fromPort) || !ports.has(edge.toPort)) return [];
    const a = byNode.get(edge.from), b = byNode.get(edge.to);
    const af = a?.part && byPart.get(a.part)?.fittings?.[edge.fromPort as Port];
    const bf = b?.part && byPart.get(b.part)?.fittings?.[edge.toPort as Port];
    if (!a || !b || !af || !bf || !af.standard.trim() || !bf.standard.trim() || !af.size.trim() || !bf.size.trim() || af.end === 'other' || bf.end === 'other') return [];
    if (normalize(af.standard) === normalize(bf.standard) && normalize(af.size) === normalize(bf.size) && af.end !== bf.end) return [];
    return [{ id: edge.id, message: `${a.tag || a.id} (${af.size} ${af.end} ${af.standard}) <-> ${b.tag || b.id} (${bf.size} ${bf.end} ${bf.standard})` }];
  });
}
