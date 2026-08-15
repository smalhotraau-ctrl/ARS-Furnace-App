import type { UserRole } from './auth'

export type UserChangeAction = 'create' | 'revoke'
export type UserChangeStatus = 'pending' | 'approved' | 'rejected'

export interface ManagedUser {
  id: string
  username: string
  role: UserRole
  active: boolean
  created_at: string
}

export interface UserCreatePayload {
  username: string
  role: UserRole
}

export interface UserRevokePayload {
  username: string
  role: UserRole
}

export interface UserChangeRequest {
  id: string
  action: UserChangeAction
  target_id: string | null
  payload: UserCreatePayload | UserRevokePayload
  requested_by: string
  requested_at: string
  status: UserChangeStatus
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}
