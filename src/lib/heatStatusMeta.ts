import type { HeatStatus } from '../types/heat'

export interface HeatStatusMeta {
  en: string
  hi: string
  badgeClass: string
  dotClass: string
}

// One distinct look per lifecycle stage, so a heat's status is obvious at a glance on both
// the heat list and heat detail header — not just at Closed.
export const HEAT_STATUS_META: Record<HeatStatus, HeatStatusMeta> = {
  Planned: {
    en: 'Planned',
    hi: 'योजित',
    badgeClass: 'bg-slate-700 text-slate-100 ring-2 ring-slate-500',
    dotClass: 'bg-slate-400',
  },
  Charging: {
    en: 'Charging',
    hi: 'चार्जिंग',
    badgeClass: 'bg-sky-500 text-white ring-2 ring-sky-300',
    dotClass: 'bg-sky-200',
  },
  Melting: {
    en: 'Melting',
    hi: 'मेल्टिंग',
    badgeClass: 'bg-amber-500 text-on-accent ring-2 ring-amber-300',
    dotClass: 'bg-amber-200',
  },
  Casting: {
    en: 'Casting',
    hi: 'कास्टिंग',
    badgeClass: 'bg-orange-500 text-on-accent ring-2 ring-orange-300',
    dotClass: 'bg-orange-200',
  },
  'Output Entered': {
    en: 'Awaiting Verification',
    hi: 'सत्यापन प्रतीक्षित',
    badgeClass: 'bg-purple-500 text-white ring-2 ring-purple-300',
    dotClass: 'bg-purple-200',
  },
  Closed: {
    en: 'Closed',
    hi: 'बंद',
    badgeClass: 'bg-emerald-500 text-on-accent ring-2 ring-emerald-300',
    dotClass: 'bg-emerald-200',
  },
  Cancelled: {
    en: 'Cancelled',
    hi: 'रद्द',
    badgeClass: 'bg-rose-500 text-white ring-2 ring-rose-300',
    dotClass: 'bg-rose-200',
  },
}

export const HEAT_STATUS_ICON: Record<HeatStatus, string> = {
  Planned: '📋',
  Charging: '📥',
  Melting: '🌡️',
  Casting: '🏭',
  'Output Entered': '⏳',
  Closed: '✅',
  Cancelled: '🚫',
}
