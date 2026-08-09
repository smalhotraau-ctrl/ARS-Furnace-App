import type { UserRole } from '../types/auth'
import { ROLE_LABELS } from '../types/auth'
import { BilingualText } from './ui/BilingualText'

interface RoleNavProps {
  role: UserRole
}

const NAV_BY_ROLE: Record<UserRole, Array<{ id: string; en: string; hi: string }>> = {
  supervisor: [{ id: 'pit', en: 'Pit Furnace', hi: 'पिट फर्नेस' }],
  qa: [{ id: 'pit', en: 'Pit Furnace', hi: 'पिट फर्नेस' }],
  plant_head: [{ id: 'pit', en: 'Pit Furnace', hi: 'पिट फर्नेस' }],
  admin_owner: [{ id: 'pit', en: 'Pit Furnace', hi: 'पिट फर्नेस' }],
}

export function RoleNav({ role }: RoleNavProps) {
  const items = NAV_BY_ROLE[role]

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <BilingualText en="Furnace" hi="फर्नेस" className="text-lg font-bold text-slate-100" />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-200">{ROLE_LABELS[role].en}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[role].hi}</p>
          </div>
          <ul className="flex gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <span className="inline-flex min-h-11 items-center rounded-xl bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-300">
                  {item.en}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  )
}
