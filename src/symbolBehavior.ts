export type SymbolBehavior = {
  kind: 'passive' | 'valve' | 'sensor' | 'electrical';
  canVentToAmbient?: boolean;
  defaultState?: 'open' | 'closed';
  cv?: number;
  measurement?: 'pressure' | 'temperature' | 'force' | 'other';
  unit?: string;
};
export type SymbolAppearance = {activeColor?: string; inactiveColor?: string};
export type BehaviorNode = {kind: string; customId?: string; state?: 'open' | 'closed'; cv?: number; ventsToAmbient?: boolean; measurement?: string; unit?: string};

export function applyCustomBehavior<T extends BehaviorNode>(node: T, symbol?: {behavior?: SymbolBehavior}): T {
  if (!node.customId || !symbol?.behavior) return node;
  const b = symbol.behavior, kind = b.kind === 'passive' ? 'custom' : b.kind;
  const stateful = kind === 'valve' || kind === 'electrical';
  const next = {...node, kind, state: stateful ? (node.kind === kind ? node.state : undefined) ?? b.defaultState ?? 'closed' : undefined,
    cv: kind === 'valve' ? node.cv ?? b.cv : undefined,
    ventsToAmbient: b.canVentToAmbient ? node.ventsToAmbient : false,
    measurement: kind === 'sensor' ? b.measurement ?? 'pressure' : undefined,
    unit: kind === 'sensor' ? b.unit ?? (b.measurement === 'temperature' ? '°C' : b.measurement === 'force' ? 'N' : 'psi') : undefined} as T;
  return Object.keys(next).every(key => next[key as keyof T] === node[key as keyof T]) ? node : next;
}

export function stateLabel(node: {kind: string; state?: string}, state = node.state): string {
  return node.kind === 'electrical' ? (state === 'open' ? 'On' : 'Off') : (state === 'open' ? 'Open' : 'Closed');
}
export function shapeVisible(mark: {visibleIn?: 'both' | 'active' | 'inactive'}, active: boolean) {
  return !mark.visibleIn || mark.visibleIn === 'both' || mark.visibleIn === (active ? 'active' : 'inactive');
}
export function appearanceColor(appearance: SymbolAppearance | undefined, active: boolean, fallback: string) {
  return (active ? appearance?.activeColor : appearance?.inactiveColor) || fallback;
}
export function ventsToAmbient(node: {ventsToAmbient?: boolean; boundary?: string; kind: string; state?: string}) {
  return node.boundary === 'ambient' || !!node.ventsToAmbient && (node.kind !== 'valve' || node.state === 'open');
}
export function isPressureInstrument(node: {kind: string; measurement?: string; symbolType?: string}) {
  return node.kind === 'tank' || node.kind === 'regulator' || node.kind === 'sensor' && (!node.measurement || node.measurement === 'pressure') && !['thermocouple', 'load-cell'].includes(node.symbolType ?? '');
}

export function validateSymbolMetadata(symbol: Record<string, unknown>) {
  const b = symbol.behavior as SymbolBehavior | undefined, a = symbol.appearance as SymbolAppearance | undefined;
  if (symbol.description !== undefined && typeof symbol.description !== 'string') throw new Error('Invalid symbol description.');
  if (b !== undefined && (!b || typeof b !== 'object' || Array.isArray(b) || !['passive','valve','sensor','electrical'].includes(b.kind) ||
    b.canVentToAmbient !== undefined && typeof b.canVentToAmbient !== 'boolean' ||
    b.defaultState !== undefined && !['open','closed'].includes(b.defaultState) ||
    b.cv !== undefined && (!Number.isFinite(b.cv) || b.cv < 0) ||
    b.measurement !== undefined && !['pressure','temperature','force','other'].includes(b.measurement) ||
    b.unit !== undefined && (typeof b.unit !== 'string' || b.unit.length > 24))) throw new Error('Invalid symbol behavior.');
  if (a !== undefined && (!a || typeof a !== 'object' || Array.isArray(a) || [a.activeColor,a.inactiveColor].some(c=>c !== undefined && (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c))))) throw new Error('Invalid symbol state color.');
  for (const mark of (symbol.elements ?? []) as {visibleIn?: string}[]) {
    if (mark?.visibleIn !== undefined && !['both','active','inactive'].includes(mark.visibleIn)) throw new Error('Invalid shape state visibility.');
  }
}
