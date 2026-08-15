import { useMemo, useState } from 'react'
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

interface RateRow {
  key: number
  item: string
  ratePerKg: string
}

const EXTRA_ITEMS = ['electricity', 'labour', 'overhead', 'transport']

function emptyRateRow(key: number): RateRow {
  return { key, item: '', ratePerKg: '' }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function RateMasterSection({ rows, materials, canPropose, autoApproved, onCreate }: RateMasterSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [rateRows, setRateRows] = useState<RateRow[]>([emptyRateRow(0)])
  const [nextKey, setNextKey] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const itemOptions = useMemo(() => {
    const codes = materials.map((m) => m.code)
    const extras = EXTRA_ITEMS.filter((item) => !codes.includes(item))
    return [...codes, ...extras]
  }, [materials])

  function updateRow(key: number, patch: Partial<RateRow>) {
    setRateRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRateRows((prev) => [...prev, emptyRateRow(nextKey)])
    setNextKey((k) => k + 1)
  }

  function removeRow(key: number) {
    setRateRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev))
  }

  function resetForm() {
    setRateRows([emptyRateRow(nextKey)])
    setNextKey((k) => k + 1)
    setEffectiveFrom(today())
  }

  const validRows = rateRows.filter((r) => r.item && Number(r.ratePerKg) > 0)
  const canSubmit = validRows.length > 0 && effectiveFrom.length > 0

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      for (const row of validRows) {
        await onCreate({
          item: row.item,
          rate_per_kg: Number(row.ratePerKg),
          effective_from: effectiveFrom,
        })
      }
      resetForm()
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  const todayIso = today()
  const currentByItem = useMemo(() => {
    const map = new Map<string, RateMasterRow>()
    for (const row of rows) {
      if (row.effective_from > todayIso) continue
      const existing = map.get(row.item)
      if (!existing || row.effective_from > existing.effective_from) map.set(row.item, row)
    }
    return map
  }, [rows, todayIso])

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const itemCmp = a.item.localeCompare(b.item)
        if (itemCmp !== 0) return itemCmp
        return b.effective_from.localeCompare(a.effective_from)
      }),
    [rows],
  )

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

      <p className="text-sm text-slate-400">
        {t(
          'One current rate per material, versioned by effective date. A heat uses the latest rate on or before its close date.',
          'प्रत्येक मैटेरियल का एक चालू रेट, प्रभावी तिथि से संस्करणित। हीट अपनी बंद तिथि तक का नवीनतम रेट इस्तेमाल करती है।',
        )}
      </p>

      {!autoApproved && canPropose && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm text-amber-200">
          {t('New/changed rates need Owner approval before they take effect.', 'नई/बदली रेट लागू होने से पहले मालिक की स्वीकृति आवश्यक है।')}
        </p>
      )}

      {adding && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
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
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4"
            />
          </label>

          <div className="space-y-2">
            {rateRows.map((row) => (
              <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-2">
                <select
                  value={row.item}
                  onChange={(e) => updateRow(row.key, { item: e.target.value })}
                  className="min-h-11 min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm"
                >
                  <option value="">{t('Material / item…', 'मैटेरियल / आइटम…')}</option>
                  {itemOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={t('₹/kg', '₹/किग्रा')}
                  value={row.ratePerKg}
                  onChange={(e) => updateRow(row.key, { ratePerKg: e.target.value })}
                  className="min-h-11 min-w-0 rounded-lg border border-slate-600 bg-slate-800 px-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  disabled={rateRows.length === 1}
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
            onClick={addRow}
            className="w-full min-h-10 rounded-xl border border-dashed border-slate-600 text-sm font-semibold text-slate-300"
          >
            {t('+ Add row', '+ पंक्ति जोड़ें')}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                resetForm()
              }}
              className="flex-1 min-h-12 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300"
            >
              {t('Cancel', 'रद्द करें')}
            </button>
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={() => void submit()}
              className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {submitting
                ? t('Saving…', 'सहेजा जा रहा है…')
                : validRows.length > 0
                  ? t(`Save ${validRows.length} rate(s)`, `${validRows.length} रेट सहेजें`)
                  : t('Save', 'सहेजें')}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 && <p className="text-sm text-slate-400">{t('No rates yet', 'अभी कोई रेट नहीं')}</p>}

      <ul className="space-y-2 lg:hidden">
        {sorted.map((r) => {
          const isCurrent = currentByItem.get(r.item)?.id === r.id
          return (
            <li key={r.id} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-100">{r.item}</p>
                <p className="text-sm text-slate-400">
                  {t('From', 'से')} {r.effective_from}
                </p>
              </div>
              <p className="text-sm text-slate-300">₹{r.rate_per_kg}/kg</p>
              {isCurrent && (
                <p className="text-xs font-semibold text-emerald-400">{t('Current', 'चालू')}</p>
              )}
            </li>
          )
        })}
      </ul>

      {sorted.length > 0 && (
        <DesktopTable
          columns={[
            t('Item', 'आइटम'),
            t('₹/kg', '₹/किग्रा'),
            t('From', 'से'),
            t('Status', 'स्थिति'),
          ]}
        >
          {sorted.map((r) => {
            const isCurrent = currentByItem.get(r.item)?.id === r.id
            return (
              <tr key={r.id} className="hover:bg-slate-800/40">
                <DeskTd className="font-semibold text-slate-100">{r.item}</DeskTd>
                <DeskTd>₹{r.rate_per_kg}</DeskTd>
                <DeskTd className="text-slate-400">{r.effective_from}</DeskTd>
                <DeskTd>
                  {isCurrent ? (
                    <span className="text-emerald-400">{t('Current', 'चालू')}</span>
                  ) : r.effective_from > todayIso ? (
                    <span className="text-slate-400">{t('Future', 'भविष्य')}</span>
                  ) : (
                    <span className="text-slate-500">{t('Superseded', 'बदला गया')}</span>
                  )}
                </DeskTd>
              </tr>
            )
          })}
        </DesktopTable>
      )}
    </section>
  )
}
