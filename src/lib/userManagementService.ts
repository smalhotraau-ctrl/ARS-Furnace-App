import { supabase } from './supabaseClient'
import type { AppUser, UserRole } from '../types/auth'
import type {
  ManagedUser,
  UserChangeRequest,
  UserCreatePayload,
  UserRevokePayload,
} from '../types/userManagement'

const common = () => supabase.schema('common')

function isUserRole(value: string): value is UserRole {
  return ['supervisor', 'qa', 'plant_head', 'admin_owner'].includes(value)
}

function rowToManagedUser(row: Record<string, unknown>): ManagedUser {
  const role = String(row.role)
  if (!isUserRole(role)) throw new Error(`Unexpected role on common.users row: ${role}`)
  return {
    id: String(row.id),
    username: String(row.username),
    role,
    active: Boolean(row.active),
    created_at: String(row.created_at),
  }
}

function rowToChangeRequest(row: Record<string, unknown>): UserChangeRequest {
  return {
    id: String(row.id),
    action: row.action as UserChangeRequest['action'],
    target_id: row.target_id != null ? String(row.target_id) : null,
    payload: (row.payload ?? {}) as UserCreatePayload | UserRevokePayload,
    requested_by: String(row.requested_by),
    requested_at: String(row.requested_at),
    status: row.status as UserChangeRequest['status'],
    decided_by: row.decided_by != null ? String(row.decided_by) : null,
    decided_at: row.decided_at != null ? String(row.decided_at) : null,
    decision_note: row.decision_note != null ? String(row.decision_note) : null,
  }
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export async function fetchAllUsers(): Promise<ManagedUser[]> {
  const { data, error } = await common().from('users').select('id, username, role, active, created_at').order('username')
  if (error) throw error
  return (data ?? []).map((row) => rowToManagedUser(row as Record<string, unknown>))
}

export async function fetchUserChangeRequests(): Promise<UserChangeRequest[]> {
  const { data, error } = await common()
    .from('user_change_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => rowToChangeRequest(row as Record<string, unknown>))
}

// Pattern A (03b): Plant Head is always the maker, the request is always left pending, and
// nothing about common.users / Auth changes until Owner decides. There is no auto-approve
// path and no approval_settings row for this action — unlike rate override / Master Admin.
export async function proposeUserCreate(user: AppUser, payload: UserCreatePayload): Promise<UserChangeRequest> {
  const username = normalizeUsername(payload.username)
  if (!username) throw new Error('Username is required')
  if (!isUserRole(payload.role)) throw new Error('Invalid role')

  const { data, error } = await common()
    .from('user_change_requests')
    .insert({
      action: 'create',
      target_id: null,
      payload: { username, role: payload.role },
      requested_by: user.id,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToChangeRequest(data as Record<string, unknown>)
}

export async function proposeUserRevoke(user: AppUser, target: ManagedUser): Promise<UserChangeRequest> {
  const { data, error } = await common()
    .from('user_change_requests')
    .insert({
      action: 'revoke',
      target_id: target.id,
      payload: { username: target.username, role: target.role },
      requested_by: user.id,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToChangeRequest(data as Record<string, unknown>)
}

export interface DecideUserChangeResult {
  request: UserChangeRequest
  // Only set when Owner just approved a create — the one-time PIN to relay. Never persisted
  // anywhere except as the new Auth user's password (see supabase/functions/create-furnace-user).
  pin: string | null
}

export async function decideUserChangeRequest(
  user: AppUser,
  request: UserChangeRequest,
  approve: boolean,
  decisionNote: string | null,
): Promise<DecideUserChangeResult> {
  if (!approve) {
    const rejected = await markRequest(request.id, user.id, 'rejected', decisionNote)
    return { request: rejected, pin: null }
  }

  if (request.action === 'revoke') {
    if (!request.target_id) throw new Error('Revoke request is missing target_id')
    const { error: revokeError } = await common().from('users').update({ active: false }).eq('id', request.target_id)
    if (revokeError) throw revokeError
    const decided = await markRequest(request.id, user.id, 'approved', decisionNote)
    return { request: decided, pin: null }
  }

  // Create: Auth admin API cannot run in the browser. The Edge Function generates the PIN,
  // creates the Auth user + matching common.users row (same UUID), and marks this request
  // approved — one round-trip, PIN returned once in the response body.
  const { data, error } = await supabase.functions.invoke('create-furnace-user', {
    body: { requestId: request.id, decisionNote },
  })

  const body = (data ?? {}) as { pin?: string; error?: string; username?: string }
  // Non-2xx still sometimes carries the PIN (Auth user + common.users were created, only the
  // request-row update failed). Surface the PIN rather than losing it; the Owner can still relay
  // it, and the request can be reconciled from the Users list.
  if (typeof body.pin === 'string' && body.pin.length === 6) {
    return { request: { ...request, status: 'approved' }, pin: body.pin }
  }
  if (error) {
    throw new Error(error.message || 'Failed to create user (is the create-furnace-user Edge Function deployed?)')
  }
  if (body.error) throw new Error(String(body.error))
  throw new Error('User was created but no PIN was returned — do not retry; check Auth users in the dashboard.')
}

async function markRequest(
  requestId: string,
  decidedBy: string,
  status: 'approved' | 'rejected',
  decisionNote: string | null,
): Promise<UserChangeRequest> {
  const { data, error } = await common()
    .from('user_change_requests')
    .update({
      status,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote,
    })
    .eq('id', requestId)
    .select('*')
    .single()
  if (error) throw error
  return rowToChangeRequest(data as Record<string, unknown>)
}
