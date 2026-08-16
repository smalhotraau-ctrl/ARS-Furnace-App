import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { HeatList } from '../components/heat/HeatList'
import { ChargeLineContext, SpectroReportForm } from '../components/spectro/SpectroReportForm'
import { CorrectionSuggestionPanel } from '../components/spectro/CorrectionSuggestionPanel'
import { SpectroReportDetail, SpectroReportList } from '../components/spectro/SpectroReportList'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { BilingualText } from '../components/ui/BilingualText'
import { computeCorrectionSuggestion, totalChargedKg } from '../lib/spectroCalc'
import {
  fetchChargeLines,
  fetchGradeSpecs,
  fetchHeatsForSpectro,
  fetchMaterialStdComposition,
  fetchActiveMaterials,
  fetchSpectroReports,
  getSpectroPendingCount,
  loadLocalSpectroReports,
  saveSpectroReport,
  syncSpectroQueue,
  updateReportCorrection,
} from '../lib/spectroService'
import type { GradeSpecRow, MaterialStdRow } from '../types/batchPlan'
import type { ChargeLine, Heat } from '../types/heat'
import type { CorrectionSuggestion, SpectroCompositionEntry, SpectroReport } from '../types/spectro'
import { isActiveHeat } from '../types/heat'

export function SpectroPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  const canEnter = role === 'qa'
  const canView = role === 'supervisor' || role === 'qa' || role === 'plant_head' || role === 'admin_owner'
  const showPendingIndicator = role === 'plant_head' || role === 'admin_owner'

  const [heats, setHeats] = useState<Heat[]>([])
  const [selectedHeat, setSelectedHeat] = useState<Heat | null>(null)
  const [chargeLines, setChargeLines] = useState<ChargeLine[]>([])
  const [gradeSpecs, setGradeSpecs] = useState<GradeSpecRow[]>([])
  const [materialStd, setMaterialStd] = useState<MaterialStdRow[]>([])
  const [activeMaterialCodes, setActiveMaterialCodes] = useState<Set<string>>(new Set())
  const [reports, setReports] = useState<SpectroReport[]>([])
  const [selectedReport, setSelectedReport] = useState<SpectroReport | null>(null)
  const [liveComposition, setLiveComposition] = useState<SpectroCompositionEntry[]>([])
  const [pendingCorrection, setPendingCorrection] = useState<CorrectionSuggestion[] | null>(null)
  const [savedVisible, setSavedVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [computing, setComputing] = useState(false)
  const [pendingUploads, setPendingUploads] = useState(getSpectroPendingCount())

  const meltKg = useMemo(() => totalChargedKg(chargeLines), [chargeLines])

  const refreshData = useCallback(async () => {
    try {
      if (navigator.onLine) await syncSpectroQueue()
      const [nextHeats, nextSpecs, nextMaterialStd, nextMaterials] = await Promise.all([
        fetchHeatsForSpectro(),
        fetchGradeSpecs().catch(() => [] as GradeSpecRow[]),
        fetchMaterialStdComposition().catch(() => [] as MaterialStdRow[]),
        fetchActiveMaterials().catch(() => []),
      ])
      setHeats(nextHeats.filter((h) => isActiveHeat(h.status)))
      setGradeSpecs(nextSpecs)
      setMaterialStd(nextMaterialStd)
      setActiveMaterialCodes(new Set(nextMaterials.map((m) => m.code)))
      setPendingUploads(getSpectroPendingCount())
    } catch {
      setHeats([])
      setPendingUploads(getSpectroPendingCount())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  // Without this, a report queued while offline only gets a chance to sync on the next full
  // remount of this page — it can sit invisibly stuck in local storage indefinitely otherwise.
  useEffect(() => {
    function handleOnline() {
      void refreshData()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshData])

  useEffect(() => {
    async function loadHeatData() {
      if (!selectedHeat) {
        setChargeLines([])
        setReports([])
        setSelectedReport(null)
        setPendingCorrection(null)
        return
      }
      const [lines, heatReports] = await Promise.all([
        fetchChargeLines(selectedHeat.id).catch(() => []),
        navigator.onLine
          ? fetchSpectroReports(selectedHeat.id).catch(() => [])
          : Promise.resolve(loadLocalSpectroReports().filter((r) => r.heat_id === selectedHeat.id)),
      ])
      setChargeLines(lines)
      setReports(heatReports)
      setSelectedReport(null)
      setPendingCorrection(null)
    }
    void loadHeatData()
  }, [selectedHeat])

  function showSaved() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  const handleCompositionChange = useCallback((composition: SpectroCompositionEntry[]) => {
    setLiveComposition(composition)
    setPendingCorrection(null)
  }, [])

  if (!canView) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <BilingualText as="h1" en="Spectro" hi="स्पेक्ट्रो" className="text-3xl font-bold" />

      {showPendingIndicator && pendingUploads > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          {t(`${pendingUploads} entries pending upload`, `${pendingUploads} प्रविष्टियाँ अपलोड बाकी`)}
        </p>
      )}

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      <div>
        <BilingualText as="h2" en="Select Heat" hi="हीट चुनें" className="mb-3 text-lg font-semibold" />
        <HeatList
          heats={heats}
          selectedId={selectedHeat?.id ?? null}
          onSelect={setSelectedHeat}
        />
      </div>

      {selectedHeat && (
        <>
          <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
            <p className="text-2xl font-bold text-emerald-400">{selectedHeat.heat_no}</p>
            <p className="text-sm text-slate-400">
              {selectedHeat.grade_code} · {selectedHeat.status}
            </p>
          </section>

          <ChargeLineContext lines={chargeLines} />

          {canEnter && (
            <>
              <SpectroReportForm
                gradeCode={selectedHeat.grade_code}
                gradeSpecs={gradeSpecs}
                onCompositionChange={handleCompositionChange}
                onSubmit={async (values) => {
                  const saved = await saveSpectroReport(user!, {
                    ...values,
                    heat_id: selectedHeat.id,
                    correction_suggested: pendingCorrection,
                  })
                  setReports((prev) => [saved, ...prev])
                  setPendingCorrection(null)
                  setPendingUploads(getSpectroPendingCount())
                  showSaved()
                }}
              />

              <CorrectionSuggestionPanel
                suggestions={pendingCorrection}
                meltKg={meltKg}
                loading={computing}
                disabled={liveComposition.length === 0}
                onRequest={() => {
                  setComputing(true)
                  const suggestions = computeCorrectionSuggestion(
                    liveComposition,
                    chargeLines,
                    materialStd,
                    activeMaterialCodes,
                  )
                  setPendingCorrection(suggestions)
                  setComputing(false)
                }}
              />
            </>
          )}

          <div>
            <BilingualText as="h2" en="Reports" hi="रिपोर्ट" className="mb-3 text-lg font-semibold" />
            <SpectroReportList
              reports={reports}
              selectedId={selectedReport?.id ?? null}
              onSelect={setSelectedReport}
            />
          </div>

          <SpectroReportDetail report={selectedReport} />

          {canEnter && selectedReport && !selectedReport.correction_suggested && (
            <CorrectionSuggestionPanel
              suggestions={null}
              meltKg={meltKg}
              loading={computing}
              onRequest={async () => {
                setComputing(true)
                const suggestions = computeCorrectionSuggestion(
                  selectedReport.composition,
                  chargeLines,
                  materialStd,
                  activeMaterialCodes,
                )
                await updateReportCorrection(selectedReport, suggestions)
                setReports((prev) =>
                  prev.map((r) =>
                    r.id === selectedReport.id ? { ...r, correction_suggested: suggestions } : r,
                  ),
                )
                setSelectedReport({ ...selectedReport, correction_suggested: suggestions })
                setComputing(false)
              }}
            />
          )}
        </>
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
