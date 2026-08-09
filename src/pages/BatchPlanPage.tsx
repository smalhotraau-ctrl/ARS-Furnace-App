import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BatchPlanDetail } from '../components/batch/BatchPlanDetail'
import { BatchPlanForm } from '../components/batch/BatchPlanForm'
import { BatchPlanList } from '../components/batch/BatchPlanList'
import { OwnerReviewForm } from '../components/batch/OwnerReviewForm'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { BilingualText } from '../components/ui/BilingualText'
import {
  acknowledgeBatchPlan,
  fetchBatchPlans,
  fetchGradeCodes,
  fetchGradeSpecs,
  fetchMainFurnaces,
  fetchMaterialStdComposition,
  getBatchPendingCount,
  loadLocalBatchPlans,
  saveBatchPlan,
  syncBatchPendingActions,
  updateBatchPlan,
} from '../lib/batchPlanService'
import type { BatchPlan, FurnaceOption, GradeSpecRow, MaterialStdRow } from '../types/batchPlan'

export function BatchPlanPage() {
  const { user } = useAuth()
  const role = user!.role

  const [plans, setPlans] = useState<BatchPlan[]>(() => loadLocalBatchPlans())
  const [selectedPlan, setSelectedPlan] = useState<BatchPlan | null>(null)
  const [furnaces, setFurnaces] = useState<FurnaceOption[]>([])
  const [gradeCodes, setGradeCodes] = useState<string[]>([])
  const [materialStd, setMaterialStd] = useState<MaterialStdRow[]>([])
  const [gradeSpecs, setGradeSpecs] = useState<GradeSpecRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savedVisible, setSavedVisible] = useState(false)
  const [pendingUploads, setPendingUploads] = useState(getBatchPendingCount())
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)

  const canCreateEdit = role === 'plant_head'
  const canOwnerReview = role === 'admin_owner'
  const isViewOnly = role === 'supervisor' || role === 'qa' || role === 'admin_owner'

  const materialCodes = useMemo(
    () => [...new Set(materialStd.map((row) => row.material_code))].sort(),
    [materialStd],
  )

  const refreshData = useCallback(async () => {
    try {
      if (navigator.onLine) {
        await syncBatchPendingActions()
      }
      const [nextPlans, nextFurnaces, nextGrades, nextMaterialStd, nextGradeSpecs] =
        await Promise.all([
          navigator.onLine ? fetchBatchPlans() : Promise.resolve(loadLocalBatchPlans()),
          fetchMainFurnaces().catch(() => [] as FurnaceOption[]),
          fetchGradeCodes().catch(() => [] as string[]),
          fetchMaterialStdComposition().catch(() => [] as MaterialStdRow[]),
          fetchGradeSpecs().catch(() => [] as GradeSpecRow[]),
        ])
      setPlans(nextPlans)
      setFurnaces(nextFurnaces)
      setGradeCodes(nextGrades)
      setMaterialStd(nextMaterialStd)
      setGradeSpecs(nextGradeSpecs)
      setPendingUploads(getBatchPendingCount())
    } catch {
      setPlans(loadLocalBatchPlans())
      setPendingUploads(getBatchPendingCount())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    function handleOnline() {
      void refreshData()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshData])

  function showSavedToast() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <BilingualText
          as="h1"
          en="Batch Plan"
          hi="बैच योजना"
          className="text-3xl font-bold text-slate-100"
        />
        {canOwnerReview && pendingUploads > 0 && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
            {pendingUploads} entries pending upload · {pendingUploads} प्रविष्टियाँ अपलोड बाकी
          </p>
        )}
      </header>

      {loading && (
        <p className="text-center text-slate-400">Loading… · लोड हो रहा है…</p>
      )}

      {canCreateEdit && !creating && !editing && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950"
        >
          New Batch Plan · नई बैच योजना
        </button>
      )}

      {canCreateEdit && creating && (
        <BatchPlanForm
          furnaces={furnaces}
          gradeCodes={gradeCodes}
          materialCodes={materialCodes}
          materialStd={materialStd}
          gradeSpecs={gradeSpecs}
          onCancel={() => setCreating(false)}
          onSubmit={async (values) => {
            const saved = await saveBatchPlan(user, values)
            setPlans((prev) => [saved, ...prev])
            setCreating(false)
            setPendingUploads(getBatchPendingCount())
            showSavedToast()
          }}
        />
      )}

      {canCreateEdit && editing && selectedPlan && (
        <BatchPlanForm
          furnaces={furnaces}
          gradeCodes={gradeCodes}
          materialCodes={materialCodes}
          materialStd={materialStd}
          gradeSpecs={gradeSpecs}
          initialPlan={selectedPlan}
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            const saved = await updateBatchPlan(user, selectedPlan, values)
            setPlans((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
            setSelectedPlan(saved)
            setEditing(false)
            setPendingUploads(getBatchPendingCount())
            showSavedToast()
          }}
        />
      )}

      {!creating && !editing && (
        <>
          <div>
            <BilingualText
              as="h2"
              en="Batch Plans"
              hi="बैच योजनाएं"
              className="mb-3 text-lg font-semibold text-slate-100"
            />
            <BatchPlanList
              plans={plans}
              selectedId={selectedPlan?.id ?? null}
              onSelect={setSelectedPlan}
            />
          </div>

          {canCreateEdit && selectedPlan && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-12 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-base font-semibold text-emerald-300"
            >
              Edit selected plan · चयनित योजना संपादित करें
            </button>
          )}

          {isViewOnly && (
            <BatchPlanDetail plan={selectedPlan} />
          )}

          {canOwnerReview && (
            <OwnerReviewForm
              plan={selectedPlan}
              onSubmit={async (note) => {
                if (!selectedPlan) return
                const saved = await acknowledgeBatchPlan(user, selectedPlan, note)
                setPlans((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))
                setSelectedPlan(saved)
                setPendingUploads(getBatchPendingCount())
                showSavedToast()
              }}
            />
          )}
        </>
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
