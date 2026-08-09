export const CYCLE_STAGE_META: Record<
  string,
  { en: string; hi: string; icon: string }
> = {
  preheating: { en: 'Preheating', hi: 'प्रीहीट', icon: '🔥' },
  charging: { en: 'Charging', hi: 'चार्जिंग', icon: '📥' },
  melting: { en: 'Melting', hi: 'पिघलाना', icon: '🌡️' },
  drossing: { en: 'Drossing', hi: 'ड्रॉस', icon: '♻️' },
  iron_removal: { en: 'Iron Removal', hi: 'लोहा निकाल', icon: '🧲' },
  alloying: { en: 'Alloying', hi: 'मिश्रण', icon: '⚗️' },
  degassing: { en: 'Degassing', hi: 'डिगैसिंग', icon: '💨' },
  casting: { en: 'Casting', hi: 'कास्टिंग', icon: '🏭' },
  cleaning: { en: 'Cleaning', hi: 'सफाई', icon: '🧹' },
}

export const TEMP_CHECKPOINT_META: Record<
  string,
  { en: string; hi: string }
> = {
  mould_preheat: { en: 'Mould Preheat', hi: 'सांचा प्रीहीट' },
  melting: { en: 'Melting', hi: 'पिघलाना' },
  iron_removal: { en: 'Iron Removal', hi: 'लोहा निकाल' },
  alloying: { en: 'Alloying', hi: 'मिश्रण' },
  casting: { en: 'Casting', hi: 'कास्टिंग' },
}
