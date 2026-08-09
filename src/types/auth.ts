export type UserRole = 'supervisor' | 'qa' | 'plant_head' | 'admin_owner'

export interface AppUser {
  id: string
  username: string
  role: UserRole
}

export const ROLE_LABELS: Record<UserRole, { en: string; hi: string }> = {
  supervisor: { en: 'Supervisor', hi: 'सुपरवाइज़र' },
  qa: { en: 'QA', hi: 'गुणवत्ता जांच' },
  plant_head: { en: 'Plant Head', hi: 'प्लांट प्रमुख' },
  admin_owner: { en: 'Owner', hi: 'मालिक' },
}
