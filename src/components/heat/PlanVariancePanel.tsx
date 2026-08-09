import { BilingualText } from '../ui/BilingualText'

interface PlanVariancePanelProps {
  variance: Array<{
    material_code: string
    planned_kg: number
    actual_kg: number
    flag: 'in_spec' | 'out_of_spec'
  }>
}

export function PlanVariancePanel({ variance }: PlanVariancePanelProps) {
  if (variance.length === 0) return null

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText
        as="h3"
        en="Plan vs Actual"
        hi="योजना बनाम वास्तविक"
        className="text-lg font-bold text-slate-100"
      />
      <p className="mt-1 text-sm text-slate-400">
        Advisory only · केवल सलाह
      </p>
      <ul className="mt-4 space-y-2">
        {variance.map((row) => {
          const inSpec = row.flag === 'in_spec'
          return (
            <li
              key={row.material_code}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                inSpec ? 'bg-emerald-950/40 border border-emerald-500/30' : 'bg-red-950/40 border border-red-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  inSpec ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
                }`}>
                  {inSpec ? '✓' : '✕'}
                </span>
                <span className="font-medium">{row.material_code}</span>
              </div>
              <span className="text-sm">
                Plan {row.planned_kg} kg · Actual {row.actual_kg.toFixed(1)} kg
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
