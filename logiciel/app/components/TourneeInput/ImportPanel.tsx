'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDeliveryStore } from '@/stores/deliveryStore'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'
import { parseCSV, mapColumnsToDeliveryPoints } from '@/utils/csvParser'
import { parseExcel } from '@/utils/excelParser'
import ColumnMapper from './ColumnMapper'
import type { ColumnMapping } from '@/types/logistics'
import { getVehicleTypes, getSpecialties } from '@/services/fleet'
import type { VehicleType, Specialty } from '@/services/fleet'

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

const manualSchema = z.object({
  address: z.string().min(5, 'Adresse trop courte (5 caractères min)'),
  pallets: z.number().int().positive('Doit être un entier positif'),
  loading_time_at_depot: z.number().int().min(5).max(480),
  unloading_time_at_client: z.number().int().min(5).max(480),
  window_start: z.string().regex(TIME_REGEX, 'Format HH:mm requis'),
  window_end: z.string().regex(TIME_REGEX, 'Format HH:mm requis'),
  notes: z.string().optional(),
  allowed_vehicle_type: z.string().optional(),
  required_skill: z.string().optional(),
})

type ManualFormValues = z.infer<typeof manualSchema>

function autoDetectMapping(columns: string[]): ColumnMapping | null {
  const m: ColumnMapping = { address: '', pallets: '', loading_time: '', unloading_time: '', window_start: '', window_end: '', vehicle_type: '', required_skill: '' }
  for (const col of columns) {
    const lower = col.toLowerCase()
    if (!m.address && /adresse|address/.test(lower)) m.address = col
    if (!m.pallets && /palet|pallet/.test(lower)) m.pallets = col
    if (!m.loading_time && /charg|load/.test(lower)) m.loading_time = col
    if (!m.unloading_time && /décharg|decharg|unload/.test(lower)) m.unloading_time = col
    if (!m.window_start && /(début|debut|start|ouvert)/.test(lower)) m.window_start = col
    if (!m.window_end && /(fin|end|fermet)/.test(lower)) m.window_end = col
    if (!m.vehicle_type && /typolog|type.camion|vehicle.type/.test(lower)) m.vehicle_type = col
    if (!m.required_skill && /équipement|equipement|skill|compét|competence/.test(lower)) m.required_skill = col
  }
  return m.address && m.pallets ? m : null
}

/* ── Champ adresse avec autocomplétion ── */
function AddressAutocompleteField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const { suggestions, isLoading, search, clearSuggestions } = useAddressAutocomplete()
  const [activeIndex, setActiveIndex] = useState(-1)

  const handleSelect = (address: string) => { onChange(address); clearSuggestions(); setActiveIndex(-1) }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(suggestions[activeIndex]) }
    else if (e.key === 'Escape') clearSuggestions()
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="m-address" className="block text-sm font-bold text-opti-blue">
        Adresse <span className="text-opti-red">*</span>
      </label>
      <div className="relative">
        <input
          id="m-address"
          aria-label="Adresse du point de livraison"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          value={value}
          onChange={(e) => { onChange(e.target.value); search(e.target.value) }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(clearSuggestions, 150)}
          placeholder="Ex: 12 rue de la Paix 75002 Paris"
          autoComplete="off"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
        />
        {isLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>}
        {suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-50 mt-1 w-full bg-white rounded-2xl shadow-lg border border-gray-100 max-h-52 overflow-auto text-sm">
            {suggestions.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={() => handleSelect(s)}
                className={`cursor-pointer px-4 py-2.5 transition-colors ${i === activeIndex ? 'bg-opti-blue text-white' : 'text-opti-blue hover:bg-gray-50'}`}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-opti-red">{error}</p>}
    </div>
  )
}

/* ── Composant principal ── */
export default function ImportPanel() {
  const addDeliveryPoints = useDeliveryStore((s) => s.addDeliveryPoints)
  const [pendingRows, setPendingRows] = useState<Record<string, string>[] | null>(null)
  const [pendingColumns, setPendingColumns] = useState<string[]>([])
  const [showManual, setShowManual] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])

  useEffect(() => {
    getVehicleTypes().then(setVehicleTypes)
    getSpecialties().then(setSpecialties)
  }, [])

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ManualFormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: { loading_time_at_depot: 15, unloading_time_at_client: 30, window_start: '08:00', window_end: '18:00' },
  })

  const processRows = useCallback((rows: Record<string, string>[], mapping: ColumnMapping) => {
    const points = mapColumnsToDeliveryPoints(rows, mapping)
    if (points.length === 0) { setImportError('Aucun point valide trouvé dans le fichier.'); return }
    addDeliveryPoints(points)
    setPendingRows(null); setPendingColumns([])
    setImportSuccess(`${points.length} point(s) ajouté(s) avec succès.`)
    setTimeout(() => setImportSuccess(null), 4000)
  }, [addDeliveryPoints])

  const handleFile = useCallback(async (file: File) => {
    setImportError(null); setImportSuccess(null)
    try {
      const rows = /\.(xlsx|xls)$/i.test(file.name) ? await parseExcel(file) : await parseCSV(file)
      if (rows.length === 0) { setImportError('Le fichier est vide.'); return }
      const columns = Object.keys(rows[0])
      const autoMapping = autoDetectMapping(columns)
      if (autoMapping) processRows(rows, autoMapping)
      else { setPendingRows(rows); setPendingColumns(columns) }
    } catch (e) { setImportError('Erreur : ' + (e instanceof Error ? e.message : 'format non supporté')) }
  }, [processRows])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    multiple: false,
    onDropAccepted: ([file]) => handleFile(file),
    onDropRejected: () => setImportError('Format non supporté. Acceptés : .csv, .xlsx, .xls'),
  })

  const onManualSubmit = (values: ManualFormValues) => {
    addDeliveryPoints([{
      id: crypto.randomUUID(),
      address: values.address,
      pallets: values.pallets,
      loading_time_at_depot: values.loading_time_at_depot,
      unloading_time_at_client: values.unloading_time_at_client,
      time_window: { start: values.window_start, end: values.window_end },
      notes: values.notes,
      allowed_vehicle_types: values.allowed_vehicle_type ? [values.allowed_vehicle_type] : null,
      required_skills: values.required_skill ? [values.required_skill] : null,
    }])
    reset(); setShowManual(false)
    setImportSuccess('Point ajouté avec succès.')
    setTimeout(() => setImportSuccess(null), 3000)
  }

  if (pendingRows && pendingColumns.length > 0) {
    return <ColumnMapper columns={pendingColumns} onConfirm={(m) => processRows(pendingRows, m)} onCancel={() => { setPendingRows(null); setPendingColumns([]) }} />
  }

  const inputClass = "w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
  const labelClass = "block text-sm font-bold text-opti-blue"
  const errorClass = "text-xs text-opti-red mt-1"

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
        <h3 className="text-xl font-bold text-opti-blue font-display">Ajouter des points de livraison</h3>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          aria-label="Zone de dépôt de fichier CSV ou Excel"
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragActive ? 'border-opti-red bg-red-50' : 'border-gray-200 hover:border-opti-red hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} aria-label="Sélectionner un fichier" />
          <p className="text-sm font-bold text-opti-blue mb-1">
            {isDragActive ? 'Déposez le fichier ici…' : 'Glissez un fichier ici ou cliquez pour sélectionner'}
          </p>
          <p className="text-xs text-slate-400">.csv, .xlsx, .xls acceptés</p>
        </div>

        {importError && <p role="alert" className="text-sm text-opti-red font-bold">{importError}</p>}
        {importSuccess && <p role="status" className="text-sm text-green-600 font-bold">{importSuccess}</p>}

        <div className="flex justify-end">
          <button
            aria-label="Ajouter un point manuellement"
            onClick={() => setShowManual((v) => !v)}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-opti-blue hover:bg-gray-50 transition-colors"
          >
            {showManual ? 'Masquer le formulaire' : '+ Ajouter manuellement'}
          </button>
        </div>
      </div>

      {/* Formulaire manuel */}
      {showManual && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold text-opti-blue font-display mb-6">Saisie manuelle</h3>
          <form onSubmit={handleSubmit(onManualSubmit)} noValidate className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <AddressAutocompleteField
                  value={watch('address') ?? ''}
                  onChange={(v) => setValue('address', v, { shouldValidate: true })}
                  error={errors.address?.message}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-pallets" className={labelClass}>Palettes <span className="text-opti-red">*</span></label>
                <input id="m-pallets" aria-label="Nombre de palettes" type="number" min={1} {...register('pallets', { valueAsNumber: true })} className={inputClass} />
                {errors.pallets && <p className={errorClass}>{errors.pallets.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-loading" className={labelClass}>Tps chargement dépôt (min)</label>
                <input id="m-loading" aria-label="Temps de chargement au dépôt" type="number" min={5} max={480} {...register('loading_time_at_depot', { valueAsNumber: true })} className={inputClass} />
                {errors.loading_time_at_depot && <p className={errorClass}>{errors.loading_time_at_depot.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-unloading" className={labelClass}>Tps déchargement client (min)</label>
                <input id="m-unloading" aria-label="Temps de déchargement client" type="number" min={5} max={480} {...register('unloading_time_at_client', { valueAsNumber: true })} className={inputClass} />
                {errors.unloading_time_at_client && <p className={errorClass}>{errors.unloading_time_at_client.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-wstart" className={labelClass}>Fenêtre — début</label>
                <input id="m-wstart" aria-label="Début de la fenêtre horaire" placeholder="08:00" {...register('window_start')} className={inputClass} />
                {errors.window_start && <p className={errorClass}>{errors.window_start.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-wend" className={labelClass}>Fenêtre — fin</label>
                <input id="m-wend" aria-label="Fin de la fenêtre horaire" placeholder="18:00" {...register('window_end')} className={inputClass} />
                {errors.window_end && <p className={errorClass}>{errors.window_end.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-vehicle-type" className={labelClass}>Typologie de camion</label>
                <select
                  id="m-vehicle-type"
                  aria-label="Typologie de camion requise"
                  {...register('allowed_vehicle_type')}
                  className={inputClass}
                >
                  <option value="">— Aucune contrainte —</option>
                  {vehicleTypes.map((vt) => (
                    <option key={vt.id} value={vt.id}>{vt.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="m-skill" className={labelClass}>Équipement requis</label>
                <select
                  id="m-skill"
                  aria-label="Équipement requis"
                  {...register('required_skill')}
                  className={inputClass}
                >
                  <option value="">— Aucun équipement —</option>
                  {specialties.map((sp) => (
                    <option key={sp.id} value={sp.name}>{sp.name}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label htmlFor="m-notes" className={labelClass}>Notes</label>
                <textarea id="m-notes" aria-label="Notes optionnelles" rows={2} {...register('notes')}
                  className={`${inputClass} resize-none`} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" aria-label="Annuler" onClick={() => { reset(); setShowManual(false) }}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-opti-blue hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button type="submit" aria-label="Ajouter le point de livraison"
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors">
                Ajouter le point
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
