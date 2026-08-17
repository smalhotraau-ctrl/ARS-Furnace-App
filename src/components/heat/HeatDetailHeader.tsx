import type { ReactNode } from 'react'
import type { Heat } from '../../types/heat'
import { HeatStatusBadge } from './HeatStatusBadge'

interface HeatDetailHeaderProps {
  heat: Heat
  action?: ReactNode
}

export function HeatDetailHeader({ heat, action }: HeatDetailHeaderProps) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-2xl font-bold text-emerald-400">{heat.heat_no}</p>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          <HeatStatusBadge status={heat.status} />
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {heat.furnace_code} · {heat.grade_code}
      </p>
    </section>
  )
}
