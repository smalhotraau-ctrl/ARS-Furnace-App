import type { BatchPlan } from '../../types/batchPlan'
import type { Dispatch } from '../../types/dispatch'
import type { Heat, HeatCancelRequest, HeatNoCorrection } from '../../types/heat'
import { isActiveHeat } from '../../types/heat'
import type { MasterAdminChangeRequest } from '../../types/masterAdmin'
import { MASTER_ADMIN_TABLE_LABELS } from '../../types/masterAdmin'
import type { HeatOutput, HeatOutputFlag } from '../../types/output'
import type { UserChangeRequest } from '../../types/userManagement'
import { aggregateRecovery } from '../../lib/dashboardService'
import type { PlanVarianceFlag } from '../../lib/heatService'
import { PlanVarianceExceptionsPanel } from '../heat/PlanVarianceExceptionsPanel'
import { YieldExceptionsPanel } from '../heat/YieldExceptionsPanel'
import { HeatStatusBadge } from '../heat/HeatStatusBadge'
import { BilingualText } from '../ui/BilingualText'
import { StatCard } from './StatCard'
import { useLanguage } from '../../context/LanguageContext'

interface PlantDashboardProps {
  role: 'plant_head' | 'admin_owner'
  heats: Heat[]
  yieldFlags: HeatOutputFlag[]
  planVarianceFlags: PlanVarianceFlag[]
  todaysOutputs: HeatOutput[]
  dispatchShortages: Dispatch[]
  batchPlansAwaitingReview: BatchPlan[]
  cancelRequests: HeatCancelRequest[]
  heatNoCorrections: HeatNoCorrection[]
  changeRequests: MasterAdminChangeRequest[]
  userChangeRequests: UserChangeRequest[]
  onAcknowledgeYieldFlag: (flag: HeatOutputFlag, note: string | null) => Promise<void>
}

function heatNoFor(heatId: string, heats: Heat[]): string {
  return heats.find((h) => h.id === heatId)?.heat_no ?? heatId
}

export function PlantDashboard({
  role,
  heats,
  yieldFlags,
  planVarianceFlags,
  todaysOutputs,
  dispatchShortages,
  batchPlansAwaitingReview,
  cancelRequests,
  heatNoCorrections,
  changeRequests,
  userChangeRequests,
  onAcknowledgeYieldFlag,
}: PlantDashboardProps) {
  const { t } = useLanguage()
  const isOwner = role === 'admin_owner'

  const activeHeats = heats.filter((h) => isActiveHeat(h.status))
  const recovery = aggregateRecovery(todaysOutputs)

  const pendingCancels = cancelRequests.filter((r) => r.status === 'pending')
  const pendingCorrections = heatNoCorrections.filter((r) => r.status === 'pending')
  const pendingChanges = changeRequests.filter((r) => r.status === 'pending')
  const pendingUserChanges = userChangeRequests.filter((r) => r.status === 'pending')
  const pendingMasterAdmin = pendingChanges.filter((r) => r.target_table !== 'rate_master' && r.target_table !== 'heat_costing')
  const pendingRateOverrides = pendingChanges.filter((r) => r.target_table === 'rate_master' || r.target_table === 'heat_costing')

  const totalPendingApprovals =
    pendingCancels.length +
    pendingCorrections.length +
    pendingChanges.length +
    (isOwner ? pendingUserChanges.length : 0)

  return (
    <div className="space-y-6">
      <YieldExceptionsPanel
        variant="hero"
        flags={yieldFlags}
        heats={heats}
        onAcknowledge={onAcknowledgeYieldFlag}
      />

      <PlanVarianceExceptionsPanel flags={planVarianceFlags} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard labelEn="Heats in progress" labelHi="प्रगति में हीट" value={activeHeats.length} tone="info" />
        <StatCard
          labelEn="Outputs recorded today"
          labelHi="आज दर्ज आउटपुट"
          value={todaysOutputs.length}
          tone="success"
        />
        <StatCard
          labelEn="Dispatch shortages"
          labelHi="डिस्पैच कमी"
          value={dispatchShortages.length}
          tone={dispatchShortages.length > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          labelEn="Pending approvals"
          labelHi="लंबित स्वीकृतियाँ"
          value={totalPendingApprovals}
          tone={totalPendingApprovals > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <BilingualText
            as="h2"
            en="Heats in progress"
            hi="प्रगति में हीट"
            className="text-lg font-bold text-slate-100"
          />
          {activeHeats.length === 0 ? (
            <p className="text-sm text-slate-400">{t('No active heats.', 'कोई सक्रिय हीट नहीं।')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-2 pr-3 font-semibold">{t('Heat', 'हीट')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('Furnace', 'फर्नेस')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('Grade', 'ग्रेड')}</th>
                    <th className="py-2 font-semibold">{t('Status', 'स्थिति')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeHeats.map((heat) => (
                    <tr key={heat.id} className="border-b border-slate-800/80">
                      <td className="py-2 pr-3 font-semibold text-slate-100">{heat.heat_no}</td>
                      <td className="py-2 pr-3 text-slate-300">{heat.furnace_code}</td>
                      <td className="py-2 pr-3 text-slate-300">{heat.grade_code}</td>
                      <td className="py-2">
                        <HeatStatusBadge status={heat.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <BilingualText
            as="h2"
            en="Today's recovery"
            hi="आज की रिकवरी"
            className="text-lg font-bold text-slate-100"
          />
          {!recovery ? (
            <p className="text-sm text-slate-400">{t('No outputs recorded today yet.', 'आज अभी कोई आउटपुट दर्ज नहीं।')}</p>
          ) : (
            <>
              <p className="text-sm text-slate-400">
                {recovery.heatCount} {t('heats', 'हीट')}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(
                  [
                    ['Ingot', 'इंगट', recovery.ingot_kg, recovery.ingot_pct],
                    ['Dross', 'ड्रॉस', recovery.dross_kg, recovery.dross_pct],
                    ['Rejection', 'रिजेक्शन', recovery.rejection_kg, recovery.rejection_pct],
                    ['Iron', 'आयरन', recovery.iron_kg, recovery.iron_pct],
                    ['Burn Loss', 'बर्न लॉस', recovery.burn_loss_kg, recovery.burn_loss_pct],
                  ] as const
                ).map(([en, hi, kg, pct]) => (
                  <div key={en} className="rounded-lg bg-slate-900/60 p-2 text-center">
                    <p className="text-xs text-slate-400">{t(en, hi)}</p>
                    <p className="font-bold text-slate-100">{kg.toFixed(0)} kg</p>
                    <p className="text-xs text-emerald-400">{pct.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <BilingualText
            as="h2"
            en="Pending dispatch shortages"
            hi="लंबित डिस्पैच कमी"
            className="text-lg font-bold text-slate-100"
          />
          {dispatchShortages.length === 0 ? (
            <p className="text-sm text-slate-400">{t('No shortages reported.', 'कोई कमी दर्ज नहीं।')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {dispatchShortages.slice(0, 10).map((d) => (
                <li key={d.id} className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2">
                  <p className="font-semibold text-amber-100">{d.party_name}</p>
                  <p className="text-amber-200/80">
                    {d.invoice_no} · {d.shortage_kg?.toFixed(0)} kg
                    {d.shortage_reported_date ? ` (${d.shortage_reported_date})` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <BilingualText
            as="h2"
            en="Open approval requests"
            hi="खुले स्वीकृति अनुरोध"
            className="text-lg font-bold text-slate-100"
          />
          {totalPendingApprovals === 0 ? (
            <p className="text-sm text-slate-400">{t('No pending approvals.', 'कोई लंबित स्वीकृति नहीं।')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingCancels.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2">
                  <p className="font-semibold text-slate-100">
                    {t('Heat cancellation', 'हीट रद्दीकरण')} · {heatNoFor(r.heat_id, heats)}
                  </p>
                </li>
              ))}
              {pendingCorrections.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2">
                  <p className="font-semibold text-slate-100">
                    {t('Heat no. correction', 'हीट नं. सुधार')} · {r.original_heat_no} → {r.requested_heat_no}
                  </p>
                </li>
              ))}
              {pendingRateOverrides.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2">
                  <p className="font-semibold text-slate-100">
                    {t('Rate override', 'रेट ओवरराइड')} ·{' '}
                    {t(MASTER_ADMIN_TABLE_LABELS[r.target_table].en, MASTER_ADMIN_TABLE_LABELS[r.target_table].hi)}
                  </p>
                </li>
              ))}
              {pendingMasterAdmin.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2">
                  <p className="font-semibold text-slate-100">
                    {t('Master Admin change', 'मास्टर एडमिन बदलाव')} ·{' '}
                    {t(MASTER_ADMIN_TABLE_LABELS[r.target_table].en, MASTER_ADMIN_TABLE_LABELS[r.target_table].hi)}
                  </p>
                </li>
              ))}
              {isOwner &&
                pendingUserChanges.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2">
                    <p className="font-semibold text-slate-100">
                      {t('User management', 'उपयोगकर्ता प्रबंधन')} · {r.action}
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      {isOwner && (
        <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/40 p-4">
          <BilingualText
            as="h2"
            en="Batch plans awaiting review"
            hi="समीक्षा प्रतीक्षित बैच योजनाएँ"
            className="text-lg font-bold text-slate-100"
          />
          {batchPlansAwaitingReview.length === 0 ? (
            <p className="text-sm text-slate-400">{t('All batch plans reviewed.', 'सभी बैच योजनाएँ समीक्षित।')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {batchPlansAwaitingReview.map((plan) => (
                <li key={plan.id} className="rounded-lg border border-purple-500/40 bg-purple-950/20 px-3 py-2">
                  <p className="font-semibold text-purple-100">
                    {plan.grade_code} · {plan.plan_date}
                  </p>
                  <p className="text-purple-200/70">{new Date(plan.created_at).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
