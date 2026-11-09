import type { Part } from './db';

export function partSource(part: Pick<Part, 'manufacturer' | 'supplier'>): string {
  const values = [part.manufacturer?.trim(), part.supplier?.trim()].filter((value): value is string => Boolean(value));
  return values.filter((value, index) => values.findIndex(other => other.toLowerCase() === value.toLowerCase()) === index).join(' / ');
}
