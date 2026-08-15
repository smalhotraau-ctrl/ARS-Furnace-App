import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { BilingualText } from '../components/ui/BilingualText'
import { SavedConfirmation } from '../components/ui/SavedConfirmation'
import { FurnaceSection } from '../components/masterAdmin/FurnaceSection'
import { GradeSpecSection } from '../components/masterAdmin/GradeSpecSection'
import { MaterialSection } from '../components/masterAdmin/MaterialSection'
import { MaterialStdCompositionSection } from '../components/masterAdmin/MaterialStdCompositionSection'
import { MaterialYieldStandardSection } from '../components/masterAdmin/MaterialYieldStandardSection'
import { ChangeRequestQueue } from '../components/masterAdmin/ChangeRequestQueue'
import {
  applyDirectChange,
  decideChangeRequest,
  fetchAllFurnaces,
  fetchAllGradeSpecs,
  fetchAllMaterials,
  fetchAllMaterialStdComposition,
  fetchAllMaterialYieldStandards,
  fetchChangeRequests,
  fetchRequiresOwnerApproval,
  proposeChange,
} from '../lib/masterAdminService'
import type {
  Furnace,
  FurnaceCreatePayload,
  FurnaceUpdatePayload,
  GradeSpecCreatePayload,
  GradeSpecRow,
  Material,
  MaterialCreatePayload,
  MaterialStdCompositionCreatePayload,
  MaterialStdCompositionRow,
  MaterialStdCompositionUpdatePayload,
  MaterialUpdatePayload,
  MaterialYieldStandardCreatePayload,
  MaterialYieldStandardRow,
  MaterialYieldStandardUpdatePayload,
  MasterAdminAction,
  MasterAdminChangeRequest,
  MasterAdminPayload,
  MasterAdminTargetTable,
} from '../types/masterAdmin'

type Tab = 'furnaces' | 'grade_specs' | 'materials' | 'material_std_composition' | 'material_yield_standards' | 'approvals'

export function MasterAdminPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  // 03i/03b: Supervisor and QA have zero access to this module — enforced by RLS on every
  // table it touches, this is just the matching UI-level guard so they never even see the shell.
  const hasAccess = role === 'plant_head' || role === 'admin_owner'
  const canPropose = hasAccess
  const canDecide = role === 'admin_owner'

  const [tab, setTab] = useState<Tab>('furnaces')
  const [furnaces, setFurnaces] = useState<Furnace[]>([])
  const [gradeSpecs, setGradeSpecs] = useState<GradeSpecRow[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialStd, setMaterialStd] = useState<MaterialStdCompositionRow[]>([])
  const [yieldStandards, setYieldStandards] = useState<MaterialYieldStandardRow[]>([])
  const [changeRequests, setChangeRequests] = useState<MasterAdminChangeRequest[]>([])
  const [requiresOwnerApproval, setRequiresOwnerApproval] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedVisible, setSavedVisible] = useState(false)

  // Owner has "Full edit; checker" per 03b — their own proposals never actually wait, since they
  // can decide any pending request themselves regardless of the gate. Plant Head's proposals are
  // only immediate when the Owner has switched the gate off.
  const autoApproved = role === 'admin_owner' || !requiresOwnerApproval

  const refreshData = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false)
      return
    }
    try {
      const [nextFurnaces, nextGradeSpecs, nextMaterials, nextMaterialStd, nextYield, nextRequests, nextGate] =
        await Promise.all([
          fetchAllFurnaces(),
          fetchAllGradeSpecs(),
          fetchAllMaterials(),
          fetchAllMaterialStdComposition(),
          fetchAllMaterialYieldStandards(),
          fetchChangeRequests(),
          fetchRequiresOwnerApproval(),
        ])
      setFurnaces(nextFurnaces)
      setGradeSpecs(nextGradeSpecs)
      setMaterials(nextMaterials)
      setMaterialStd(nextMaterialStd)
      setYieldStandards(nextYield)
      setChangeRequests(nextRequests)
      setRequiresOwnerApproval(nextGate)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [hasAccess])

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

  // Owner has full, direct edit rights and is never a "maker" here — their edits skip
  // master_admin_change_requests entirely (see applyDirectChange). Plant Head always proposes;
  // whether that applies immediately or waits for Owner depends on the approval_settings gate.
  function submitChange(
    targetTable: MasterAdminTargetTable,
    action: MasterAdminAction,
    payload: MasterAdminPayload,
    targetId: string | null,
  ) {
    return guarded(async () => {
      if (role === 'admin_owner') {
        await applyDirectChange(user!, targetTable, action, payload, targetId)
      } else {
        await proposeChange(user!, targetTable, action, payload, targetId, autoApproved)
      }
    })
  }

  if (!user) return null

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-400">
          {t('You do not have access to Master Admin.', 'आपके पास मास्टर एडमिन तक पहुंच नहीं है।')}
        </p>
      </div>
    )
  }

  const pendingApprovalCount = changeRequests.filter((r) => r.status === 'pending').length

  const TABS: Array<{ id: Tab; en: string; hi: string }> = [
    { id: 'furnaces', en: 'Furnaces', hi: 'फर्नेस' },
    { id: 'grade_specs', en: 'Grade Specs', hi: 'ग्रेड स्पेक' },
    { id: 'materials', en: 'Materials', hi: 'मैटेरियल' },
    { id: 'material_std_composition', en: 'Std. Composition', hi: 'स्टैंडर्ड संरचना' },
    { id: 'material_yield_standards', en: 'Yield Standards', hi: 'यील्ड स्टैंडर्ड' },
    { id: 'approvals', en: 'Approvals', hi: 'स्वीकृतियाँ' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-2">
        <BilingualText as="h1" en="Master Admin" hi="मास्टर एडमिन" className="text-3xl font-bold text-slate-100" />
        <p className="text-sm text-slate-400">
          {t(
            'Furnaces, grade specs, materials, standard composition and yield standards.',
            'फर्नेस, ग्रेड स्पेक, मैटेरियल, स्टैंडर्ड संरचना व यील्ड स्टैंडर्ड।',
          )}
        </p>
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm text-red-200">{error}</p>
      )}

      {loading && <p className="text-center text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {TABS.map((item) => (
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
            {item.id === 'approvals' && pendingApprovalCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950">
                {pendingApprovalCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {!loading && tab === 'furnaces' && (
        <FurnaceSection
          furnaces={furnaces}
          canPropose={canPropose}
          autoApproved={autoApproved}
          onCreate={(payload: FurnaceCreatePayload) => submitChange('furnaces', 'create', payload, null)}
          onUpdate={(furnaceId: string, payload: FurnaceUpdatePayload) =>
            submitChange('furnaces', 'update', payload, furnaceId)
          }
        />
      )}

      {!loading && tab === 'grade_specs' && (
        <GradeSpecSection
          gradeSpecs={gradeSpecs}
          canPropose={canPropose}
          autoApproved={autoApproved}
          onCreate={(payload: GradeSpecCreatePayload) => submitChange('grade_specs', 'create', payload, null)}
        />
      )}

      {!loading && tab === 'materials' && (
        <MaterialSection
          materials={materials}
          canPropose={canPropose}
          autoApproved={autoApproved}
          onCreate={(payload: MaterialCreatePayload) => submitChange('materials', 'create', payload, null)}
          onUpdate={(materialId: string, payload: MaterialUpdatePayload) =>
            submitChange('materials', 'update', payload, materialId)
          }
        />
      )}

      {!loading && tab === 'material_std_composition' && (
        <MaterialStdCompositionSection
          rows={materialStd}
          materials={materials.filter((m) => m.active)}
          canPropose={canPropose}
          autoApproved={autoApproved}
          onCreate={(payload: MaterialStdCompositionCreatePayload) =>
            submitChange('material_std_composition', 'create', payload, null)
          }
          onUpdate={(rowId: string, payload: MaterialStdCompositionUpdatePayload) =>
            submitChange('material_std_composition', 'update', payload, rowId)
          }
        />
      )}

      {!loading && tab === 'material_yield_standards' && (
        <MaterialYieldStandardSection
          rows={yieldStandards}
          materials={materials.filter((m) => m.active)}
          canPropose={canPropose}
          autoApproved={autoApproved}
          onCreate={(payload: MaterialYieldStandardCreatePayload) =>
            submitChange('material_yield_standards', 'create', payload, null)
          }
          onUpdate={(rowId: string, payload: MaterialYieldStandardUpdatePayload) =>
            submitChange('material_yield_standards', 'update', payload, rowId)
          }
        />
      )}

      {!loading && tab === 'approvals' && (
        <ChangeRequestQueue
          requests={changeRequests}
          canDecide={canDecide}
          onDecide={(request, approve, note) =>
            guarded(async () => {
              await decideChangeRequest(user, request, approve, note)
            })
          }
        />
      )}

      <SavedConfirmation visible={savedVisible} />
    </div>
  )
}
