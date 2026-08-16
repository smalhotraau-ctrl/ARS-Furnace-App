import type { CycleStage, CycleLogEntry, HeatStatus } from '../types/heat'

const STATUS_ORDER: HeatStatus[] = [
  'Planned',
  'Charging',
  'Melting',
  'Casting',
  'Output Entered',
  'Closed',
  'Cancelled',
]

export function statusRank(status: HeatStatus): number {
  const rank = STATUS_ORDER.indexOf(status)
  return rank >= 0 ? rank : 0
}

export function heatStatusForCycleStage(stage: CycleStage): HeatStatus {
  switch (stage) {
    case 'preheating':
    case 'charging':
      return 'Charging'
    case 'melting':
    case 'drossing':
    case 'iron_removal':
    case 'alloying':
    case 'degassing':
      return 'Melting'
    case 'casting':
    case 'cleaning':
      return 'Casting'
    default:
      return 'Charging'
  }
}

export function deriveHeatStatus(
  current: HeatStatus,
  cycleEntries: CycleLogEntry[],
  hasChargeLines: boolean,
): HeatStatus {
  if (current === 'Closed' || current === 'Cancelled' || current === 'Output Entered') {
    return current
  }

  let derived: HeatStatus = current
  if (hasChargeLines && statusRank('Charging') > statusRank(derived)) {
    derived = 'Charging'
  }

  for (const entry of cycleEntries) {
    const fromStage = heatStatusForCycleStage(entry.stage)
    if (statusRank(fromStage) > statusRank(derived)) {
      derived = fromStage
    }
  }

  return derived
}

export function shouldAdvanceHeatStatus(current: HeatStatus, target: HeatStatus): boolean {
  if (current === 'Closed' || current === 'Cancelled' || current === 'Output Entered') {
    return false
  }
  return statusRank(target) > statusRank(current)
}
