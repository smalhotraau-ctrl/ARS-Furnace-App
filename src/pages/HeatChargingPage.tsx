import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ChargeLineForm, ChargeLineList } from '../components/heat/ChargeLineForm'
import { CycleStageGrid } from '../components/heat/CycleStageGrid'
import { HeatDetailHeader } from '../components/heat/HeatDetailHeader'
import { DownloadHeatSheetButton } from '../components/heat/DownloadHeatSheetButton'
import { HeatList } from '../components/heat/HeatList'
import { MakerCheckerForms } from '../components/heat/MakerCheckerForms'
import { PlanVariancePanel } from '../components/heat/PlanVariancePanel'
import { StartHeatForm } from '../components/heat/StartHeatForm'
import { TempReadingForm } from '../components/heat/TempReadingForm'
import { TempReadingsList } from '../components/heat/TempReadingsList'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { BilingualText } from '../components/ui/BilingualText'
import { useLanguage } from '../context/LanguageContext'
import { fetchGradeCodes } from '../lib/batchPlanService'
import {
  addChargeLine,
  addTempReading,
  computePlanVariance,
  decideCancelRequest,
  decideHeatNoCorrection,
  fetchActiveMaterials,
  fetchBatchPlansForHeat,
  fetchCancelRequests,
  fetchChargeLines,
  fetchCycleLog,
  fetchHeatNoCorrections,
  fetchHeats,
  fetchMainFurnacesForHeat,
  fetchTempReadings,
  finishCycleStage,
  getHeatPendingCount,
  getHeatSyncErrors,
  loadLocalChargeLines,
  loadLocalCycleLog,
  loadLocalHeats,
  loadLocalTempReadings,
  startCycleStage,
  startHeat,
  submitCancelRequest,
  submitHeatNoCorrection,
  syncHeatQueue,
} from '../lib/heatService'
import { floorWorkerPageClass } from '../lib/pageLayout'
import { heatStatusForCycleStage, shouldAdvanceHeatStatus } from '../lib/heatStatus'
import type { BatchPlan, FurnaceOption, MaterialOption } from '../types/batchPlan'
import type { ChargeLine, CycleLogEntry, Heat, TempReading } from '../types/heat'
import { isActiveHeat } from '../types/heat'

// Charging and Cycle Log were previously two separate screens/tabs. Per the
// updated 03d note, they are now one combined screen: Start New Heat when
// there's no active heat, then one view combining the cycle-tap grid and
// charge-line entry for the active heat. Access rules are unchanged —
// Supervisor enters both, QA has view-only access to charging (no access to
// cycle/temps), Plant Head/Owner view both.
export function HeatChargingPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  const [heats, setHeats] = useState<Heat[]>(() => loadLocalHeats())
  const [selectedHeat, setSelectedHeat] = useState<Heat | null>(null)
  const [chargeLines, setChargeLines] = useState<ChargeLine[]>([])
  const [cycleEntries, setCycleEntries] = useState<CycleLogEntry[]>([])
  const [tempReadings, setTempReadings] = useState<TempReading[]>([])
  const [furnaces, setFurnaces] = useState<FurnaceOption[]>([])
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [gradeCodes, setGradeCodes] = useState<string[]>([])
  const [batchPlans, setBatchPlans] = useState<BatchPlan[]>([])
  const [pendingCancels, setPendingCancels] = useState<Array<{ id: string; heat_id: string; reason: string }>>([])
  const [pendingCorrections, setPendingCorrections] = useState<
    Array<{ id: string; heat_id: string; original_heat_no: string; requested_heat_no: string; reason: string }>
  >([])
  const [showHistory, setShowHistory] = useState(false)
  const [savedVisible, setSavedVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingUploads, setPendingUploads] = useState(getHeatPendingCount())
  const [syncErrors, setSyncErrors] = useState(getHeatSyncErrors())

  const canStartAndCharge = role === 'supervisor'
  const canViewCharging = role === 'supervisor' || role === 'qa' || role === 'plant_head' || role === 'admin_owner'
  const canViewCycle = role === 'supervisor' || role === 'plant_head' || role === 'admin_owner'
  const canRequestCancel = role === 'plant_head'
  const canRequestCorrection = role === 'plant_head'
  const canDecide = role === 'admin_owner'
  const showPendingIndicator = role === 'plant_head' || role === 'admin_owner'

  const linkedPlan = useMemo(
    () => batchPlans.find((p) => p.id === selectedHeat?.batch_plan_id) ?? null,
    [batchPlans, selectedHeat],
  )
  const linkedPlanIds = useMemo(
    () => new Set(heats.map((h) => h.batch_plan_id).filter((id): id is string => Boolean(id))),
    [heats],
  )

  const variance = useMemo(
    () => computePlanVariance(linkedPlan, chargeLines),
    [linkedPlan, chargeLines],
  )

  const refreshData = useCallback(async () => {
    try {
      if (navigator.onLine) await syncHeatQueue()
      setPendingUploads(getHeatPendingCount())
      setSyncErrors(getHeatSyncErrors())
      const [nextHeats, nextFurnaces, nextMaterials, nextGradeCodes, nextPlans] = await Promise.all([
        navigator.onLine ? fetchHeats() : Promise.resolve(loadLocalHeats()),
        fetchMainFurnacesForHeat().catch(() => []),
        fetchActiveMaterials().catch(() => []),
        fetchGradeCodes().catch(() => []),
        fetchBatchPlansForHeat().catch(() => []),
      ])
      setHeats(nextHeats)
      setFurnaces(nextFurnaces)
      setMaterials(nextMaterials)
      setGradeCodes(nextGradeCodes)
      setBatchPlans(nextPlans)

      if (canDecide && navigator.onLine) {
        const [cancels, corrections] = await Promise.all([
          fetchCancelRequests().catch(() => []),
          fetchHeatNoCorrections().catch(() => []),
        ])
        setPendingCancels(cancels.filter((r) => r.status === 'pending'))
        setPendingCorrections(corrections.filter((r) => r.status === 'pending'))
      }
      setPendingUploads(getHeatPendingCount())
      setSyncErrors(getHeatSyncErrors())
    } catch {
      setHeats(loadLocalHeats())
      setPendingUploads(getHeatPendingCount())
      setSyncErrors(getHeatSyncErrors())
    } finally {
      setLoading(false)
    }
  }, [canDecide])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  // Without this, a request/entry queued while offline (e.g. a Plant Head's cancel request
  // submitted with no connection) only ever gets a chance to sync on the next full remount of
  // this page — it can sit invisibly stuck in local storage indefinitely otherwise, which is
  // why an approved-looking submission can fail to ever reach the Owner's approval queue.
  useEffect(() => {
    function handleOnline() {
      void refreshData()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshData])

  useEffect(() => {
    if (!selectedHeat) return
    const updated = heats.find((h) => h.id === selectedHeat.id)
    if (
      updated &&
      (updated.status !== selectedHeat.status ||
        updated.heat_no !== selectedHeat.heat_no ||
        updated.updated_at !== selectedHeat.updated_at)
    ) {
      setSelectedHeat(updated)
    }
  }, [heats, selectedHeat])

  useEffect(() => {
    async function loadHeatDetail() {
      if (!selectedHeat) {
        setChargeLines([])
        setCycleEntries([])
        setTempReadings([])
        return
      }
      // Render whatever's already cached immediately, before any network round-trip. cycle_log
      // is permanent/immutable — if a fetch fails (offline, a flaky floor connection) and we fell
      // back to an empty list instead of the last known state, an already-started or already-
      // finished stage would flash as "not started", inviting a second Start tap that creates a
      // duplicate row for the same stage. Same risk applies to charge lines/temp readings, so all
      // three now fall back to cache instead of blank on failure.
      setChargeLines(loadLocalChargeLines(selectedHeat.id))
      setCycleEntries(loadLocalCycleLog(selectedHeat.id))
      setTempReadings(loadLocalTempReadings(selectedHeat.id))

      const [lines, entries, readings] = await Promise.all([
        navigator.onLine
          ? fetchChargeLines(selectedHeat.id).catch(() => loadLocalChargeLines(selectedHeat.id))
          : Promise.resolve(loadLocalChargeLines(selectedHeat.id)),
        navigator.onLine
          ? fetchCycleLog(selectedHeat.id).catch(() => loadLocalCycleLog(selectedHeat.id))
          : Promise.resolve(loadLocalCycleLog(selectedHeat.id)),
        navigator.onLine
          ? fetchTempReadings(selectedHeat.id).catch(() => loadLocalTempReadings(selectedHeat.id))
          : Promise.resolve(loadLocalTempReadings(selectedHeat.id)),
      ])
      setChargeLines(lines)
      setCycleEntries(entries)
      setTempReadings(readings)
    }
    void loadHeatDetail()
  }, [selectedHeat])

  function showSaved() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  async function flushSyncState() {
    await syncHeatQueue()
    setPendingUploads(getHeatPendingCount())
    setSyncErrors(getHeatSyncErrors())
  }

  if (!canViewCharging) return null

  const activeSelected = Boolean(selectedHeat && isActiveHeat(selectedHeat.status))

  const activeHeats = heats.filter((h) => isActiveHeat(h.status))
  const historyHeats = heats.filter((h) => h.status === 'Closed' || h.status === 'Cancelled')
  const listHeats = showHistory ? historyHeats : activeHeats

  return (
    <div className={floorWorkerPageClass(role)}>
      <BilingualText as="h1" en="Heat Charging & Cycle Log" hi="हीट चार्जिंग व साइकिल लॉग" className="text-3xl font-bold" />

      {showPendingIndicator && pendingUploads > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          {t(`${pendingUploads} entries pending upload`, `${pendingUploads} प्रविष्टियाँ अपलोड बाकी`)}
        </p>
      )}

      {syncErrors.length > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          <p className="font-semibold">{t('Some entries failed to save', 'कुछ प्रविष्टियाँ सहेजी नहीं गईं')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {syncErrors.slice(0, 3).map((err) => (
              <li key={`${err.at}-${err.action}`}>{err.message}</li>
            ))}
          </ul>
          {syncErrors.length > 3 && (
            <p className="mt-2 text-red-300">{t(`+ ${syncErrors.length - 3} more`, `+ ${syncErrors.length - 3} और`)}</p>
          )}
        </div>
      )}

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      {/* Pending approvals are surfaced immediately at the top of the page for Owner — not
          buried below the heat list/detail — since this is the maker-checker queue that gates
          heat cancellation and heat-number corrections (03b §3). */}
      {canDecide && (pendingCancels.length > 0 || pendingCorrections.length > 0) && (
        <MakerCheckerForms
          heat={null}
          canRequestCancel={false}
          canRequestCorrection={false}
          canDecide
          pendingCancels={pendingCancels}
          pendingCorrections={pendingCorrections}
          onCancelRequest={async () => {}}
          onCorrectionRequest={async () => {}}
          onDecideCancel={async (requestId, approve, note) => {
            const req = pendingCancels.find((r) => r.id === requestId)
            if (!req) return
            await decideCancelRequest(user!, requestId, req.heat_id, approve, note)
            showSaved()
            void refreshData()
          }}
          onDecideCorrection={async (requestId, approve) => {
            const req = pendingCorrections.find((r) => r.id === requestId)
            if (!req) return
            await decideHeatNoCorrection(user!, requestId, req.heat_id, req.requested_heat_no, approve)
            showSaved()
            void refreshData()
          }}
        />
      )}

      {canStartAndCharge && (
        <StartHeatForm
          furnaces={furnaces}
          batchPlans={batchPlans}
          linkedPlanIds={linkedPlanIds}
          gradeCodes={gradeCodes}
          onStart={async (values) => {
            const result = await startHeat(user!, values, heats)
            if (result.error) return { error: result.error }
            setHeats((prev) => [result.heat, ...prev])
            setSelectedHeat(result.heat)
            await flushSyncState()
            showSaved()
            return {}
          }}
        />
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <BilingualText as="h2" en="Heats" hi="हीट्स" className="text-lg font-semibold" />
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="min-h-10 rounded-xl border border-slate-600 px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
          >
            {showHistory
              ? t('Show active heats', 'सक्रिय हीट दिखाएँ')
              : t('View history', 'इतिहास देखें')}
          </button>
        </div>
        <HeatList
          heats={listHeats}
          selectedId={selectedHeat?.id ?? null}
          onSelect={setSelectedHeat}
          emptyLabelEn={showHistory ? 'No closed or cancelled heats' : 'No active heats'}
          emptyLabelHi={showHistory ? 'कोई बंद या रद्द हीट नहीं' : 'कोई सक्रिय हीट नहीं'}
        />
      </div>

      {selectedHeat && (
        <>
          <HeatDetailHeader
            heat={selectedHeat}
            action={
              <DownloadHeatSheetButton
                heat={selectedHeat}
                chargeLines={chargeLines}
                cycleEntries={cycleEntries}
                tempReadings={tempReadings}
              />
            }
          />

          {activeSelected && canViewCycle && (
            <>
              <CycleStageGrid
                entries={cycleEntries}
                disabled={!canStartAndCharge}
                onStart={async (stage) => {
                  const entry = await startCycleStage(user!, selectedHeat.id, stage)
                  const nextStatus = heatStatusForCycleStage(stage)
                  setCycleEntries((prev) => [...prev, entry])
                  setHeats((prev) =>
                    prev.map((h) => {
                      if (h.id !== selectedHeat.id) return h
                      return shouldAdvanceHeatStatus(h.status, nextStatus) ? { ...h, status: nextStatus } : h
                    }),
                  )
                  setSelectedHeat((prev) => {
                    if (!prev) return null
                    return shouldAdvanceHeatStatus(prev.status, nextStatus) ? { ...prev, status: nextStatus } : prev
                  })
                  await flushSyncState()
                  showSaved()
                }}
                onFinish={async (entry) => {
                  const updated = await finishCycleStage(entry)
                  setCycleEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
                  await flushSyncState()
                  showSaved()
                }}
              />

              {canStartAndCharge && (
                <TempReadingForm
                  onSubmit={async (values) => {
                    const reading = await addTempReading(user!, { ...values, heat_id: selectedHeat.id })
                    setTempReadings((prev) => [reading, ...prev])
                    await flushSyncState()
                    showSaved()
                  }}
                />
              )}

              <TempReadingsList readings={tempReadings} />
            </>
          )}

          {canStartAndCharge && activeSelected && (
            <ChargeLineForm
              materials={materials}
              onSubmit={async (values) => {
                const line = await addChargeLine(user!, { ...values, heat_id: selectedHeat.id })
                setChargeLines((prev) => [line, ...prev])
                setHeats((prev) =>
                  prev.map((h) =>
                    h.id === selectedHeat.id ? { ...h, status: h.status === 'Planned' ? 'Charging' : h.status } : h,
                  ),
                )
                setSelectedHeat((prev) =>
                  prev && prev.status === 'Planned' ? { ...prev, status: 'Charging' } : prev,
                )
                await flushSyncState()
                showSaved()
              }}
            />
          )}

          <div>
            <BilingualText as="h3" en="Charge Lines" hi="चार्ज पंक्तियाँ" className="mb-2 font-semibold" />
            <ChargeLineList lines={chargeLines} />
          </div>

          <PlanVariancePanel variance={variance} />

          <MakerCheckerForms
            heat={selectedHeat}
            canRequestCancel={canRequestCancel}
            canRequestCorrection={canRequestCorrection}
            canDecide={canDecide}
            pendingCancels={pendingCancels.filter((r) => r.heat_id === selectedHeat.id)}
            pendingCorrections={pendingCorrections.filter((r) => r.heat_id === selectedHeat.id)}
            onCancelRequest={async (reason) => {
              await submitCancelRequest(user!, selectedHeat.id, reason)
              showSaved()
              void refreshData()
            }}
            onCorrectionRequest={async (requestedHeatNo, reason) => {
              await submitHeatNoCorrection(user!, selectedHeat.id, selectedHeat.heat_no, requestedHeatNo, reason)
              showSaved()
              void refreshData()
            }}
            onDecideCancel={async (requestId, approve, note) => {
              await decideCancelRequest(user!, requestId, selectedHeat.id, approve, note)
              showSaved()
              void refreshData()
            }}
            onDecideCorrection={async (requestId, approve) => {
              const req = pendingCorrections.find((r) => r.id === requestId)
              if (!req) return
              await decideHeatNoCorrection(user!, requestId, req.heat_id, req.requested_heat_no, approve)
              showSaved()
              void refreshData()
            }}
          />
        </>
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
