const MONTH_LETTERS = 'ABCDEFGHIJKL'

export function monthLetter(date: Date): string {
  return MONTH_LETTERS[date.getMonth()] ?? 'A'
}

export function formatHeatNo(furnaceLetter: string, startDate: Date, sequence: number): string {
  const letter = furnaceLetter.toUpperCase()
  const month = monthLetter(startDate)
  const year = String(startDate.getFullYear()).slice(-2)
  const seqStr =
    sequence > 99 ? String(sequence).padStart(3, '0') : String(sequence).padStart(2, '0')
  return `${letter}${month}${year}-${seqStr}`
}

export function pendingSyncHeatNo(localId: string): string {
  return `PENDING-SYNC-${localId}`
}

export function isPendingSyncHeatNo(heatNo: string): boolean {
  return heatNo.startsWith('PENDING-SYNC-')
}

export function heatNoPrefix(furnaceLetter: string, startDate: Date): string {
  const year = String(startDate.getFullYear()).slice(-2)
  return `${furnaceLetter.toUpperCase()}${monthLetter(startDate)}${year}-`
}

export function parseSequenceFromHeatNo(heatNo: string, prefix: string): number | null {
  if (!heatNo.startsWith(prefix)) return null
  const seqPart = heatNo.slice(prefix.length)
  const seq = parseInt(seqPart, 10)
  return Number.isNaN(seq) ? null : seq
}

export function nextSequenceFromHeatNos(heatNos: string[], prefix: string): number {
  const sequences = heatNos
    .map((no) => parseSequenceFromHeatNo(no, prefix))
    .filter((seq): seq is number => seq != null)
  return sequences.length > 0 ? Math.max(...sequences) + 1 : 1
}
