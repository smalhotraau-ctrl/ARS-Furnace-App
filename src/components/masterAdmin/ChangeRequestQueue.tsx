import { useState } from 'react'
import type { MasterAdminChangeRequest } from '../../types/masterAdmin'
import { MASTER_ADMIN_TABLE_LABELS } from '../../types/masterAdmin'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { useLanguage } from '../../context/LanguageContext'

interface ChangeRequestQueueProps {
  requests: MasterAdminChangeRequest[]
  canDecide: boolean
  onDecide: (request: MasterAdminChangeRequest, approve: boolean, note: string | null) => Promise<void>
}

function summarizePayload(request: MasterAdminChangeRequest): string {
  const p = request.payload
  switch (request.target_table) {
    case 'furnaces':
      return request.action === 'create'
        ? `${p.code ?? ''} — ${p.name ?? ''} (${p.type ?? ''}${p.heat_code_letter ? `, letter ${p.heat_code_letter}` : ''})`
        : JSON.stringify(p)
    case 'grade_specs': {
      const elements = Array.isArray(p.elements) ? (p.elements as Array<{ element: string }>).length : 0
      return `${p.grade_code ?? ''} (${elements} elements)${p.supersedes_grade_code ? ` — replaces ${p.supersedes_grade_code}` : ''}`
    }
    case 'materials':
      return request.action === 'create' ? `${p.code ?? ''} — ${p.name ?? ''}` : JSON.stringify(p)
    case 'material_std_composition': {
      const elements = Array.isArray(p.elements) ? (p.elements as Array<{ element: string }>).length : 0
      return request.action === 'create' ? `${p.material_code ?? ''} (${elements} elements)` : JSON.stringify(p)
    }
    case 'material_yield_standards':
      return request.action === 'create'
        ? `${p.material_code ?? ''} — ${p.metric ?? ''}: ${p.min_pct ?? ''}–${p.max_pct ?? ''}%`
        : JSON.stringify(p)
    case 'rate_master':
      return request.action === 'create'
        ? `${p.item ?? ''} — ₹${p.rate_per_kg ?? ''}/kg from ${p.effective_from ?? ''}`
        : JSON.stringify(p)
    case 'heat_costing':
      return `Override material cost to ₹${p.material_cost_final ?? ''} — ${p.material_cost_override_reason ?? ''}`
    case 'process_cost_standards':
      return `From ${p.effective_from ?? ''}: fuel ₹${p.fuel_cost_per_kg ?? ''}, labour ₹${p.manpower_cost_per_kg ?? ''}, consumables ₹${p.consumables_cost_per_kg ?? ''}, elec/transport ₹${p.electrical_transport_cost_per_kg ?? ''}/kg`
    default:
      return JSON.stringify(p)
  }
}

export function ChangeRequestQueue({ requests, canDecide, onDecide }: ChangeRequestQueueProps) {
  const { t } = useLanguage()
  const [noteByRequest, setNoteByRequest] = useState<Record<string, string>>({})

  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')
  const historyRows = [...pending.filter(() => !canDecide), ...decided]

  return (
    <section className="space-y-6">
      {canDecide && (
        <div className="space-y-3">
          <BilingualText
            as="h2"
            en="Pending Master Admin Approvals"
            hi="लंबित मास्टर एडमिन स्वीकृतियाँ"
            className="text-lg font-semibold text-slate-100"
          />
          {pending.length === 0 && (
            <p className="text-sm text-slate-400">{t('Nothing pending', 'कुछ भी लंबित नहीं')}</p>
          )}
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {pending.map((req) => (
              <div key={req.id} className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
              <p className="font-semibold text-slate-100">
                {t(MASTER_ADMIN_TABLE_LABELS[req.target_table].en, MASTER_ADMIN_TABLE_LABELS[req.target_table].hi)} ·{' '}
                {req.action === 'create' ? t('New', 'नया') : t('Update', 'अपडेट')}
              </p>
              <p className="text-sm text-slate-300">{summarizePayload(req)}</p>
              <p className="text-xs text-slate-500">{new Date(req.requested_at).toLocaleString()}</p>
              <textarea
                value={noteByRequest[req.id] ?? ''}
                onChange={(e) => setNoteByRequest((prev) => ({ ...prev, [req.id]: e.target.value }))}
                rows={2}
                placeholder={t('Decision note (optional)', 'निर्णय टिप्पणी (वैकल्पिक)')}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void onDecide(req, true, noteByRequest[req.id]?.trim() || null)}
                  className="flex-1 min-h-10 rounded-lg bg-emerald-600 text-sm font-semibold"
                >
                  {t('Approve', 'स्वीकृत करें')}
                </button>
                <button
                  type="button"
                  onClick={() => void onDecide(req, false, noteByRequest[req.id]?.trim() || null)}
                  className="flex-1 min-h-10 rounded-lg bg-red-600 text-sm font-semibold"
                >
                  {t('Reject', 'अस्वीकृत करें')}
                </button>
              </div>
            </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <BilingualText
          as="h2"
          en="Change Request History"
          hi="बदलाव अनुरोध इतिहास"
          className="text-lg font-semibold text-slate-100"
        />
        {historyRows.length === 0 && !canDecide && pending.length === 0 && (
          <p className="text-sm text-slate-400">{t('No change requests yet', 'अभी कोई बदलाव अनुरोध नहीं')}</p>
        )}

        <div className="space-y-3 lg:hidden">
          {historyRows.map((req) => (
            <div key={req.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-100">
                  {t(MASTER_ADMIN_TABLE_LABELS[req.target_table].en, MASTER_ADMIN_TABLE_LABELS[req.target_table].hi)} ·{' '}
                  {req.action === 'create' ? t('New', 'नया') : t('Update', 'अपडेट')}
                </p>
                <span
                  className={`text-xs font-semibold ${
                    req.status === 'approved'
                      ? 'text-emerald-400'
                      : req.status === 'rejected'
                        ? 'text-red-400'
                        : 'text-amber-400'
                  }`}
                >
                  {req.status === 'approved'
                    ? t('Approved', 'स्वीकृत')
                    : req.status === 'rejected'
                      ? t('Rejected', 'अस्वीकृत')
                      : t('Pending', 'लंबित')}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{summarizePayload(req)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t('Requested', 'अनुरोधित')} {new Date(req.requested_at).toLocaleString()}
                {req.decided_at && ` · ${t('Decided', 'निर्णय')} ${new Date(req.decided_at).toLocaleString()}`}
              </p>
              {req.decision_note && <p className="mt-1 text-xs text-slate-400">{req.decision_note}</p>}
            </div>
          ))}
        </div>

        {historyRows.length > 0 && (
          <DesktopTable
            columns={[
              t('Table', 'तालिका'),
              t('Action', 'कार्रवाई'),
              t('Summary', 'सारांश'),
              t('Status', 'स्थिति'),
              t('Requested', 'अनुरोधित'),
              t('Note', 'टिप्पणी'),
            ]}
          >
            {historyRows.map((req) => (
              <tr key={req.id} className="hover:bg-slate-800/40">
                <DeskTd className="font-semibold text-slate-100">
                  {t(MASTER_ADMIN_TABLE_LABELS[req.target_table].en, MASTER_ADMIN_TABLE_LABELS[req.target_table].hi)}
                </DeskTd>
                <DeskTd>{req.action === 'create' ? t('New', 'नया') : t('Update', 'अपडेट')}</DeskTd>
                <DeskTd className="max-w-md whitespace-normal">{summarizePayload(req)}</DeskTd>
                <DeskTd
                  className={
                    req.status === 'approved'
                      ? 'text-emerald-400'
                      : req.status === 'rejected'
                        ? 'text-red-400'
                        : 'text-amber-400'
                  }
                >
                  {req.status === 'approved'
                    ? t('Approved', 'स्वीकृत')
                    : req.status === 'rejected'
                      ? t('Rejected', 'अस्वीकृत')
                      : t('Pending', 'लंबित')}
                </DeskTd>
                <DeskTd className="whitespace-nowrap text-slate-400">
                  {new Date(req.requested_at).toLocaleString()}
                </DeskTd>
                <DeskTd className="max-w-xs whitespace-normal text-slate-400">{req.decision_note ?? '—'}</DeskTd>
              </tr>
            ))}
          </DesktopTable>
        )}
      </div>
    </section>
  )
}
