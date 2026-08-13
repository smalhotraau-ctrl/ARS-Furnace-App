export interface Bundle {
  id: string
  heat_id: string
  bundle_no: string
  pieces: number
  weight_kg: number
  packed_by: string
  packed_at: string
  _localId?: string
  _pending?: boolean
}

export interface BundleInsert {
  heat_id: string
  bundle_no: string
  pieces: number
  weight_kg: number
  packed_by: string
  packed_at: string
}

export interface DispatchLine {
  id: string
  dispatch_id: string
  heat_id: string
  kg_dispatched: number
  created_at: string
  _localId?: string
  _pending?: boolean
}

export interface DispatchLineInsert {
  dispatch_id: string
  heat_id: string
  kg_dispatched: number
}

export interface Dispatch {
  id: string
  party_name: string
  invoice_no: string
  dispatch_date: string
  kg_dispatched: number
  shortage_kg: number | null
  shortage_reported_date: string | null
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string | null
  _localId?: string
  _pending?: boolean
}

export interface DispatchInsert {
  party_name: string
  invoice_no: string
  dispatch_date: string
  shortage_kg: number | null
  shortage_reported_date: string | null
  created_by: string
}

// Client-side draft of a dispatch line before it has a real dispatch_id (assigned on save).
export interface DispatchLineDraft {
  heat_id: string
  heat_no: string
  kg_dispatched: number
  available_kg: number
}
