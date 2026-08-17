import type { UserRole } from '../types/auth'
import { ROLE_LABELS } from '../types/auth'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import arsLogo from '../assets/ars-logo.png'
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
    <nav className="border-b border-slate-700/80 bg-slate-950/90 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl px-4 lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[90rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="ars-nav-logo-wrap inline-flex shrink-0 items-center">
                <img
                  src={arsLogo}
                  alt="ARS"
                  className="h-9 w-auto max-w-[8.5rem] object-contain object-left"
                />
              </span>
              <BilingualText en="Furnace" hi="फर्नेस" className="text-lg font-bold text-slate-100" />
            </div>
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-200">{ROLE_LABELS[role].en}</p>
              <p className="text-xs text-slate-400">{ROLE_LABELS[role].hi}</p>
            </div>
            <DevRoleSwitcher userId={userId} currentRole={role} />
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-10 items-center rounded-lg border border-slate-600/80 px-3 text-sm font-medium text-slate-300 hover:bg-slate-800/80"
            >
              {t('Sign out', 'साइन आउट')}
            </button>
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto pb-0.5">
          <ul className="flex min-w-max items-stretch gap-1 px-1 sm:gap-0.5 lg:flex-wrap lg:gap-x-1 xl:flex-nowrap">
            {items.map((item) => {
              const active = activeScreen === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`relative inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                      active
                        ? 'text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {item.icon}
                    </span>
                    {t(item.en, item.hi)}
                    {active && (
                      <span
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-500"
                        aria-hidden
                      />
                    )}
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
