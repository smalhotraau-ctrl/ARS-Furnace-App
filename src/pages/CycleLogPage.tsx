import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { CycleStageGrid } from '../components/heat/CycleStageGrid'
import { HeatList } from '../components/heat/HeatList'
import { TempReadingForm } from '../components/heat/TempReadingForm'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { BilingualText } from '../components/ui/BilingualText'
import {
  addTempReading,
  fetchCycleLog,
  fetchHeats,
  fetchTempReadings,
  finishCycleStage,
  loadLocalHeats,
  startCycleStage,
  syncHeatQueue,
} from '../lib/heatService'
import type { CycleLogEntry, Heat, TempReading } from '../types/heat'
import { isActiveHeat } from '../types/heat'

export function CycleLogPage() {
  const { user } = useAuth()
  const role = user!.role

  const canOperate = role === 'supervisor'
  const canView = role === 'supervisor' || role === 'plant_head' || role === 'admin_owner'

  const [heats, setHeats] = useState<Heat[]>(() => loadLocalHeats())
  const [selectedHeat, setSelectedHeat] = useState<Heat | null>(null)
  const [cycleEntries, setCycleEntries] = useState<CycleLogEntry[]>([])
  const [tempReadings, setTempReadings] = useState<TempReading[]>([])
  const [savedVisible, setSavedVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  const refreshHeats = useCallback(async () => {
    try {
      if (navigator.onLine) await syncHeatQueue()
      const nextHeats = navigator.onLine ? await fetchHeats() : loadLocalHeats()
      setHeats(nextHeats.filter((h) => isActiveHeat(h.status)))
    } catch {
      setHeats(loadLocalHeats().filter((h) => isActiveHeat(h.status)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshHeats()
  }, [refreshHeats])

  useEffect(() => {
    async function loadCycleData() {
      if (!selectedHeat) {
        setCycleEntries([])
        setTempReadings([])
        return
      }
      const [entries, readings] = await Promise.all([
        fetchCycleLog(selectedHeat.id).catch(() => []),
        fetchTempReadings(selectedHeat.id).catch(() => []),
      ])
      setCycleEntries(entries)
      setTempReadings(readings)
    }
    void loadCycleData()
  }, [selectedHeat])

  function showSaved() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 text-center text-slate-400">
        <p>No access to cycle log</p>
        <p className="text-sm">साइकिल लॉग की अनुमति नहीं</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <BilingualText as="h1" en="Cycle Log" hi="साइकिल लॉग" className="text-3xl font-bold" />

      {loading && <p className="text-center text-slate-400">Loading… · लोड हो रहा है…</p>}

      <div>
        <BilingualText as="h2" en="Select Active Heat" hi="सक्रिय हीट चुनें" className="mb-3 text-lg font-semibold" />
        <HeatList heats={heats} selectedId={selectedHeat?.id ?? null} onSelect={setSelectedHeat} />
      </div>

      {selectedHeat && (
        <>
          <p className="text-center text-lg font-semibold text-emerald-400">{selectedHeat.heat_no}</p>

          <CycleStageGrid
            entries={cycleEntries}
            disabled={!canOperate}
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

          {canOperate && (
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

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
