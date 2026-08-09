import { useState } from 'react'
import type { Heat } from '../../types/heat'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface MakerCheckerFormsProps {
  heat: Heat | null
  canRequestCancel: boolean
  canRequestCorrection: boolean
  canDecide: boolean
  onCancelRequest: (reason: string) => Promise<void>
  onCorrectionRequest: (requestedHeatNo: string, reason: string) => Promise<void>
  onDecideCancel: (requestId: string, approve: boolean, note: string | null) => Promise<void>
  onDecideCorrection: (requestId: string, approve: boolean) => Promise<void>
  pendingCancels: Array<{ id: string; heat_id: string; reason: string }>
  pendingCorrections: Array<{ id: string; heat_id: string; original_heat_no: string; requested_heat_no: string; reason: string }>
}

export function MakerCheckerForms({
  heat,
  canRequestCancel,
  canRequestCorrection,
  canDecide,
  onCancelRequest,
  onCorrectionRequest,
  onDecideCancel,
  onDecideCorrection,
  pendingCancels,
  pendingCorrections,
}: MakerCheckerFormsProps) {
  const { t } = useLanguage()
  const [cancelReason, setCancelReason] = useState('')
  const [correctionNo, setCorrectionNo] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  return (
    <div className="space-y-4">
      {canRequestCancel && heat && isActive(heat) && (
        <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 space-y-3">
          <BilingualText as="h3" en="Request Heat Cancellation" hi="हीट रद्द करने का अनुरोध" className="font-bold" />
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3"
            placeholder={t('Reason', 'कारण')}
          />
          <button
            type="button"
            disabled={!cancelReason.trim()}
            onClick={() => void onCancelRequest(cancelReason).then(() => setCancelReason(''))}
            className="min-h-12 w-full rounded-xl bg-red-600/80 font-semibold disabled:opacity-50"
          >
            {t('Submit cancel request', 'अनुरोध भेजें')}
          </button>
        </section>
      )}

      {canRequestCorrection && heat && (
        <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 space-y-3">
          <BilingualText as="h3" en="Request Heat Number Correction" hi="हीट नंबर सुधार अनुरोध" className="font-bold" />
          <p className="text-sm text-slate-400">Current: {heat.heat_no}</p>
          <input
            value={correctionNo}
            onChange={(e) => setCorrectionNo(e.target.value)}
            placeholder={t('Requested heat no', 'अनुरोधित नंबर')}
            className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-900 px-4"
          />
          <textarea
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3"
            placeholder={t('Reason', 'कारण')}
          />
          <button
            type="button"
            disabled={!correctionNo.trim() || !correctionReason.trim()}
            onClick={() =>
              void onCorrectionRequest(correctionNo, correctionReason).then(() => {
                setCorrectionNo('')
                setCorrectionReason('')
              })
            }
            className="min-h-12 w-full rounded-xl border border-amber-500/40 bg-amber-950/30 font-semibold disabled:opacity-50"
          >
            {t('Submit correction request', 'सुधार अनुरोध')}
          </button>
        </section>
      )}

      {canDecide && pendingCancels.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
          <BilingualText as="h3" en="Pending Cancel Requests" hi="लंबित रद्द अनुरोध" className="font-bold" />
          {pendingCancels.map((req) => (
            <div key={req.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-300">{req.reason}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void onDecideCancel(req.id, true, null)} className="flex-1 min-h-10 rounded-lg bg-emerald-600 font-semibold">Approve</button>
                <button type="button" onClick={() => void onDecideCancel(req.id, false, null)} className="flex-1 min-h-10 rounded-lg bg-red-600 font-semibold">Reject</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {canDecide && pendingCorrections.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
          <BilingualText as="h3" en="Pending Heat No Corrections" hi="लंबित नंबर सुधार" className="font-bold" />
          {pendingCorrections.map((req) => (
            <div key={req.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
              <p className="text-sm">{req.original_heat_no} → {req.requested_heat_no}</p>
              <p className="text-sm text-slate-400">{req.reason}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void onDecideCorrection(req.id, true)} className="flex-1 min-h-10 rounded-lg bg-emerald-600 font-semibold">Approve</button>
                <button type="button" onClick={() => void onDecideCorrection(req.id, false)} className="flex-1 min-h-10 rounded-lg bg-red-600 font-semibold">Reject</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function isActive(heat: Heat): boolean {
  return heat.status !== 'Closed' && heat.status !== 'Cancelled'
}
