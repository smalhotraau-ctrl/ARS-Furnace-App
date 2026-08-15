import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { BilingualText } from '../ui/BilingualText'
import type { Material } from '../../types/masterAdmin'
import { RATE_ITEM_TYPES, type RateItemType, type RateMasterCreatePayload, type RateMasterRow } from '../../types/costing'

interface RateMasterSectionProps {
  rows: RateMasterRow[]
  materials: Material[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: RateMasterCreatePayload) => Promise<void>
}

const ITEM_TYPE_LABELS: Record<RateItemType, { en: string; hi: string }> = {
  lot_material: { en: 'Lot material (FIFO)', hi: 'लॉट मैटेरियल (फीफो)' },
  flat_rate: { en: 'Flat rate', hi: 'फ्लैट रेट' },
}

export function RateMasterSection({ rows, materials, canPropose, autoApproved, onCreate }: RateMasterSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [itemType, setItemType] = useState<RateItemType>('lot_material')
  const [materialCode, setMaterialCode] = useState('')
  const [flatItem, setFlatItem] = useState('')
  const [ratePerKg, setRatePerKg] = useState('')
  const [quantityKg, setQuantityKg] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)

  const item = itemType === 'lot_material' ? materialCode : flatItem.trim()
  const canSubmit =
    item.trim().length > 0 &&
    Number(ratePerKg) > 0 &&
    effectiveFrom &&
    (itemType === 'flat_rate' || Number(quantityKg) > 0)

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({
        item: item.trim(),
        item_type: itemType,
        rate_per_kg: Number(ratePerKg),
        quantity_kg: itemType === 'lot_material' ? Number(quantityKg) : null,
        effective_from: effectiveFrom,
      })
      setMaterialCode('')
      setFlatItem('')
      setRatePerKg('')
      setQuantityKg('')
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  const lots = rows.filter((r) => r.item_type === 'lot_material')
  const flatRates = rows.filter((r) => r.item_type === 'flat_rate')

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <BilingualText as="h2" en="Rate Master" hi="रेट मास्टर" className="text-lg font-semibold text-slate-100" />
        {canPropose && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300"
          >
            {t('Add rate', 'रेट जोड़ें')}
          </button>
        )}
      </div>

      {!autoApproved && canPropose && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm text-amber-200">
          {t('New/changed rates need Owner approval before they take effect.', 'नई/बदली रेट लागू होने से पहले मालिक की स्वीकृति आवश्यक है।')}
        </p>
      )}

      {adding && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Item type *" hi="आइटम प्रकार *" className="font-semibold" />
            <select
              value={itemType}
              onChange={(e) => setItemType(e.target.value as RateItemType)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            >
              {RATE_ITEM_TYPES.map((it) => (
                <option key={it} value={it}>
                  {t(ITEM_TYPE_LABELS[it].en, ITEM_TYPE_LABELS[it].hi)}
                </option>
              ))}
            </select>
          </label>

          {itemType === 'lot_material' ? (
            <label className="block space-y-2">
              <BilingualText as="span" en="Material *" hi="मैटेरियल *" className="font-semibold" />
              <select
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
              >
                <option value="">{t('Select material…', 'मैटेरियल चुनें…')}</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.code}>
                    {m.code} — {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block space-y-2">
              <BilingualText as="span" en="Item name *" hi="आइटम नाम *" className="font-semibold" />
              <input
                value={flatItem}
                onChange={(e) => setFlatItem(e.target.value)}
                placeholder="e.g. electricity, labour, overhead, transport"
                className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
              />
            </label>
          )}

          <label className="block space-y-2">
            <BilingualText as="span" en="Rate (₹/kg) *" hi="रेट (₹/किग्रा) *" className="font-semibold" />
            <input
              type="number"
              inputMode="decimal"
              value={ratePerKg}
              onChange={(e) => setRatePerKg(e.target.value)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            />
          </label>

          {itemType === 'lot_material' && (
            <label className="block space-y-2">
              <BilingualText as="span" en="Lot size (kg) *" hi="लॉट साइज़ (किग्रा) *" className="font-semibold" />
              <input
                type="number"
                inputMode="decimal"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
              />
            </label>
          )}

          <label className="block space-y-2">
            <BilingualText as="span" en="Effective from *" hi="प्रभावी तिथि *" className="font-semibold" />
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 min-h-12 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300"
            >
              {t('Cancel', 'रद्द करें')}
            </button>
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={() => void submit()}
              className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {t('Submit', 'भेजें')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <BilingualText as="h3" en="Lot materials" hi="लॉट मैटेरियल" className="text-sm font-semibold text-slate-300" />
        <ul className="space-y-2">
          {lots.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-100">{r.item}</p>
                <p className="text-sm text-slate-400">{t('From', 'से')} {r.effective_from}</p>
              </div>
              <p className="text-sm text-slate-300">
                ₹{r.rate_per_kg}/kg · {t('remaining', 'शेष')} {r.remaining_qty_kg?.toFixed(1)} / {r.quantity_kg?.toFixed(1)} kg
              </p>
              {(r.remaining_qty_kg ?? 0) <= 0 && (
                <p className="text-xs font-semibold text-red-400">{t('Fully consumed', 'पूरी तरह उपयोग हो गया')}</p>
              )}
            </li>
          ))}
          {lots.length === 0 && <p className="text-sm text-slate-400">{t('No lot materials yet', 'अभी कोई लॉट मैटेरियल नहीं')}</p>}
        </ul>
      </div>

      <div className="space-y-2">
        <BilingualText as="h3" en="Flat-rate items" hi="फ्लैट रेट आइटम" className="text-sm font-semibold text-slate-300" />
        <ul className="space-y-2">
          {flatRates.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-100">{r.item}</p>
                <p className="text-sm text-slate-400">{t('From', 'से')} {r.effective_from}</p>
              </div>
              <p className="text-sm text-slate-300">₹{r.rate_per_kg}/kg</p>
            </li>
          ))}
          {flatRates.length === 0 && <p className="text-sm text-slate-400">{t('No flat-rate items yet', 'अभी कोई फ्लैट रेट आइटम नहीं')}</p>}
        </ul>
      </div>
    </section>
  )
}
