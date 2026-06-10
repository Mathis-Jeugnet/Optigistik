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
  allowed_vehicle_types?: string[] | null;
  required_skills?: string[] | null;
}

export interface SessionMeta {
  date: string
  resources_active: number
  name?: string
  start_time?: string;
}

export interface DeliverySession {
  id: string
  meta: SessionMeta
  origin_node: PivotNode
  delivery_points: DeliveryPoint[]
  end_node: PivotNode
  createdAt: Date
  updatedAt: Date
  optimization_signature?: string;
  affretement_report?: Array<{client_id: string, raison_rejet: string}>;
  unlocated_points?: string[];
  clusters?: any[];
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
  vehicle_type: string
  required_skill: string
}
