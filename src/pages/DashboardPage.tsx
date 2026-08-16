import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from '../components/ui/BilingualText'
import { PlantDashboard } from '../components/dashboard/PlantDashboard'
import { QADashboard } from '../components/dashboard/QADashboard'
import { SupervisorDashboard } from '../components/dashboard/SupervisorDashboard'
import { fetchBatchPlans, loadLocalBatchPlans } from '../lib/batchPlanService'
import { startOfTodayIso } from '../lib/dashboardService'
import { fetchDispatches, loadLocalDispatches } from '../lib/dispatchService'
import {
  fetchCancelRequests,
  fetchHeatNoCorrections,
  fetchHeats,
  fetchMainFurnacesForHeat,
  loadLocalHeats,
} from '../lib/heatService'
import { fetchChangeRequests } from '../lib/masterAdminService'
import {
  acknowledgeYieldFlag,
  fetchHeatOutputsSince,
  fetchOpenYieldFlags,
} from '../lib/outputService'
import { fetchPitHeats, loadLocalPitHeats } from '../lib/pitFurnaceService'
import { isCompositionOutOfSpec } from '../lib/spectroCalc'
import { fetchHeatsForSpectro, fetchSpectroReports } from '../lib/spectroService'
import { fetchUserChangeRequests } from '../lib/userManagementService'
import type { BatchPlan, FurnaceOption } from '../types/batchPlan'
import type { Dispatch } from '../types/dispatch'
import type { Heat, HeatCancelRequest, HeatNoCorrection } from '../types/heat'
import { isActiveHeat } from '../types/heat'
import type { MasterAdminChangeRequest } from '../types/masterAdmin'
import type { HeatOutput, HeatOutputFlag } from '../types/output'
import type { PitHeat } from '../types/pitFurnace'
import { isCompositionComplete } from '../types/pitFurnace'
import type { SpectroReport } from '../types/spectro'
import type { UserChangeRequest } from '../types/userManagement'

export function DashboardPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [heats, setHeats] = useState<Heat[]>(() => loadLocalHeats())
  const [furnaces, setFurnaces] = useState<FurnaceOption[]>([])
  const [reports, setReports] = useState<SpectroReport[]>([])
  const [pitHeats, setPitHeats] = useState<PitHeat[]>(() => loadLocalPitHeats())
  const [yieldFlags, setYieldFlags] = useState<HeatOutputFlag[]>([])
  const [todaysOutputs, setTodaysOutputs] = useState<HeatOutput[]>([])
  const [dispatches, setDispatches] = useState<Dispatch[]>(() => loadLocalDispatches())
  const [batchPlans, setBatchPlans] = useState<BatchPlan[]>(() => loadLocalBatchPlans())
  const [cancelRequests, setCancelRequests] = useState<HeatCancelRequest[]>([])
  const [heatNoCorrections, setHeatNoCorrections] = useState<HeatNoCorrection[]>([])
  const [changeRequests, setChangeRequests] = useState<MasterAdminChangeRequest[]>([])
  const [userChangeRequests, setUserChangeRequests] = useState<UserChangeRequest[]>([])

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const todayStart = startOfTodayIso()

      if (role === 'supervisor') {
        const [nextHeats, nextFurnaces] = await Promise.all([
          navigator.onLine ? fetchHeats() : Promise.resolve(loadLocalHeats()),
          fetchMainFurnacesForHeat(),
        ])
        setHeats(nextHeats)
        setFurnaces(nextFurnaces)
        return
      }

      if (role === 'qa') {
        const [nextReports, nextPitHeats, nextHeats] = await Promise.all([
          fetchSpectroReports(),
          navigator.onLine ? fetchPitHeats() : Promise.resolve(loadLocalPitHeats()),
          fetchHeatsForSpectro(),
        ])
        setReports(nextReports)
        setPitHeats(nextPitHeats)
        setHeats(nextHeats)
        return
      }

      const isOwner = role === 'admin_owner'
      const [
        nextHeats,
        nextFlags,
        nextOutputs,
        nextDispatches,
        nextCancels,
        nextCorrections,
        nextChanges,
        nextBatchPlans,
        nextUserChanges,
      ] = await Promise.all([
        navigator.onLine ? fetchHeats() : Promise.resolve(loadLocalHeats()),
        fetchOpenYieldFlags(),
        fetchHeatOutputsSince(todayStart),
        navigator.onLine ? fetchDispatches() : Promise.resolve(loadLocalDispatches()),
        fetchCancelRequests().catch(() => []),
        fetchHeatNoCorrections().catch(() => []),
        fetchChangeRequests().catch(() => []),
        isOwner
          ? navigator.onLine
            ? fetchBatchPlans()
            : Promise.resolve(loadLocalBatchPlans())
          : Promise.resolve([]),
        isOwner ? fetchUserChangeRequests().catch(() => []) : Promise.resolve([]),
      ])

      setHeats(nextHeats)
      setYieldFlags(nextFlags)
      setTodaysOutputs(nextOutputs)
      setDispatches(nextDispatches)
      setCancelRequests(nextCancels)
      setHeatNoCorrections(nextCorrections)
      setChangeRequests(nextChanges)
      setBatchPlans(nextBatchPlans)
      setUserChangeRequests(nextUserChanges)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const heatById = new Map(heats.map((h) => [h.id, h]))

  const flaggedReports = reports
    .filter((r) => r.composition.some((e) => isCompositionOutOfSpec(e)))
    .map((r) => ({ report: r, heatNo: heatById.get(r.heat_id)?.heat_no ?? r.heat_id }))

  const pitQualityPending = pitHeats.filter((h) => !isCompositionComplete(h.composition))

  const activeHeatIds = new Set(heats.filter((h) => isActiveHeat(h.status)).map((h) => h.id))
  const spectroQueue = reports
    .filter((r) => activeHeatIds.has(r.heat_id))
    .map((r) => ({ report: r, heatNo: heatById.get(r.heat_id)?.heat_no ?? r.heat_id }))

  const dispatchShortages = dispatches.filter((d) => d.shortage_kg != null && d.shortage_kg > 0)
  const batchPlansAwaitingReview = batchPlans.filter((p) => !p.owner_reviewed)

  const isPlantRole = role === 'plant_head' || role === 'admin_owner'
  const layoutClass = isPlantRole ? 'mx-auto max-w-3xl space-y-6 px-4 py-6 lg:max-w-6xl' : 'mx-auto max-w-3xl space-y-6 px-4 py-6'

  return (
    <div className={layoutClass}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <BilingualText as="h1" en="Dashboard" hi="डैशबोर्ड" className="text-3xl font-bold text-slate-100" />
          <p className="text-sm text-slate-400">
            {role === 'supervisor' &&
              t("Today's furnace status at a glance.", 'आज की फर्नेस स्थिति एक नज़र में।')}
            {role === 'qa' && t('Quality flags and spectro queue.', 'गुणवत्ता फ्लैग और स्पेक्ट्रो कतार।')}
            {isPlantRole && t('Full plant overview.', 'पूर्ण संयंत्र अवलोकन।')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="min-h-11 rounded-xl border border-slate-600 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
        >
          {t('Refresh', 'रीफ़्रेश')}
        </button>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm text-red-200">{error}</p>
      )}

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      {!loading && role === 'supervisor' && <SupervisorDashboard furnaces={furnaces} heats={heats} />}

      {!loading && role === 'qa' && (
        <QADashboard flaggedReports={flaggedReports} pitQualityPending={pitQualityPending} spectroQueue={spectroQueue} />
      )}

      {!loading && isPlantRole && (
        <PlantDashboard
          role={role}
          heats={heats}
          yieldFlags={yieldFlags}
          todaysOutputs={todaysOutputs}
          dispatchShortages={dispatchShortages}
          batchPlansAwaitingReview={batchPlansAwaitingReview}
          cancelRequests={cancelRequests}
          heatNoCorrections={heatNoCorrections}
          changeRequests={changeRequests}
          userChangeRequests={userChangeRequests}
          onAcknowledgeYieldFlag={async (flag, note) => {
            await acknowledgeYieldFlag(user!, flag, note)
            setYieldFlags((prev) => prev.filter((f) => f.id !== flag.id))
          }}
        />
      )}
    </div>
  )
}
