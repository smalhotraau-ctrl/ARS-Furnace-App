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
import { UserManagementSection } from '../components/masterAdmin/UserManagementSection'
import {
  applyDirectChange,
  decideChangeRequest,
  fetchAllFurnaces,
  fetchAllGradeSpecs,
  fetchAllMaterials,
  fetchAllMaterialStdComposition,
  fetchAllMaterialYieldStandards,
  fetchAllProcessCostStandards,
  fetchChangeRequests,
  fetchRequiresOwnerApproval,
  proposeChange,
} from '../lib/masterAdminService'
import { ProcessCostStandardsSection } from '../components/masterAdmin/ProcessCostStandardsSection'
import {
  decideUserChangeRequest,
  fetchAllUsers,
  fetchUserChangeRequests,
  proposeUserCreate,
  proposeUserRevoke,
} from '../lib/userManagementService'
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
import type { ManagedUser, UserChangeRequest } from '../types/userManagement'
import type { ProcessCostStandardCreatePayload, ProcessCostStandardRow } from '../types/costing'
import type { UserRole } from '../types/auth'

type Tab =
  | 'furnaces'
  | 'grade_specs'
  | 'materials'
  | 'material_std_composition'
  | 'material_yield_standards'
  | 'process_cost_standards'
  | 'users'
  | 'approvals'

export function MasterAdminPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const role = user!.role

  // 03i/03b: Supervisor and QA have zero access to this module — enforced by RLS on every
  // table it touches, this is just the matching UI-level guard so they never even see the shell.
  const hasAccess = role === 'plant_head' || role === 'admin_owner'
  const canPropose = hasAccess
  const canDecide = role === 'admin_owner'
  // Pattern A: Plant Head is the only maker for logins. Owner never writes a request row
  // (and the INSERT policy is Plant-Head-only), matching heat_cancel_requests.
  const canProposeUsers = role === 'plant_head'

  const [tab, setTab] = useState<Tab>('furnaces')
  const [furnaces, setFurnaces] = useState<Furnace[]>([])
  const [gradeSpecs, setGradeSpecs] = useState<GradeSpecRow[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialStd, setMaterialStd] = useState<MaterialStdCompositionRow[]>([])
  const [yieldStandards, setYieldStandards] = useState<MaterialYieldStandardRow[]>([])
  const [processCostStandards, setProcessCostStandards] = useState<ProcessCostStandardRow[]>([])
  const [changeRequests, setChangeRequests] = useState<MasterAdminChangeRequest[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [userChangeRequests, setUserChangeRequests] = useState<UserChangeRequest[]>([])
  const [revealedPin, setRevealedPin] = useState<{ username: string; pin: string } | null>(null)
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
      const [
        nextFurnaces,
        nextGradeSpecs,
        nextMaterials,
        nextMaterialStd,
        nextYield,
        nextProcessCost,
        nextRequests,
        nextGate,
        nextUsers,
        nextUserRequests,
      ] = await Promise.all([
        fetchAllFurnaces(),
        fetchAllGradeSpecs(),
        fetchAllMaterials(),
        fetchAllMaterialStdComposition(),
        fetchAllMaterialYieldStandards(),
        fetchAllProcessCostStandards(),
        fetchChangeRequests(),
        fetchRequiresOwnerApproval(),
        fetchAllUsers(),
        fetchUserChangeRequests(),
      ])
      setFurnaces(nextFurnaces)
      setGradeSpecs(nextGradeSpecs)
      setMaterials(nextMaterials)
      setMaterialStd(nextMaterialStd)
      setYieldStandards(nextYield)
      setProcessCostStandards(nextProcessCost)
      setChangeRequests(nextRequests)
      setRequiresOwnerApproval(nextGate)
      setUsers(nextUsers)
      setUserChangeRequests(nextUserRequests)
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
      <div className="mx-auto max-w-3xl px-4 py-6 lg:max-w-6xl">
        <p className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-400">
          {t('You do not have access to Master Admin.', 'आपके पास मास्टर एडमिन तक पहुंच नहीं है।')}
        </p>
      </div>
    )
  }

  const pendingApprovalCount = changeRequests.filter((r) => r.status === 'pending').length
  const pendingUserCount = userChangeRequests.filter((r) => r.status === 'pending').length

  const TABS: Array<{ id: Tab; en: string; hi: string }> = [
    { id: 'furnaces', en: 'Furnaces', hi: 'फर्नेस' },
    { id: 'grade_specs', en: 'Grade Specs', hi: 'ग्रेड स्पेक' },
    { id: 'materials', en: 'Materials', hi: 'मैटेरियल' },
    { id: 'material_std_composition', en: 'Std. Composition', hi: 'स्टैंडर्ड संरचना' },
    { id: 'material_yield_standards', en: 'Yield Standards', hi: 'यील्ड स्टैंडर्ड' },
    { id: 'process_cost_standards', en: 'Process Costs', hi: 'प्रक्रिया लागत' },
    { id: 'users', en: 'Users', hi: 'यूज़र' },
    { id: 'approvals', en: 'Approvals', hi: 'स्वीकृतियाँ' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:max-w-6xl">
      <header className="space-y-2">
        <BilingualText as="h1" en="Master Admin" hi="मास्टर एडमिन" className="text-3xl font-bold text-slate-100" />
        <p className="text-sm text-slate-400">
          {t(
            'Furnaces, grade specs, materials, yield standards, and logins.',
            'फर्नेस, ग्रेड स्पेक, मैटेरियल, यील्ड स्टैंडर्ड व लॉगिन।',
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
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-on-accent">
                {pendingApprovalCount}
              </span>
            )}
            {item.id === 'users' && pendingUserCount > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-on-accent">
                {pendingUserCount}
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

      {!loading && tab === 'process_cost_standards' && (
        <ProcessCostStandardsSection
          rows={processCostStandards}
          canPropose={canPropose}
          autoApproved={autoApproved}
          onCreate={(payload: ProcessCostStandardCreatePayload) =>
            submitChange('process_cost_standards', 'create', payload, null)
          }
        />
      )}

      {!loading && tab === 'users' && (
        <UserManagementSection
          users={users}
          requests={userChangeRequests}
          canPropose={canProposeUsers}
          canDecide={canDecide}
          revealedPin={revealedPin}
          onDismissPin={() => setRevealedPin(null)}
          onProposeCreate={(username: string, nextRole: UserRole) =>
            guarded(async () => {
              await proposeUserCreate(user, { username, role: nextRole })
            })
          }
          onProposeRevoke={(target: ManagedUser) =>
            guarded(async () => {
              await proposeUserRevoke(user, target)
            })
          }
          onDecide={(request, approve, note) =>
            guarded(async () => {
              const result = await decideUserChangeRequest(user, request, approve, note)
              if (result.pin) {
                setRevealedPin({ username: request.payload.username, pin: result.pin })
              }
            })
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
