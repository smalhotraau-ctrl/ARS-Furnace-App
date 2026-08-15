import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from '../components/ui/BilingualText'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { DispatchForm } from '../components/dispatch/DispatchForm'
import { DispatchList } from '../components/dispatch/DispatchList'
import { DispatchRecordedBanner } from '../components/dispatch/DispatchRecordedBanner'
import type { HeatStockOption } from '../components/dispatch/DispatchLineEditor'
import { fetchHeats, loadLocalHeats, syncHeatQueue } from '../lib/heatService'
import {
  fetchDispatchLines,
  fetchDispatches,
  fetchFgStockList,
  getDispatchPendingCount,
  loadLocalDispatchLines,
  loadLocalDispatches,
  saveDispatch,
  syncDispatchQueue,
  updateDispatchShortage,
} from '../lib/dispatchService'
import type { Heat } from '../types/heat'
import type { Dispatch, DispatchLine } from '../types/dispatch'
import type { FgStock } from '../types/output'

export function DispatchPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  const [heats, setHeats] = useState<Heat[]>(() => loadLocalHeats())
  const [fgStock, setFgStock] = useState<FgStock[]>([])
  const [dispatches, setDispatches] = useState<Dispatch[]>(() => loadLocalDispatches())
  const [lines, setLines] = useState<DispatchLine[]>(() => loadLocalDispatchLines())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savedVisible, setSavedVisible] = useState(false)
  const [justRecorded, setJustRecorded] = useState<{ dispatch: Dispatch; lines: DispatchLine[] } | null>(null)
  const [pendingUploads, setPendingUploads] = useState(getDispatchPendingCount())

  const canEnter = role === 'supervisor' || role === 'qa' || role === 'plant_head'
  const showPendingIndicator = role === 'plant_head' || role === 'admin_owner'

  function showSaved() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  const refreshData = useCallback(async () => {
    try {
      if (navigator.onLine) {
        await Promise.all([syncHeatQueue(), syncDispatchQueue()])
      }
      const [nextHeats, nextDispatches, nextLines, nextFgStock] = await Promise.all([
        navigator.onLine ? fetchHeats() : Promise.resolve(loadLocalHeats()),
        navigator.onLine ? fetchDispatches() : Promise.resolve(loadLocalDispatches()),
        navigator.onLine ? fetchDispatchLines() : Promise.resolve(loadLocalDispatchLines()),
        navigator.onLine ? fetchFgStockList().catch(() => [] as FgStock[]) : Promise.resolve([] as FgStock[]),
      ])
      setHeats(nextHeats)
      setDispatches(nextDispatches)
      setLines(nextLines)
      setFgStock(nextFgStock)
      setPendingUploads(getDispatchPendingCount())
    } catch {
      setHeats(loadLocalHeats())
      setDispatches(loadLocalDispatches())
      setLines(loadLocalDispatchLines())
      setPendingUploads(getDispatchPendingCount())
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

  const heatNoById = useMemo(() => {
    const map = new Map<string, string>()
    for (const h of heats) map.set(h.id, h.heat_no)
    return map
  }, [heats])

  const stockOptions: HeatStockOption[] = useMemo(() => {
    return fgStock
      .filter((s) => heatNoById.has(s.heat_id))
      .map((s) => ({ heat_id: s.heat_id, heat_no: heatNoById.get(s.heat_id)!, available_kg: s.kg_available }))
      .sort((a, b) => b.available_kg - a.available_kg)
  }, [fgStock, heatNoById])

  const linesByDispatchId = useMemo(() => {
    const map = new Map<string, DispatchLine[]>()
    for (const line of lines) {
      const list = map.get(line.dispatch_id) ?? []
      list.push(line)
      map.set(line.dispatch_id, list)
    }
    return map
  }, [lines])

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <BilingualText as="h1" en="Dispatch" hi="डिस्पैच" className="text-3xl font-bold text-slate-100" />
      <p className="text-sm text-slate-400">
        {t(
          'One dispatch can cover a single heat or several combined into one invoice — each line decrements that heat\u2019s FG stock for lot-level traceability.',
          'एक डिस्पैच एक हीट या एक ही इनवॉइस में कई हीट्स को शामिल कर सकता है — हर पंक्ति उस हीट का FG स्टॉक घटाती है।',
        )}
      </p>
      {showPendingIndicator && pendingUploads > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          {t(`${pendingUploads} entries pending upload`, `${pendingUploads} प्रविष्टियाँ अपलोड बाकी`)}
        </p>
      )}

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      {justRecorded && (
        <DispatchRecordedBanner
          dispatch={justRecorded.dispatch}
          lines={justRecorded.lines}
          heatNoById={heatNoById}
          onDismiss={() => setJustRecorded(null)}
        />
      )}

      {canEnter && !creating && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent"
        >
          {t('New Dispatch', 'नई डिस्पैच')}
        </button>
      )}

      {canEnter && creating && (
        <DispatchForm
          options={stockOptions}
          onCancel={() => setCreating(false)}
          onSubmit={async (values) => {
            const saved = await saveDispatch(user!, values, values.lines)
            setDispatches((prev) => [saved.dispatch, ...prev])
            setLines((prev) => [...saved.lines, ...prev])
            setFgStock((prev) =>
              prev.map((s) => {
                const line = values.lines.find((l) => l.heat_id === s.heat_id)
                return line ? { ...s, kg_available: s.kg_available - line.kg_dispatched } : s
              }),
            )
            setJustRecorded(saved)
            setCreating(false)
            showSaved()
          }}
        />
      )}

      <div>
        <BilingualText as="h2" en="Dispatch History" hi="डिस्पैच इतिहास" className="mb-3 text-lg font-semibold text-slate-100" />
        <DispatchList
          dispatches={dispatches}
          linesByDispatchId={linesByDispatchId}
          heatNoById={heatNoById}
          canEditShortage={canEnter}
          onUpdateShortage={async (dispatch, shortageKg, reportedDate) => {
            const updated = await updateDispatchShortage(user!, dispatch, shortageKg, reportedDate)
            setDispatches((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
            showSaved()
          }}
        />
      </div>

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
