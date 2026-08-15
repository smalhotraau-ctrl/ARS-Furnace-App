import type { ExpectedCompositionEntry } from '../../types/batchPlan'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { useLanguage } from '../../context/LanguageContext'

interface ExpectedCompositionPanelProps {
  composition: ExpectedCompositionEntry[]
}

export function ExpectedCompositionPanel({ composition }: ExpectedCompositionPanelProps) {
  const { t } = useLanguage()

  if (composition.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-600 p-5 text-center text-slate-400">
        <p>{t('Add material lines to see expected composition', 'अपेक्षित संरचना देखने के लिए सामग्री जोड़ें')}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText
        as="h3"
        en="Expected Composition"
        hi="अपेक्षित संरचना"
        className="text-lg font-bold text-slate-100"
      />
      <p className="mt-1 text-sm text-slate-400">
        {t('Advisory only — does not block saving', 'केवल सलाह — सहेजने से नहीं रोकता')}
      </p>
      <ul className="mt-4 space-y-3 lg:hidden">
        {composition.map((entry) => {
          const inSpec = entry.spec_flag === 'in_spec'
          return (
            <li
              key={entry.element}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                inSpec ? 'bg-emerald-950/50 border border-emerald-500/30' : 'bg-red-950/50 border border-red-500/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold ${
                    inSpec ? 'bg-emerald-500 text-on-accent' : 'bg-red-500 text-white'
                  }`}
                >
                  {inSpec ? '✓' : '✕'}
                </span>
                <div>
                  <p className="font-semibold text-slate-100">{entry.element}</p>
                  <p className="text-sm text-slate-400">
                    {inSpec ? t('Within standard', 'मानक के अंदर') : t('Out of standard', 'मानक से बाहर')}
                  </p>
                </div>
              </div>
              <p className="text-xl font-bold text-slate-100">
                {entry.expected_pct.toFixed(3)}%
              </p>
            </li>
          )
        })}
      </ul>
      <div className="mt-4">
        <DesktopTable
          columns={[t('Element', 'तत्व'), t('%', '%'), t('Spec', 'स्पेक')]}
        >
          {composition.map((entry) => {
            const inSpec = entry.spec_flag === 'in_spec'
            return (
              <tr key={entry.element} className="hover:bg-slate-800/40">
                <DeskTd className="font-semibold text-slate-100">{entry.element}</DeskTd>
                <DeskTd>{entry.expected_pct.toFixed(3)}</DeskTd>
                <DeskTd className={inSpec ? 'text-emerald-300' : 'text-red-300'}>
                  {inSpec ? t('Within standard', 'मानक के अंदर') : t('Out of standard', 'मानक से बाहर')}
                </DeskTd>
              </tr>
            )
          })}
        </DesktopTable>
      </div>
    </section>
  )
}
