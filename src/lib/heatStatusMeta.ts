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
    badgeClass: 'bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/40',
    dotClass: 'bg-slate-400',
  },
  Charging: {
    en: 'Charging',
    hi: 'चार्जिंग',
    badgeClass: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40',
    dotClass: 'bg-sky-400',
  },
  Melting: {
    en: 'Melting',
    hi: 'मेल्टिंग',
    badgeClass: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40',
    dotClass: 'bg-amber-400',
  },
  Casting: {
    en: 'Casting',
    hi: 'कास्टिंग',
    badgeClass: 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40',
    dotClass: 'bg-orange-400',
  },
  'Output Entered': {
    en: 'Awaiting Verification',
    hi: 'सत्यापन प्रतीक्षित',
    badgeClass: 'bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40',
    dotClass: 'bg-purple-400',
  },
  Closed: {
    en: 'Closed',
    hi: 'बंद',
    badgeClass: 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/50',
    dotClass: 'bg-emerald-400',
  },
  Cancelled: {
    en: 'Cancelled',
    hi: 'रद्द',
    badgeClass: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40',
    dotClass: 'bg-rose-400',
  },
}
