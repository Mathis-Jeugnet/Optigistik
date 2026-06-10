import Papa from 'papaparse'
import type { DeliveryPoint, ColumnMapping } from '@/types/logistics'

export function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err),
    })
  })
}

function safeInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return isNaN(parsed) || parsed <= 0 ? fallback : Math.round(parsed)
}

export function mapColumnsToDeliveryPoints(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): DeliveryPoint[] {
  return rows
    .filter((row) => row[mapping.address]?.trim())
    .map((row) => {
      const vehicleType = mapping.vehicle_type ? row[mapping.vehicle_type]?.trim() : ''
      const skill = mapping.required_skill ? row[mapping.required_skill]?.trim() : ''
      return {
        id: crypto.randomUUID(),
        address: row[mapping.address].trim(),
        pallets: safeInt(row[mapping.pallets], 1),
        loading_time_at_depot: safeInt(row[mapping.loading_time], 15),
        unloading_time_at_client: safeInt(row[mapping.unloading_time], 30),
        time_window: {
          start: row[mapping.window_start]?.trim() || '08:00',
          end: row[mapping.window_end]?.trim() || '18:00',
        },
        allowed_vehicle_types: vehicleType ? [vehicleType] : null,
        required_skills: skill ? [skill] : null,
      }
    })
}
