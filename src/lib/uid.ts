/**
 * UUID v4 generator that works in insecure contexts (plain http://).
 *
 * `crypto.randomUUID()` only exists in secure contexts (https:// or
 * localhost). On an http:// deployment it is undefined, so calling it throws
 * and silently breaks every "add" flow. This uses it when available and falls
 * back to `crypto.getRandomValues()` (available everywhere), then Math.random().
 */
export function uid(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    const buf = new Uint8Array(16);
    if (c && typeof c.getRandomValues === 'function') {
      c.getRandomValues(buf);
    } else {
      for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
    buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    // Last resort: unique enough for client-side ids.
    return `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e12).toString(36)}`;
  }
}
