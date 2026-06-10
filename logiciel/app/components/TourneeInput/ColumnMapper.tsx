'use client'

import { useState } from 'react'
import type { ColumnMapping } from '@/types/logistics'

interface ColumnMapperProps {
  columns: string[]
  onConfirm: (mapping: ColumnMapping) => void
  onCancel: () => void
}

const FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: 'address', label: 'Adresse', required: true },
  { key: 'pallets', label: 'Palettes', required: true },
  { key: 'loading_time', label: 'Temps chargement dépôt (min)', required: false },
  { key: 'unloading_time', label: 'Temps déchargement client (min)', required: false },
  { key: 'window_start', label: 'Fenêtre horaire — début (HH:mm)', required: false },
  { key: 'window_end', label: 'Fenêtre horaire — fin (HH:mm)', required: false },
  { key: 'vehicle_type', label: 'Typologie de camion', required: false },
  { key: 'required_skill', label: 'Équipement requis', required: false },
]

export default function ColumnMapper({ columns, onConfirm, onCancel }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => {
    const initial: ColumnMapping = { address: '', pallets: '', loading_time: '', unloading_time: '', window_start: '', window_end: '', vehicle_type: '', required_skill: '' }
    for (const col of columns) {
      const lower = col.toLowerCase()
      if (!initial.address && /adresse|address/.test(lower)) initial.address = col
      if (!initial.pallets && /palet|pallet/.test(lower)) initial.pallets = col
      if (!initial.loading_time && /charg|load/.test(lower)) initial.loading_time = col
      if (!initial.unloading_time && /décharg|decharg|unload/.test(lower)) initial.unloading_time = col
      if (!initial.window_start && /(début|debut|start|ouvert)/.test(lower)) initial.window_start = col
      if (!initial.window_end && /(fin|end|fermet)/.test(lower)) initial.window_end = col
      if (!initial.vehicle_type && /typolog|type.camion|vehicle.type/.test(lower)) initial.vehicle_type = col
      if (!initial.required_skill && /équipement|equipement|skill|compét|competence/.test(lower)) initial.required_skill = col
    }
    return initial
  })

  const isValid = mapping.address !== '' && mapping.pallets !== ''

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-xl font-bold text-opti-blue font-display mb-1">Associer les colonnes</h3>
      <p className="text-sm text-slate-500 mb-6">Faites correspondre les colonnes du fichier aux champs requis.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {FIELDS.map(({ key, label, required }) => (
          <div key={key} className="space-y-1.5">
            <label htmlFor={`map-${key}`} className="block text-sm font-bold text-opti-blue">
              {label}{required && <span className="text-opti-red ml-1">*</span>}
            </label>
            <select
              id={`map-${key}`}
              aria-label={`Colonne pour ${label}`}
              value={mapping[key]}
              onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white"
            >
              <option value="">— Ignorer —</option>
              {columns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="flex gap-3 justify-end">
        <button
          aria-label="Annuler le mapping"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-opti-blue hover:bg-gray-50 transition-colors"
        >
          Annuler
        </button>
        <button
          aria-label="Confirmer le mapping des colonnes"
          disabled={!isValid}
          onClick={() => onConfirm(mapping)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Importer
        </button>
      </div>
    </div>
  )
}
