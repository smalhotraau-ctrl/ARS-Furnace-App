import type { ReactNode, TdHTMLAttributes } from 'react'

/** Desktop-only record table. Pair with a `lg:hidden` card list so phones/tablets stay stacked. */
export function DesktopTable({ columns, children }: { columns: ReactNode[]; children: ReactNode }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-slate-700 lg:block">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900/70">
            {columns.map((col, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-400"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">{children}</tbody>
      </table>
    </div>
  )
}

export function DeskTd({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-2.5 align-middle text-slate-200 ${className}`} {...props} />
}
