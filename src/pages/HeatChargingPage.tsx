import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ChargeLineForm, ChargeLineList } from '../components/heat/ChargeLineForm'
import { HeatList } from '../components/heat/HeatList'
import { MakerCheckerForms } from '../components/heat/MakerCheckerForms'
import { PlanVariancePanel } from '../components/heat/PlanVariancePanel'
import { StartHeatForm } from '../components/heat/StartHeatForm'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { BilingualText } from '../components/ui/BilingualText'
import { useLanguage } from '../context/LanguageContext'
import {
  addChargeLine,
  computePlanVariance,
  decideCancelRequest,
  decideHeatNoCorrection,
  fetchBatchPlansForHeat,
  fetchCancelRequests,
  fetchChargeLines,
  fetchHeatNoCorrections,
  fetchHeats,
  fetchMainFurnacesForHeat,
  loadLocalHeats,
  startHeat,
  submitCancelRequest,
  submitHeatNoCorrection,
  syncHeatQueue,
} from '../lib/heatService'
import type { BatchPlan } from '../types/batchPlan'
import type { FurnaceOption } from '../types/batchPlan'
import type { ChargeLine, Heat } from '../types/heat'
import { isActiveHeat } from '../types/heat'

export function HeatChargingPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  const [heats, setHeats] = useState<Heat[]>(() => loadLocalHeats())
  const [selectedHeat, setSelectedHeat] = useState<Heat | null>(null)
  const [chargeLines, setChargeLines] = useState<ChargeLine[]>([])
  const [furnaces, setFurnaces] = useState<FurnaceOption[]>([])
  const [batchPlans, setBatchPlans] = useState<BatchPlan[]>([])
  const [pendingCancels, setPendingCancels] = useState<Array<{ id: string; heat_id: string; reason: string }>>([])
  const [pendingCorrections, setPendingCorrections] = useState<
    Array<{ id: string; heat_id: string; original_heat_no: string; requested_heat_no: string; reason: string }>
  >([])
  const [savedVisible, setSavedVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  const canStartAndCharge = role === 'supervisor'
  const canView = role === 'supervisor' || role === 'qa' || role === 'plant_head' || role === 'admin_owner'
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
    async function loadLines() {
      if (!selectedHeat) {
        setChargeLines([])
        return
      }
      const lines = navigator.onLine
        ? await fetchChargeLines(selectedHeat.id).catch(() => [])
        : []
      setChargeLines(lines)
    }
    void loadLines()
  }, [selectedHeat])

  function showSaved() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  if (!canView) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <BilingualText as="h1" en="Heat Charging" hi="हीट चार्जिंग" className="text-3xl font-bold" />

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

          {canStartAndCharge && isActiveHeat(selectedHeat.status) && (
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
