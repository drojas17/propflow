import type { WorkshopElement } from './SymbolWorkshop'
import { uid } from './lib/uid'

const format = 'propflow-symbol-elements'
const types = new Set(['line', 'curve', 'circle', 'arc', 'rect', 'triangle', 'text'])
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function encodeSymbolClipboard(elements: WorkshopElement[]) {
  return JSON.stringify({ format, version: 1, elements })
}

export function decodeSymbolClipboard(text: string): WorkshopElement[] | null {
  try {
    const data = JSON.parse(text)
    if (data?.format !== format || data.version !== 1 || !Array.isArray(data.elements) || !data.elements.length) return null
    for (const mark of data.elements) {
      if (!mark || typeof mark.id !== 'string' || !types.has(mark.type) || ![mark.x1, mark.y1, mark.x2, mark.y2].every(finite)) return null
      if (mark.text !== undefined && typeof mark.text !== 'string') return null
      if (mark.fontSize !== undefined && (!finite(mark.fontSize) || mark.fontSize <= 0)) return null
      if (mark.rotation !== undefined && !finite(mark.rotation)) return null
      if (mark.fill !== undefined && !['none', 'solid', 'accent'].includes(mark.fill)) return null
      if (mark.shadeOnClosed !== undefined && typeof mark.shadeOnClosed !== 'boolean') return null
      if (mark.visibleIn !== undefined && !['both', 'active', 'inactive'].includes(mark.visibleIn)) return null
      if (mark.points !== undefined && (!Array.isArray(mark.points) || mark.points.length !== 3 || !mark.points.every((p: { x?: unknown; y?: unknown } | null) => p && finite(p.x) && finite(p.y)))) return null
    }
    return data.elements
  } catch {
    return null
  }
}

export function pasteSymbolElements(elements: WorkshopElement[], offset: number): WorkshopElement[] {
  return elements.map(mark => ({
    ...structuredClone(mark), id: uid(),
    x1: mark.x1 + offset, y1: mark.y1 + offset,
    x2: mark.x2 + offset, y2: mark.y2 + offset,
    points: mark.points?.map(p => ({ x: p.x + offset, y: p.y + offset })),
  }))
}
