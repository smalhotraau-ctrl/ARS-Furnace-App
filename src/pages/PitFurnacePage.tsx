import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { PitBalanceDisplay } from '../components/pit/PitBalanceDisplay'
import { PitHeatList } from '../components/pit/PitHeatList'
import { PitProductionForm } from '../components/pit/PitProductionForm'
import { PitQualityForm } from '../components/pit/PitQualityForm'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import {
  fetchPitBalance,
  fetchPitHeats,
  getPendingCount,
  loadLocalPitHeats,
  saveProductionEntry,
  saveQualityEntry,
  syncPendingActions,
} from '../lib/pitFurnaceService'
import { computeBalanceFromHeats, type PitHeat } from '../types/pitFurnace'
import { BilingualText } from '../components/ui/BilingualText'
import { useLanguage } from '../context/LanguageContext'
import { floorWorkerPageClass } from '../lib/pageLayout'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function PitFurnacePage() {
  const { t } = useLanguage()
  const { user, isReadOnly } = useAuth()
  const [heats, setHeats] = useState<PitHeat[]>(() => loadLocalPitHeats())
  const [balanceKg, setBalanceKg] = useState(() => computeBalanceFromHeats(loadLocalPitHeats(), todayIsoDate()))
  const [selectedHeat, setSelectedHeat] = useState<PitHeat | null>(null)
  const [savedVisible, setSavedVisible] = useState(false)
  const [pendingUploads, setPendingUploads] = useState(getPendingCount())
  const [loading, setLoading] = useState(true)

  const refreshData = useCallback(async () => {
    if (!user) return

    try {
      if (navigator.onLine) {
        await syncPendingActions(user)
      }
      const nextHeats = navigator.onLine ? await fetchPitHeats() : loadLocalPitHeats()
      setHeats(nextHeats)
      const asOf = todayIsoDate()
      const balance = navigator.onLine ? await fetchPitBalance(asOf) : computeBalanceFromHeats(nextHeats, asOf)
      setBalanceKg(balance)
      setPendingUploads(getPendingCount())
    } catch {
      const cached = loadLocalPitHeats()
      setHeats(cached)
      setBalanceKg(computeBalanceFromHeats(cached, todayIsoDate()))
      setPendingUploads(getPendingCount())
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    function handleOnline() {
      if (user) void refreshData()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [refreshData, user])

  function showSavedToast() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  if (!user) return null

  const role = user.role
  const showPendingIndicator = role === 'plant_head' || role === 'admin_owner'

  return (
    <div className={floorWorkerPageClass(role)}>
      <header className="space-y-2">
        <BilingualText
          as="h1"
          en="Pit Furnace"
          hi="पिट फर्नेस"
          className="text-3xl font-bold text-slate-100"
        />
        {showPendingIndicator && pendingUploads > 0 && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
            {t(
              `${pendingUploads} entries pending upload`,
              `${pendingUploads} प्रविष्टियाँ अपलोड बाकी`,
            )}
          </p>
        )}
      </header>

      <PitBalanceDisplay balanceKg={balanceKg} asOfDate={todayIsoDate()} />

      {loading && (
        <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>
      )}

      {role === 'supervisor' && (
        <PitProductionForm
          heats={heats}
          disabled={isReadOnly}
          onSubmit={async (values) => {
            const saved = await saveProductionEntry(user, values, heats)
            setHeats((prev) => [saved, ...prev])
            setBalanceKg(computeBalanceFromHeats([saved, ...heats], todayIsoDate()))
            setPendingUploads(getPendingCount())
            showSavedToast()
          }}
        />
      )}

      {role === 'qa' && (
        <div className="space-y-6">
          <div>
            <BilingualText
              as="h2"
              en="Select Heat"
              hi="हीट चुनें"
              className="mb-3 text-lg font-semibold text-slate-100"
            />
            <PitHeatList
              heats={heats}
              selectedId={selectedHeat?.id ?? null}
              onSelect={setSelectedHeat}
              showQualityStatus
            />
          </div>
          <PitQualityForm
            heat={selectedHeat}
            disabled={isReadOnly}
            onSubmit={async (composition) => {
              if (!selectedHeat) return
              const saved = await saveQualityEntry(user, selectedHeat, composition)
              setHeats((prev) => prev.map((h) => (h.id === saved.id ? saved : h)))
              setSelectedHeat(saved)
              setPendingUploads(getPendingCount())
              showSavedToast()
            }}
          />
        </div>
      )}

      {(role === 'plant_head' || role === 'admin_owner') && (
        <div>
          <BilingualText
            as="h2"
            en="Production History"
            hi="उत्पादन इतिहास"
            className="mb-3 text-lg font-semibold text-slate-100"
          />
          <PitHeatList
            heats={heats}
            selectedId={selectedHeat?.id ?? null}
            onSelect={setSelectedHeat}
            showQualityStatus
          />
          {selectedHeat && (
            <section className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5 text-sm text-slate-300">
              <p className="text-lg font-bold text-slate-100">{selectedHeat.heat_no}</p>
              <p>{selectedHeat.date}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <p>Weight: {selectedHeat.weight_kg} kg</p>
                <p>Ingot: {selectedHeat.ingot_kg} kg</p>
                <p>Dross: {selectedHeat.dross_kg} kg</p>
                <p>Pit iron: {selectedHeat.pit_iron_kg} kg</p>
                <p>Wood fuel: {selectedHeat.wood_fuel_kg} kg</p>
                <p>Sale: {selectedHeat.sale_kg} kg</p>
              </div>
              {selectedHeat.composition.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {selectedHeat.composition.map((entry) => (
                    <p key={entry.element}>
                      {entry.element}: {entry.pct ?? '—'}%
                    </p>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
