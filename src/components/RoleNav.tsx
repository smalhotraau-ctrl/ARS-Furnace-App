import type { UserRole } from '../types/auth'
import { ROLE_LABELS } from '../types/auth'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from './ui/BilingualText'
import { DevRoleSwitcher } from './ui/DevRoleSwitcher'
import { LanguageToggle } from './ui/LanguageToggle'

export type AppScreen = 'batch' | 'heat' | 'spectro' | 'output' | 'bundling' | 'dispatch' | 'pit' | 'master_admin'

interface NavItem {
  id: AppScreen
  en: string
  hi: string
}

interface RoleNavProps {
  userId: string
  role: UserRole
  activeScreen: AppScreen
  onNavigate: (screen: AppScreen) => void
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  supervisor: [
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना' },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल' },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो' },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन' },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग' },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच' },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट' },
  ],
  qa: [
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना' },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल' },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो' },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन' },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग' },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच' },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट' },
  ],
  plant_head: [
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना' },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल' },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो' },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन' },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग' },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच' },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट' },
    { id: 'master_admin', en: 'Master Admin', hi: 'मास्टर एडमिन' },
  ],
  admin_owner: [
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना' },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल' },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो' },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन' },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग' },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच' },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट' },
    { id: 'master_admin', en: 'Master Admin', hi: 'मास्टर एडमिन' },
  ],
}

export function RoleNav({ userId, role, activeScreen, onNavigate }: RoleNavProps) {
  const { t } = useLanguage()
  const items = NAV_BY_ROLE[role]

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BilingualText en="Furnace" hi="फर्नेस" className="text-lg font-bold text-slate-100" />
          <LanguageToggle />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-200">{ROLE_LABELS[role].en}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[role].hi}</p>
          </div>
          <DevRoleSwitcher userId={userId} currentRole={role} />
          <ul className="flex flex-wrap gap-2">
            {items.map((item) => {
              const active = activeScreen === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold transition ${
                      active
                        ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/40'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {t(item.en, item.hi)}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}
