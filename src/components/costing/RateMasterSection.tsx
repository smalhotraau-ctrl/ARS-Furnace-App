import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import type { Material } from '../../types/masterAdmin'
import type { RateMasterCreatePayload, RateMasterRow } from '../../types/costing'

interface RateMasterSectionProps {
  rows: RateMasterRow[]
  materials: Material[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: RateMasterCreatePayload) => Promise<void>
}

type Mode = 'lot' | 'flat'

interface LotRow {
  key: number
  materialCode: string
  ratePerKg: string
  quantityKg: string
}

function emptyLotRow(key: number): LotRow {
  return { key, materialCode: '', ratePerKg: '', quantityKg: '' }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RateMasterSection({ rows, materials, canPropose, autoApproved, onCreate }: RateMasterSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<Mode>('lot')

  // Quick-add table for lot materials — one shared effective_from, per-row material/rate/qty
  // only (03i §2's minimum: material, rate/kg, quantity_kg). remaining_qty_kg is never entered
  // here at all — it's set equal to quantity_kg automatically on the write side
  // (masterAdminService.ts's applyChangeToTarget), same as before this change.
  const [lotEffectiveFrom, setLotEffectiveFrom] = useState(today)
  const [lotRows, setLotRows] = useState<LotRow[]>([emptyLotRow(0)])
  const [nextKey, setNextKey] = useState(1)

  // Flat-rate items never have a quantity at all — no field for it is rendered in this mode,
  // not just left optional.
  const [flatItem, setFlatItem] = useState('')
  const [flatRatePerKg, setFlatRatePerKg] = useState('')
  const [flatEffectiveFrom, setFlatEffectiveFrom] = useState(today)

  const [submitting, setSubmitting] = useState(false)

  function updateLotRow(key: number, patch: Partial<LotRow>) {
    setLotRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addLotRow() {
    setLotRows((prev) => [...prev, emptyLotRow(nextKey)])
    setNextKey((k) => k + 1)
  }

  function removeLotRow(key: number) {
    setLotRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))
  }

  function resetLotForm() {
    setLotRows([emptyLotRow(nextKey)])
    setNextKey((k) => k + 1)
    setLotEffectiveFrom(today())
  }

  const validLotRows = lotRows.filter((r) => r.materialCode && Number(r.ratePerKg) > 0 && Number(r.quantityKg) > 0)
  const canSubmitLots = validLotRows.length > 0 && lotEffectiveFrom.length > 0

  async function submitLots() {
    if (!canSubmitLots) return
    setSubmitting(true)
    try {
      // Saved together as one action from the user's point of view — each row is still its own
      // rate_master row/change-request underneath (no change to the FIFO engine or schema), just
      // fired off in one sitting instead of one full form per material.
      for (const row of validLotRows) {
        await onCreate({
          item: row.materialCode,
          item_type: 'lot_material',
          rate_per_kg: Number(row.ratePerKg),
          quantity_kg: Number(row.quantityKg),
          effective_from: lotEffectiveFrom,
        })
      }
      resetLotForm()
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmitFlat = flatItem.trim().length > 0 && Number(flatRatePerKg) > 0 && flatEffectiveFrom.length > 0

  async function submitFlat() {
    if (!canSubmitFlat) return
    setSubmitting(true)
    try {
      await onCreate({
        item: flatItem.trim(),
        item_type: 'flat_rate',
        rate_per_kg: Number(flatRatePerKg),
        quantity_kg: null,
        effective_from: flatEffectiveFrom,
      })
      setFlatItem('')
      setFlatRatePerKg('')
      setFlatEffectiveFrom(today())
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
            {t('Add rates', 'रेट जोड़ें')}
          </button>
        )}
      </div>

      {!autoApproved && canPropose && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm text-amber-200">
          {t('New/changed rates need Owner approval before they take effect.', 'नई/बदली रेट लागू होने से पहले मालिक की स्वीकृति आवश्यक है।')}
        </p>
      )}

      {adding && (
        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('lot')}
              className={`min-h-10 flex-1 rounded-xl text-sm font-semibold ${
                mode === 'lot' ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/40' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {t('Lot materials', 'लॉट मैटेरियल')}
            </button>
            <button
              type="button"
              onClick={() => setMode('flat')}
              className={`min-h-10 flex-1 rounded-xl text-sm font-semibold ${
                mode === 'flat' ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/40' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {t('Flat rate', 'फ्लैट रेट')}
            </button>
          </div>

          {mode === 'lot' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                {t(
                  'Enter as many materials as you need, then save them all together.',
                  'जितने भी मैटेरियल चाहिए दर्ज करें, फिर सभी को एक साथ सहेजें।',
                )}
              </p>

              <label className="block max-w-xs space-y-1">
                <span className="text-sm font-semibold text-slate-300">{t('Effective from', 'प्रभावी तिथि')}</span>
                <input
                  type="date"
                  value={lotEffectiveFrom}
                  onChange={(e) => setLotEffectiveFrom(e.target.value)}
                  className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4"
                />
              </label>

              <div className="space-y-2">
                {lotRows.map((row) => (
                  <div key={row.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-2">
                    <select
                      value={row.materialCode}
                      onChange={(e) => updateLotRow(row.key, { materialCode: e.target.value })}
                      className="min-h-11 min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm"
                    >
                      <option value="">{t('Material…', 'मैटेरियल…')}</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.code}>
                          {m.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder={t('₹/kg', '₹/किग्रा')}
                      value={row.ratePerKg}
                      onChange={(e) => updateLotRow(row.key, { ratePerKg: e.target.value })}
                      className="min-h-11 min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder={t('kg', 'किग्रा')}
                      value={row.quantityKg}
                      onChange={(e) => updateLotRow(row.key, { quantityKg: e.target.value })}
                      className="min-h-11 min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeLotRow(row.key)}
                      disabled={lotRows.length === 1}
                      className="min-h-11 rounded-lg px-2 text-sm text-red-300 disabled:opacity-30"
                      aria-label={t('Remove row', 'पंक्ति हटाएं')}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLotRow}
                className="w-full min-h-10 rounded-xl border border-dashed border-slate-600 text-sm font-semibold text-slate-300"
              >
                {t('+ Add row', '+ पंक्ति जोड़ें')}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false)
                    resetLotForm()
                  }}
                  className="flex-1 min-h-12 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300"
                >
                  {t('Cancel', 'रद्द करें')}
                </button>
                <button
                  type="button"
                  disabled={!canSubmitLots || submitting}
                  onClick={() => void submitLots()}
                  className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {submitting
                    ? t('Saving…', 'सहेजा जा रहा है…')
                    : validLotRows.length > 0
                      ? t(`Save ${validLotRows.length} rate(s)`, `${validLotRows.length} रेट सहेजें`)
                      : t('Save', 'सहेजें')}
                </button>
              </div>
            </div>
          )}

          {mode === 'flat' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                {t(
                  'Flat-rate items (electricity, labour, overhead, transport) have no quantity — just a rate.',
                  'फ्लैट रेट आइटम (इलेक्ट्रिसिटी, लेबर, ओवरहेड, परिवहन) में कोई मात्रा नहीं होती — केवल एक रेट।',
                )}
              </p>
              <div className="space-y-3 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-300">{t('Item name *', 'आइटम नाम *')}</span>
                  <input
                    value={flatItem}
                    onChange={(e) => setFlatItem(e.target.value)}
                    placeholder="e.g. electricity, labour, overhead, transport"
                    className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-300">{t('Rate (₹/kg) *', 'रेट (₹/किग्रा) *')}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={flatRatePerKg}
                    onChange={(e) => setFlatRatePerKg(e.target.value)}
                    className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-300">{t('Effective from', 'प्रभावी तिथि')}</span>
                  <input
                    type="date"
                    value={flatEffectiveFrom}
                    onChange={(e) => setFlatEffectiveFrom(e.target.value)}
                    className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4"
                  />
                </label>
              </div>
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
                  disabled={!canSubmitFlat || submitting}
                  onClick={() => void submitFlat()}
                  className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {submitting ? t('Saving…', 'सहेजा जा रहा है…') : t('Submit', 'भेजें')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-2">
          <BilingualText as="h3" en="Lot materials" hi="लॉट मैटेरियल" className="text-sm font-semibold text-slate-300" />
          {lots.length === 0 && <p className="text-sm text-slate-400">{t('No lot materials yet', 'अभी कोई लॉट मैटेरियल नहीं')}</p>}
          <ul className="space-y-2 lg:hidden">
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
          </ul>
          {lots.length > 0 && (
            <DesktopTable
              columns={[
                t('Material', 'मैटेरियल'),
                t('₹/kg', '₹/किग्रा'),
                t('Remaining', 'शेष'),
                t('From', 'से'),
              ]}
            >
              {lots.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <DeskTd className="font-semibold text-slate-100">{r.item}</DeskTd>
                  <DeskTd>₹{r.rate_per_kg}</DeskTd>
                  <DeskTd className={(r.remaining_qty_kg ?? 0) <= 0 ? 'text-red-400' : undefined}>
                    {r.remaining_qty_kg?.toFixed(1)} / {r.quantity_kg?.toFixed(1)} kg
                  </DeskTd>
                  <DeskTd className="text-slate-400">{r.effective_from}</DeskTd>
                </tr>
              ))}
            </DesktopTable>
          )}
        </div>

        <div className="space-y-2">
          <BilingualText as="h3" en="Flat-rate items" hi="फ्लैट रेट आइटम" className="text-sm font-semibold text-slate-300" />
          {flatRates.length === 0 && <p className="text-sm text-slate-400">{t('No flat-rate items yet', 'अभी कोई फ्लैट रेट आइटम नहीं')}</p>}
          <ul className="space-y-2 lg:hidden">
            {flatRates.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-100">{r.item}</p>
                  <p className="text-sm text-slate-400">{t('From', 'से')} {r.effective_from}</p>
                </div>
                <p className="text-sm text-slate-300">₹{r.rate_per_kg}/kg</p>
              </li>
            ))}
          </ul>
          {flatRates.length > 0 && (
            <DesktopTable
              columns={[t('Item', 'आइटम'), t('₹/kg', '₹/किग्रा'), t('From', 'से')]}
            >
              {flatRates.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40">
                  <DeskTd className="font-semibold text-slate-100">{r.item}</DeskTd>
                  <DeskTd>₹{r.rate_per_kg}</DeskTd>
                  <DeskTd className="text-slate-400">{r.effective_from}</DeskTd>
                </tr>
              ))}
            </DesktopTable>
          )}
        </div>
      </div>
    </section>
  )
}
