import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from '../components/ui/BilingualText'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { BundleForm } from '../components/bundling/BundleForm'
import { BundleList } from '../components/bundling/BundleList'
import { HeatDetailHeader } from '../components/heat/HeatDetailHeader'
import { HeatList } from '../components/heat/HeatList'
import { fetchHeats, loadLocalHeats, syncHeatQueue } from '../lib/heatService'
import {
  fetchBundles,
  getDispatchPendingCount,
  loadLocalBundles,
  saveBundle,
  syncDispatchQueue,
} from '../lib/dispatchService'
import type { Heat } from '../types/heat'
import type { Bundle } from '../types/dispatch'

export function BundlingPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  const [heats, setHeats] = useState<Heat[]>(() => loadLocalHeats())
  const [selectedHeat, setSelectedHeat] = useState<Heat | null>(null)
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)
  const [savedVisible, setSavedVisible] = useState(false)
  const [pendingUploads, setPendingUploads] = useState(getDispatchPendingCount())

  const canEnter = role === 'supervisor'
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
      const nextHeats = navigator.onLine ? await fetchHeats() : loadLocalHeats()
      setHeats(nextHeats)
      setPendingUploads(getDispatchPendingCount())
    } catch {
      setHeats(loadLocalHeats())
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

  useEffect(() => {
    async function loadBundlesForHeat() {
      if (!selectedHeat) {
        setBundles([])
        return
      }
      const rows = navigator.onLine
        ? await fetchBundles(selectedHeat.id).catch(() => loadLocalBundles().filter((b) => b.heat_id === selectedHeat.id))
        : loadLocalBundles().filter((b) => b.heat_id === selectedHeat.id)
      setBundles(rows)
    }
    void loadBundlesForHeat()
  }, [selectedHeat])

  const closedHeats = heats.filter((h) => h.status === 'Closed')

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <BilingualText as="h1" en="Bundling" hi="बंडलिंग" className="text-3xl font-bold text-slate-100" />
      <p className="text-sm text-slate-400">
        {t(
          'Reference record only, entered after a heat closes and FG stock posts — bundling does not move stock.',
          'यह केवल संदर्भ रिकॉर्ड है, हीट बंद होने और FG स्टॉक जमा होने के बाद दर्ज किया जाता है — बंडलिंग स्टॉक नहीं बदलती।',
        )}
      </p>
      {showPendingIndicator && pendingUploads > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-sm text-amber-200">
          {t(`${pendingUploads} entries pending upload`, `${pendingUploads} प्रविष्टियाँ अपलोड बाकी`)}
        </p>
      )}

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      <div>
        <BilingualText as="h2" en="Closed Heats" hi="बंद हीट्स" className="mb-3 text-lg font-semibold text-slate-100" />
        <HeatList heats={closedHeats} selectedId={selectedHeat?.id ?? null} onSelect={setSelectedHeat} />
      </div>

      {selectedHeat && (
        <>
          <HeatDetailHeader heat={selectedHeat} />

          {canEnter && (
            <BundleForm
              onSubmit={async (values) => {
                const bundle = await saveBundle(user!, selectedHeat.id, values)
                setBundles((prev) => [bundle, ...prev])
                showSaved()
              }}
            />
          )}

          <div>
            <BilingualText as="h3" en="Bundles Packed" hi="पैक किए गए बंडल" className="mb-3 text-lg font-bold text-slate-100" />
            <BundleList bundles={bundles} />
          </div>
        </>
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
