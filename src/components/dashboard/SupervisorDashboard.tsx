import type { FurnaceOption } from '../../types/batchPlan'
import type { Heat } from '../../types/heat'
import { isActiveHeat } from '../../types/heat'
import { getActiveHeatForFurnace } from '../../lib/heatService'
import { isToday } from '../../lib/dashboardService'
import { HeatStatusBadge } from '../heat/HeatStatusBadge'
import { BilingualText } from '../ui/BilingualText'
import { StatCard } from './StatCard'
import { useLanguage } from '../../context/LanguageContext'

interface SupervisorDashboardProps {
  furnaces: FurnaceOption[]
  heats: Heat[]
}

export function SupervisorDashboard({ furnaces, heats }: SupervisorDashboardProps) {
  const { t } = useLanguage()

  const activeHeats = heats.filter((h) => isActiveHeat(h.status))
  const chargingNow = heats.filter((h) => ['Charging', 'Melting', 'Casting'].includes(h.status))
  const awaitingOutput = heats.filter((h) => h.status === 'Output Entered')
  const closedToday = heats.filter((h) => h.status === 'Closed' && isToday(h.updated_at ?? h.created_at))

  return (
    <div className="space-y-6">
      <StatCard
        labelEn="Heats in progress"
        labelHi="प्रगति में हीट"
        value={activeHeats.length}
        tone="info"
        sublabelEn={`${chargingNow.length} charging / melting / casting`}
        sublabelHi={`${chargingNow.length} चार्जिंग / मेल्टिंग / कास्टिंग`}
      />

      <section className="space-y-3">
        <BilingualText
          as="h2"
          en="Your furnaces"
          hi="आपकी फर्नेस"
          className="text-lg font-bold text-slate-200"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {furnaces.map((furnace) => {
            const active = getActiveHeatForFurnace(furnace.code, heats)
            return (
              <div
                key={furnace.code}
                className={`rounded-2xl border-2 p-4 ${
                  active ? 'border-sky-500/70 bg-sky-950/30' : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xl font-extrabold text-slate-100">{furnace.code}</p>
                    <p className="text-sm text-slate-400">{furnace.name}</p>
                  </div>
                  <span
                    className={`inline-flex h-3 w-3 rounded-full ${active ? 'bg-sky-400 ring-4 ring-sky-400/30' : 'bg-slate-600'}`}
                    aria-hidden
                  />
                </div>
                {active ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-2xl font-bold text-sky-100">{active.heat_no}</p>
                    <HeatStatusBadge status={active.status} />
                    <p className="text-sm text-slate-300">{active.grade_code}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-lg font-semibold text-slate-500">{t('Idle', 'खाली')}</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        <BilingualText as="h2" en="Today" hi="आज" className="text-lg font-bold text-slate-200" />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard labelEn="Charging now" labelHi="अभी चार्जिंग" value={chargingNow.length} tone="info" />
          <StatCard
            labelEn="Awaiting output"
            labelHi="आउटपुट प्रतीक्षित"
            value={awaitingOutput.length}
            tone="warning"
          />
          <StatCard labelEn="Closed today" labelHi="आज बंद" value={closedToday.length} tone="success" />
        </div>
      </section>
    </div>
  )
}
