import type { UserRole } from '../types/auth'

export function isPowerUserRole(role: UserRole): boolean {
  return role === 'plant_head' || role === 'admin_owner'
}

// Floor-worker screens stay phone-width for Supervisor/QA; Plant Head/Owner get the wider
// desktop layout on the same screens without changing anything Supervisor/QA see.
export function floorWorkerPageClass(role: UserRole): string {
  return isPowerUserRole(role)
    ? 'mx-auto max-w-3xl space-y-6 px-4 py-6 lg:max-w-6xl'
    : 'mx-auto max-w-3xl space-y-6 px-4 py-6'
}
