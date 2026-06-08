export interface PivotNode {
  address: string
}

export interface DeliveryPoint {
  id: string
  address: string
  pallets: number
  loading_time_at_depot: number
  unloading_time_at_client: number
  time_window: {
    start: string
    end: string
  }
  notes?: string
}

export interface SessionMeta {
  date: string
  resources_active: number
  name?: string
}

export interface DeliverySession {
  id: string
  meta: SessionMeta
  origin_node: PivotNode
  delivery_points: DeliveryPoint[]
  end_node: PivotNode
  createdAt: Date
  updatedAt: Date
}

export interface ORToolsPayload {
  meta: SessionMeta
  origin_node: { address: string }
  delivery_points: Array<{
    id: string
    address: string
    pallets: number
    loading_time: number
    unloading_time: number
    time_window: { start: string; end: string }
  }>
  end_node: { address: string }
}

export interface ColumnMapping {
  address: string
  pallets: string
  loading_time: string
  unloading_time: string
  window_start: string
  window_end: string
}
