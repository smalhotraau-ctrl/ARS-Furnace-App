import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ChargeLineForm, ChargeLineList } from '../components/heat/ChargeLineForm'
import { CycleStageGrid } from '../components/heat/CycleStageGrid'
import { HeatList } from '../components/heat/HeatList'
import { MakerCheckerForms } from '../components/heat/MakerCheckerForms'
import { PlanVariancePanel } from '../components/heat/PlanVariancePanel'
import { StartHeatForm } from '../components/heat/StartHeatForm'
import { TempReadingForm } from '../components/heat/TempReadingForm'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { BilingualText } from '../components/ui/BilingualText'
import { useLanguage } from '../context/LanguageContext'
import {
  addChargeLine,
  addTempReading,
  computePlanVariance,
  decideCancelRequest,
  decideHeatNoCorrection,
  fetchBatchPlansForHeat,
  fetchCancelRequests,
  fetchChargeLines,
  fetchCycleLog,
  fetchHeatNoCorrections,
  fetchHeats,
  fetchMainFurnacesForHeat,
  fetchTempReadings,
  finishCycleStage,
  loadLocalHeats,
  startCycleStage,
  startHeat,
  submitCancelRequest,
  submitHeatNoCorrection,
  syncHeatQueue,
} from '../lib/heatService'
import type { BatchPlan } from '../types/batchPlan'
import type { FurnaceOption } from '../types/batchPlan'
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
  const [batchPlans, setBatchPlans] = useState<BatchPlan[]>([])
  const [pendingCancels, setPendingCancels] = useState<Array<{ id: string; heat_id: string; reason: string }>>([])
  const [pendingCorrections, setPendingCorrections] = useState<
    Array<{ id: string; heat_id: string; original_heat_no: string; requested_heat_no: string; reason: string }>
  >([])
  const [savedVisible, setSavedVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  const canStartAndCharge = role === 'supervisor'
  const canViewCharging = role === 'supervisor' || role === 'qa' || role === 'plant_head' || role === 'admin_owner'
  const canViewCycle = role === 'supervisor' || role === 'plant_head' || role === 'admin_owner'
  const canRequestCancel = role === 'plant_head'
  const canRequestCorrection = role === 'plant_head'
  const canDecide = role === 'admin_owner'

  const linkedPlan = useMemo(
    () => batchPlans.find((p) => p.id === selectedHeat?.batch_plan_id) ?? null,
    [batchPlans, selectedHeat],
  )

  const variance = useMemo(
    () => computePlanVariance(linkedPlan, chargeLines),
    [linkedPlan, chargeLines],
  )

  const refreshData = useCallback(async () => {
    try {
      if (navigator.onLine) await syncHeatQueue()
      const [nextHeats, nextFurnaces, nextPlans] = await Promise.all([
        navigator.onLine ? fetchHeats() : Promise.resolve(loadLocalHeats()),
        fetchMainFurnacesForHeat().catch(() => []),
        fetchBatchPlansForHeat().catch(() => []),
      ])
      setHeats(nextHeats)
      setFurnaces(nextFurnaces)
      setBatchPlans(nextPlans)

      if (canDecide && navigator.onLine) {
        const [cancels, corrections] = await Promise.all([
          fetchCancelRequests().catch(() => []),
          fetchHeatNoCorrections().catch(() => []),
        ])
        setPendingCancels(cancels.filter((r) => r.status === 'pending'))
        setPendingCorrections(corrections.filter((r) => r.status === 'pending'))
      }
    } catch {
      setHeats(loadLocalHeats())
    } finally {
      setLoading(false)
    }
  }, [canDecide])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    async function loadHeatDetail() {
      if (!selectedHeat) {
        setChargeLines([])
        setCycleEntries([])
        setTempReadings([])
        return
      }
      const [lines, entries, readings] = await Promise.all([
        navigator.onLine ? fetchChargeLines(selectedHeat.id).catch(() => []) : Promise.resolve([]),
        fetchCycleLog(selectedHeat.id).catch(() => []),
        fetchTempReadings(selectedHeat.id).catch(() => []),
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

  if (!canViewCharging) return null

  const activeSelected = Boolean(selectedHeat && isActiveHeat(selectedHeat.status))

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <BilingualText as="h1" en="Heat Charging & Cycle Log" hi="हीट चार्जिंग व साइकिल लॉग" className="text-3xl font-bold" />

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      {canStartAndCharge && (
        <StartHeatForm
          furnaces={furnaces}
          batchPlans={batchPlans}
          onStart={async (values) => {
            const result = await startHeat(user!, values, heats)
            if (result.error) return { error: result.error }
            setHeats((prev) => [result.heat, ...prev])
            setSelectedHeat(result.heat)
            showSaved()
            return {}
          }}
        />
      )}

      <div>
        <BilingualText as="h2" en="Heats" hi="हीट्स" className="mb-3 text-lg font-semibold" />
        <HeatList
          heats={heats.filter((h) => isActiveHeat(h.status) || h.status === 'Closed')}
          selectedId={selectedHeat?.id ?? null}
          onSelect={setSelectedHeat}
        />
      </div>

      {selectedHeat && (
        <>
          <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
            <p className="text-2xl font-bold text-emerald-400">{selectedHeat.heat_no}</p>
            <p className="text-sm text-slate-400">{selectedHeat.status} · {selectedHeat.furnace_code} · {selectedHeat.grade_code}</p>
          </section>

          {activeSelected && canViewCycle && (
            <>
              <CycleStageGrid
                entries={cycleEntries}
                disabled={!canStartAndCharge}
                onStart={async (stage) => {
                  const entry = await startCycleStage(user!, selectedHeat.id, stage)
                  setCycleEntries((prev) => [...prev, entry])
                  showSaved()
                }}
                onFinish={async (entry) => {
                  const updated = await finishCycleStage(entry)
                  setCycleEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)))
                  showSaved()
                }}
              />

              {canStartAndCharge && (
                <TempReadingForm
                  onSubmit={async (values) => {
                    const reading = await addTempReading(user!, { ...values, heat_id: selectedHeat.id })
                    setTempReadings((prev) => [reading, ...prev])
                    showSaved()
                  }}
                />
              )}

              {tempReadings.length > 0 && (
                <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
                  <BilingualText as="h3" en="Recorded Temperatures" hi="दर्ज तापमान" className="mb-3 font-bold" />
                  <ul className="space-y-2 text-sm">
                    {tempReadings.map((r) => (
                      <li key={r.id} className="flex justify-between rounded-lg bg-slate-900/50 px-3 py-2">
                        <span>{r.checkpoint}</span>
                        <span>{r.value}°</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {canStartAndCharge && activeSelected && (
            <ChargeLineForm
              onSubmit={async (values) => {
                const line = await addChargeLine(user!, { ...values, heat_id: selectedHeat.id })
                setChargeLines((prev) => [line, ...prev])
                setHeats((prev) =>
                  prev.map((h) =>
                    h.id === selectedHeat.id ? { ...h, status: h.status === 'Planned' ? 'Charging' : h.status } : h,
                  ),
                )
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

      {canDecide && (
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

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
