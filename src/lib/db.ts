import { requireSupabase } from './supabase';

/**
 * Data-access layer over the Supabase collaboration schema.
 * Phase 2 runs on the interim anonymous RLS policies (anon can read/write
 * projects, project_documents, global_library, project_updates). When
 * Touchstone/MIT auth lands, these same calls run as the signed-in user and
 * the anonymous policies get dropped.
 */

export interface Part {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  partNumber?: string;
  description?: string;
  specs?: Record<string, string>;
  supplier?: string;
  unitCost?: number;
  createdAt: string;
}

export interface ProjectDoc {
  nodes: unknown[];
  edges: unknown[];
  shapes: unknown[];
  canvasSize: { w: number; h: number };
  sop: unknown;
  projectName?: string;
  parts?: Part[];
}

export interface LibraryDoc {
  customSymbols: unknown[];
  symbolOverrides: Record<string, unknown>;
}

export interface ShareLink {
  url: string;
  expiresAt: number;
}

export function emptyProjectDoc(): ProjectDoc {
  return { nodes: [], edges: [], shapes: [], canvasSize: { w: 850, h: 580 }, sop: null };
}

// ---------------------------------------------------------------- projects

export async function listProjects(): Promise<string[]> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('projects').select('id').order('id');
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

export async function ensureProject(id: string, name?: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('projects')
    .upsert({ id, name: name ?? id }, { onConflict: 'id' });
  if (error) throw error;
}

// ---------------------------------------------------------------- documents

export async function loadProjectDoc(id: string): Promise<ProjectDoc | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('project_documents')
    .select('doc')
    .eq('project_id', id)
    .maybeSingle();
  if (error) throw error;
  return (data?.doc as ProjectDoc | undefined) ?? null;
}

export async function saveProjectDoc(id: string, doc: ProjectDoc): Promise<string> {
  const sb = requireSupabase();
  const updatedAt = new Date().toISOString();
  const { error } = await sb
    .from('project_documents')
    .upsert({ project_id: id, doc, updated_at: updatedAt }, { onConflict: 'project_id' });
  if (error) throw error;
  return updatedAt;
}

// ---------------------------------------------------------------- library

export async function loadLibrary(): Promise<LibraryDoc | null> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('global_library').select('data').eq('id', 1).maybeSingle();
  if (error) throw error;
  return (data?.data as LibraryDoc | undefined) ?? null;
}

export async function saveLibraryDoc(library: LibraryDoc): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb
    .from('global_library')
    .upsert({ id: 1, data: library, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

// ---------------------------------------------------------------- share links

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create an expiring read-only share link. Token is returned once; only its hash is stored. */
export async function createShareLink(projectId: string, daysValid = 30): Promise<ShareLink> {
  const sb = requireSupabase();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = Date.now() + daysValid * 24 * 60 * 60 * 1000;
  const { error } = await sb.from('share_links').insert({
    token_hash: tokenHash,
    project_id: projectId,
    expires_at: new Date(expiresAt).toISOString(),
  });
  if (error) throw error;
  const base = window.location.origin + window.location.pathname;
  return { url: `${base}?share=${token}`, expiresAt };
}

/** Resolve a share token to its project, or null when invalid/expired.
 *
 * Goes through the `resolve_share_token` RPC (SECURITY DEFINER): anonymous
 * clients get no direct SELECT on share_links, so token hashes cannot be
 * enumerated — only a valid, unexpired token reveals its project id. */
export async function resolveShareToken(token: string): Promise<{ projectId: string } | null> {
  const sb = requireSupabase();
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const { data, error } = await sb.rpc('resolve_share_token', { p_hash: tokenHash });
  if (error) throw error;
  if (!data || !data.length) return null;
  return { projectId: (data[0] as { project_id: string }).project_id };
}

export async function loadProjectUpdatedAt(id: string): Promise<string | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('project_documents')
    .select('updated_at')
    .eq('project_id', id)
    .maybeSingle();
  if (error) throw error;
  return (data?.updated_at as string | undefined) ?? null;
}

// ---------------------------------------------------------------- feedback

export type FeedbackCategory = 'bug' | 'feature' | 'general';

export interface FeedbackInput {
  userEmail?: string | null;
  userName?: string | null;
  projectId?: string | null;
  view?: string | null;
  category: FeedbackCategory;
  message: string;
}

/** Store user feedback for triage. Routed to Kev/a Codex agent for review. */
export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from('feedback').insert({
    user_email: input.userEmail ?? null,
    user_name: input.userName ?? null,
    project_id: input.projectId ?? null,
    view: input.view ?? null,
    category: input.category,
    message: input.message,
  });
  if (error) throw error;
}
