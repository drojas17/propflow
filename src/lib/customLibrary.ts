/** Keep project-only definitions, with the shared definition winning an ID match. */
export function mergeCustomSymbols<T extends { id: string }>(project: T[], shared: T[]): T[] {
  return [...new Map([...project, ...shared].map(symbol => [symbol.id, symbol])).values()];
}
