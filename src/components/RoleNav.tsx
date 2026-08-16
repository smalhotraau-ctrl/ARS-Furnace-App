import type { UserRole } from '../types/auth'
import { ROLE_LABELS } from '../types/auth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from './ui/BilingualText'
import { DevRoleSwitcher } from './ui/DevRoleSwitcher'
import { LanguageToggle } from './ui/LanguageToggle'
import { ThemeToggle } from './ui/ThemeToggle'

export type AppScreen =
  | 'dashboard'
  | 'batch'
  | 'heat'
  | 'spectro'
  | 'output'
  | 'bundling'
  | 'dispatch'
  | 'pit'
  | 'master_admin'
  | 'costing'

interface NavItem {
  id: AppScreen
  en: string
  hi: string
  icon: string
}

interface RoleNavProps {
  userId: string
  role: UserRole
  activeScreen: AppScreen
  onNavigate: (screen: AppScreen) => void
}

const NAV_ICONS: Record<AppScreen, string> = {
  dashboard: '🏠',
  batch: '📋',
  heat: '🔥',
  spectro: '🔬',
  output: '⚖️',
  bundling: '📦',
  dispatch: '🚚',
  pit: '🪵',
  master_admin: '⚙️',
  costing: '💰',
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  supervisor: [
    { id: 'dashboard', en: 'Dashboard', hi: 'डैशबोर्ड', icon: NAV_ICONS.dashboard },
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना', icon: NAV_ICONS.batch },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल', icon: NAV_ICONS.heat },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो', icon: NAV_ICONS.spectro },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन', icon: NAV_ICONS.output },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग', icon: NAV_ICONS.bundling },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच', icon: NAV_ICONS.dispatch },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट', icon: NAV_ICONS.pit },
  ],
  qa: [
    { id: 'dashboard', en: 'Dashboard', hi: 'डैशबोर्ड', icon: NAV_ICONS.dashboard },
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना', icon: NAV_ICONS.batch },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल', icon: NAV_ICONS.heat },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो', icon: NAV_ICONS.spectro },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन', icon: NAV_ICONS.output },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग', icon: NAV_ICONS.bundling },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच', icon: NAV_ICONS.dispatch },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट', icon: NAV_ICONS.pit },
  ],
  plant_head: [
    { id: 'dashboard', en: 'Dashboard', hi: 'डैशबोर्ड', icon: NAV_ICONS.dashboard },
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना', icon: NAV_ICONS.batch },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल', icon: NAV_ICONS.heat },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो', icon: NAV_ICONS.spectro },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन', icon: NAV_ICONS.output },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग', icon: NAV_ICONS.bundling },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच', icon: NAV_ICONS.dispatch },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट', icon: NAV_ICONS.pit },
    { id: 'master_admin', en: 'Master Admin', hi: 'मास्टर एडमिन', icon: NAV_ICONS.master_admin },
    { id: 'costing', en: 'Costing', hi: 'कॉस्टिंग', icon: NAV_ICONS.costing },
  ],
  admin_owner: [
    { id: 'dashboard', en: 'Dashboard', hi: 'डैशबोर्ड', icon: NAV_ICONS.dashboard },
    { id: 'batch', en: 'Batch Plan', hi: 'बैच योजना', icon: NAV_ICONS.batch },
    { id: 'heat', en: 'Heat & Cycle', hi: 'हीट व साइकिल', icon: NAV_ICONS.heat },
    { id: 'spectro', en: 'Spectro', hi: 'स्पेक्ट्रो', icon: NAV_ICONS.spectro },
    { id: 'output', en: 'Output & Close', hi: 'आउटपुट व समापन', icon: NAV_ICONS.output },
    { id: 'bundling', en: 'Bundling', hi: 'बंडलिंग', icon: NAV_ICONS.bundling },
    { id: 'dispatch', en: 'Dispatch', hi: 'डिस्पैच', icon: NAV_ICONS.dispatch },
    { id: 'pit', en: 'Pit Furnace', hi: 'पिट', icon: NAV_ICONS.pit },
    { id: 'master_admin', en: 'Master Admin', hi: 'मास्टर एडमिन', icon: NAV_ICONS.master_admin },
    { id: 'costing', en: 'Costing', hi: 'कॉस्टिंग', icon: NAV_ICONS.costing },
  ],
}

export function RoleNav({ userId, role, activeScreen, onNavigate }: RoleNavProps) {
  const { t } = useLanguage()
  const { signOut } = useAuth()
  const items = NAV_BY_ROLE[role]

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:max-w-6xl">
        <div className="flex items-center gap-3">
          <BilingualText en="Furnace" hi="फर्नेस" className="text-lg font-bold text-slate-100" />
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-200">{ROLE_LABELS[role].en}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[role].hi}</p>
          </div>
          <DevRoleSwitcher userId={userId} currentRole={role} />
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-600 px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            {t('Sign out', 'साइन आउट')}
          </button>
          <ul className="flex flex-wrap gap-2">
            {items.map((item) => {
              const active = activeScreen === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition ${
                      active
                        ? 'bg-emerald-500 text-on-accent shadow-md'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {item.icon}
                    </span>
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
