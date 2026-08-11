import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from '../components/ui/BilingualText'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { HeatClosedBanner } from '../components/heat/HeatClosedBanner'
import { HeatDetailHeader } from '../components/heat/HeatDetailHeader'
import { HeatList } from '../components/heat/HeatList'
import { OutputEntryForm } from '../components/heat/OutputEntryForm'
import { RecoveryBreakdownCard } from '../components/heat/RecoveryBreakdownCard'
import { VerifyOutputPanel } from '../components/heat/VerifyOutputPanel'
import { YieldExceptionsPanel } from '../components/heat/YieldExceptionsPanel'
import { computeChargedNetKg } from '../lib/outputCalc'
import { fetchChargeLines, fetchHeats, loadLocalHeats, syncHeatQueue } from '../lib/heatService'
import {
  acknowledgeYieldFlag,
  fetchHeatOutput,
  fetchOpenYieldFlags,
  fetchYieldStandards,
  saveHeatOutput,
  syncOutputQueue,
  verifyAndCloseHeatOutput,
} from '../lib/outputService'
import type { ChargeLine, Heat } from '../types/heat'
import { isActiveHeat } from '../types/heat'
import type { HeatOutput, HeatOutputFlag, MaterialYieldStandardRow } from '../types/output'

export function OutputPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  const [heats, setHeats] = useState<Heat[]>(() => loadLocalHeats())
  const [selectedHeat, setSelectedHeat] = useState<Heat | null>(null)
  const [chargeLines, setChargeLines] = useState<ChargeLine[]>([])
  const [heatOutput, setHeatOutput] = useState<HeatOutput | null>(null)
  const [yieldStandards, setYieldStandards] = useState<MaterialYieldStandardRow[]>([])
  const [openFlags, setOpenFlags] = useState<HeatOutputFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [savedVisible, setSavedVisible] = useState(false)

  const canViewScreen = role === 'supervisor' || role === 'qa' || role === 'plant_head' || role === 'admin_owner'
  const canEnterOutput = role === 'supervisor'
  const canVerify = role === 'qa' || role === 'plant_head'
  // Yield-standard flags are visible only to Plant Head / Owner, never Supervisor or QA —
  // even on the Plant Head's own verification screen. 03f §4 / 03b.
  const canSeeYieldFlags = role === 'plant_head' || role === 'admin_owner'

  const chargedNetKg = useMemo(() => computeChargedNetKg(chargeLines), [chargeLines])

  function showSaved() {
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 2200)
  }

  const refreshData = useCallback(async () => {
    try {
      if (navigator.onLine) {
        await Promise.all([syncHeatQueue(), syncOutputQueue()])
      }
      const nextHeats = navigator.onLine ? await fetchHeats() : loadLocalHeats()
      setHeats(nextHeats)

      // Needed by whichever role verifies (QA or Plant Head) to compute yield flags at
      // verification time — the live preview UI itself stays Plant-Head-only (canSeeYieldFlags).
      if (canVerify && navigator.onLine) {
        setYieldStandards(await fetchYieldStandards().catch(() => []))
      }
      if (canSeeYieldFlags && navigator.onLine) {
        setOpenFlags(await fetchOpenYieldFlags().catch(() => []))
      }
    } catch {
      setHeats(loadLocalHeats())
    } finally {
      setLoading(false)
    }
  }, [canVerify, canSeeYieldFlags])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  useEffect(() => {
    async function loadHeatDetail() {
      if (!selectedHeat) {
        setChargeLines([])
        setHeatOutput(null)
        return
      }
      const [lines, output] = await Promise.all([
        navigator.onLine ? fetchChargeLines(selectedHeat.id).catch(() => []) : Promise.resolve([]),
        fetchHeatOutput(selectedHeat.id).catch(() => null),
      ])
      setChargeLines(lines)
      setHeatOutput(output)
    }
    void loadHeatDetail()
  }, [selectedHeat])

  if (!canViewScreen) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <BilingualText as="h1" en="Heat Output & Close" hi="हीट आउटपुट व समापन" className="text-3xl font-bold" />

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      {canSeeYieldFlags && (
        <YieldExceptionsPanel
          flags={openFlags}
          heats={heats}
          onAcknowledge={async (flag, note) => {
            await acknowledgeYieldFlag(user!, flag, note)
            setOpenFlags((prev) => prev.filter((f) => f.id !== flag.id))
            showSaved()
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
          <HeatDetailHeader heat={selectedHeat} />

          {selectedHeat.status === 'Closed' && heatOutput ? (
            <HeatClosedBanner heat={selectedHeat} output={heatOutput} />
          ) : heatOutput ? (
            <>
              <RecoveryBreakdownCard output={heatOutput} />

              {canVerify ? (
                <VerifyOutputPanel
                  output={heatOutput}
                  chargeLines={chargeLines}
                  yieldStandards={yieldStandards}
                  showFlagPreview={canSeeYieldFlags}
                  onVerify={async () => {
                    const { output } = await verifyAndCloseHeatOutput(user!, selectedHeat, heatOutput, chargeLines, yieldStandards)
                    setHeatOutput(output)
                    setHeats((prev) => prev.map((h) => (h.id === selectedHeat.id ? { ...h, status: 'Closed' } : h)))
                    setSelectedHeat((prev) => (prev ? { ...prev, status: 'Closed' } : prev))
                    showSaved()
                    void refreshData()
                  }}
                />
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-600 p-4 text-center text-slate-400">
                  {t(
                    'Awaiting QA or Plant Head verification before this heat closes.',
                    'हीट बंद होने से पहले QA या प्लांट प्रमुख के सत्यापन की प्रतीक्षा है।',
                  )}
                </p>
              )}
            </>
          ) : canEnterOutput && isActiveHeat(selectedHeat.status) ? (
            <OutputEntryForm
              chargedNetKg={chargedNetKg}
              onSubmit={async (values) => {
                const output = await saveHeatOutput(user!, selectedHeat, values, chargedNetKg)
                setHeatOutput(output)
                setHeats((prev) => prev.map((h) => (h.id === selectedHeat.id ? { ...h, status: 'Output Entered' } : h)))
                setSelectedHeat((prev) => (prev ? { ...prev, status: 'Output Entered' } : prev))
                showSaved()
              }}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-600 p-4 text-center text-slate-400">
              {t('Output not yet entered by Supervisor.', 'सुपरवाइज़र द्वारा अभी आउटपुट दर्ज नहीं किया गया है।')}
            </p>
          )}
        </>
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
