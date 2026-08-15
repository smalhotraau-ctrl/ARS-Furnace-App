import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from '../components/ui/BilingualText'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { RateMasterSection } from '../components/costing/RateMasterSection'
import { HeatCostingSection } from '../components/costing/HeatCostingSection'
import { ApprovalSettingsSection } from '../components/costing/ApprovalSettingsSection'
import { ChangeRequestQueue } from '../components/masterAdmin/ChangeRequestQueue'
import {
  applyDirectChange,
  decideChangeRequest,
  fetchAllApprovalSettings,
  fetchAllMaterials,
  fetchChangeRequests,
  fetchRequiresOwnerApprovalFor,
  proposeChange,
  updateApprovalSetting,
} from '../lib/masterAdminService'
import { fetchHeats } from '../lib/heatService'
import { computeAndSaveHeatCosting, fetchRateMaster, updateHeatCostingBaseInputs } from '../lib/costingService'
import type { Material, MasterAdminChangeRequest } from '../types/masterAdmin'
import type { Heat } from '../types/heat'
import type { ApprovalSetting, HeatCostingBaseInputsPayload, HeatCostingRow, RateMasterCreatePayload, RateMasterRow } from '../types/costing'

type Tab = 'rate_master' | 'heat_costing' | 'approval_settings'

export function CostingPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  // 03i §1: Supervisor and QA have zero access to costing — RLS-enforced on every table this
  // page touches; this is only the matching UI-level guard.
  const hasAccess = role === 'plant_head' || role === 'admin_owner'
  const canPropose = hasAccess
  const canDecide = role === 'admin_owner'

  const [tab, setTab] = useState<Tab>('rate_master')
  const [heats, setHeats] = useState<Heat[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [rateMaster, setRateMaster] = useState<RateMasterRow[]>([])
  const [changeRequests, setChangeRequests] = useState<MasterAdminChangeRequest[]>([])
  const [approvalSettings, setApprovalSettings] = useState<ApprovalSetting[]>([])
  const [rateOverrideGated, setRateOverrideGated] = useState(true)
  const [masterAdminGated, setMasterAdminGated] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedVisible, setSavedVisible] = useState(false)

  const rateMasterAutoApproved = role === 'admin_owner' || !masterAdminGated
  const overrideAutoApproved = role === 'admin_owner' || !rateOverrideGated

  const refreshData = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false)
      return
    }
    try {
      const [nextHeats, nextMaterials, nextRateMaster, nextRequests, nextMasterAdminGate, nextRateOverrideGate] = await Promise.all([
        fetchHeats(),
        fetchAllMaterials(),
        fetchRateMaster(),
        fetchChangeRequests(),
        fetchRequiresOwnerApprovalFor('master_admin_change'),
        fetchRequiresOwnerApprovalFor('rate_override'),
      ])
      setHeats(nextHeats)
      setMaterials(nextMaterials)
      setRateMaster(nextRateMaster)
      setChangeRequests(nextRequests)
      setMasterAdminGated(nextMasterAdminGate)
      setRateOverrideGated(nextRateOverrideGate)
      if (role === 'admin_owner') {
        setApprovalSettings(await fetchAllApprovalSettings())
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [hasAccess, role])

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

  async function guarded(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
      showSavedToast()
      await refreshData()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (!user) return null

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 lg:max-w-6xl">
        <p className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-400">
          {t('You do not have access to Costing.', 'आपके पास कॉस्टिंग तक पहुंच नहीं है।')}
        </p>
      </div>
    )
  }

  const closedHeats = heats.filter((h) => h.status === 'Closed')
  const pendingApprovalCount = changeRequests.filter(
    (r) => r.status === 'pending' && (r.target_table === 'rate_master' || r.target_table === 'heat_costing'),
  ).length

  const TABS: Array<{ id: Tab; en: string; hi: string }> = [
    { id: 'rate_master', en: 'Rate Master', hi: 'रेट मास्टर' },
    { id: 'heat_costing', en: 'Heat Costing', hi: 'हीट कॉस्टिंग' },
    { id: 'approval_settings', en: 'Approval Settings', hi: 'स्वीकृति सेटिंग्स' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:max-w-6xl">
      <header className="space-y-2">
        <BilingualText as="h1" en="Costing" hi="कॉस्टिंग" className="text-3xl font-bold text-slate-100" />
        <p className="text-sm text-slate-400">
          {t('Rate master, FIFO material cost, and full heat costing.', 'रेट मास्टर, फीफो मैटेरियल लागत, व पूर्ण हीट कॉस्टिंग।')}
        </p>
      </header>

      {error && <p className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm text-red-200">{error}</p>}

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {TABS.map((item) => {
          if (item.id === 'approval_settings' && role !== 'admin_owner') return null
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${
                tab === item.id
                  ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t(item.en, item.hi)}
            </button>
          )
        })}
      </div>

      {!loading && tab === 'rate_master' && (
        <>
          <RateMasterSection
            rows={rateMaster}
            materials={materials.filter((m) => m.active)}
            canPropose={canPropose}
            autoApproved={rateMasterAutoApproved}
            onCreate={(payload: RateMasterCreatePayload) =>
              guarded(async () => {
                if (role === 'admin_owner') {
                  await applyDirectChange(user, 'rate_master', 'create', payload, null)
                } else {
                  await proposeChange(user, 'rate_master', 'create', payload, null, rateMasterAutoApproved)
                }
              })
            }
          />
          {canDecide && pendingApprovalCount > 0 && (
            <ChangeRequestQueue
              requests={changeRequests.filter((r) => r.target_table === 'rate_master' || r.target_table === 'heat_costing')}
              canDecide={canDecide}
              onDecide={(request, approve, note) =>
                guarded(async () => {
                  await decideChangeRequest(user, request, approve, note)
                })
              }
            />
          )}
        </>
      )}

      {!loading && tab === 'heat_costing' && (
        <HeatCostingSection
          closedHeats={closedHeats}
          rateMaster={rateMaster}
          canManage={canPropose}
          canOverrideDirect={role === 'admin_owner'}
          overrideAutoApproved={overrideAutoApproved}
          onCompute={(heat, chargeLines) =>
            guarded(async () => {
              await computeAndSaveHeatCosting(user, heat, chargeLines)
            })
          }
          onUpdateBaseInputs={(costing: HeatCostingRow, inputs: HeatCostingBaseInputsPayload, ingotKg: number) =>
            guarded(async () => {
              await updateHeatCostingBaseInputs(costing, inputs, ingotKg)
            })
          }
          onProposeOverride={(costing: HeatCostingRow, newFinal: number, reason: string) =>
            guarded(async () => {
              const payload = { material_cost_final: newFinal, material_cost_override_reason: reason }
              if (role === 'admin_owner') {
                await applyDirectChange(user, 'heat_costing', 'update', payload, costing.id)
              } else {
                await proposeChange(user, 'heat_costing', 'update', payload, costing.id, overrideAutoApproved)
              }
            })
          }
        />
      )}

      {!loading && tab === 'approval_settings' && role === 'admin_owner' && (
        <ApprovalSettingsSection
          settings={approvalSettings}
          onToggle={(actionType, requiresOwnerApproval) =>
            guarded(async () => {
              await updateApprovalSetting(user, actionType, requiresOwnerApproval)
            })
          }
        />
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
