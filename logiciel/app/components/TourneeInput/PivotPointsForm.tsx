'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDeliveryStore } from '@/stores/deliveryStore'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'

const FAVORITES_KEY = 'logistics_pivot_favorites'
const MAX_FAVORITES = 5

function loadFavorites(): string[] {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') }
  catch { return [] }
}

function saveFavorite(address: string) {
  const favs = loadFavorites().filter((f) => f !== address)
  favs.unshift(address)
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs.slice(0, MAX_FAVORITES)))
}

interface AddressFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onSelect: (address: string) => void
}

function AddressField({ id, label, value, onChange, onSelect }: AddressFieldProps) {
  const { suggestions, isLoading, search, clearSuggestions } = useAddressAutocomplete()
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showFavorites, setShowFavorites] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])

  const displayList = suggestions.length > 0 ? suggestions : showFavorites ? favorites : []

  useEffect(() => { setActiveIndex(-1) }, [suggestions])

  const handleSelect = useCallback((address: string) => {
    onChange(address)
    onSelect(address)
    clearSuggestions()
    setShowFavorites(false)
    setActiveIndex(-1)
  }, [onChange, onSelect, clearSuggestions])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (displayList.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, displayList.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); handleSelect(displayList[activeIndex]) }
    else if (e.key === 'Escape') { clearSuggestions(); setShowFavorites(false) }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-opti-blue">{label}</label>
      <div className="relative">
        <input
          id={id}
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={displayList.length > 0}
          value={value}
          onChange={(e) => { onChange(e.target.value); search(e.target.value); if (e.target.value.length >= 3) setShowFavorites(false) }}
          onKeyDown={handleKeyDown}
          onFocus={() => { const favs = loadFavorites(); setFavorites(favs); if (value.length < 3 && favs.length > 0) setShowFavorites(true) }}
          onBlur={() => setTimeout(() => { clearSuggestions(); setShowFavorites(false) }, 150)}
          placeholder="Saisir une adresse…"
          autoComplete="off"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
        />
        {isLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>}
        {displayList.length > 0 && (
          <ul role="listbox" className="absolute z-50 mt-1 w-full bg-white rounded-2xl shadow-lg border border-gray-100 max-h-60 overflow-auto text-sm">
            {suggestions.length === 0 && showFavorites && (
              <li className="px-4 py-2 text-xs text-slate-400 select-none border-b border-gray-50">Adresses récentes</li>
            )}
            {displayList.map((s, i) => (
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
    </div>
  )
}

export default function PivotPointsForm() {
  const session = useDeliveryStore((s) => s.session)
  const initSession = useDeliveryStore((s) => s.initSession)
  const setOriginNode = useDeliveryStore((s) => s.setOriginNode)
  const setEndNode = useDeliveryStore((s) => s.setEndNode)

  const [originAddress, setOriginAddress] = useState(session?.origin_node.address ?? '')
  const [endAddress, setEndAddress] = useState(session?.end_node.address ?? '')
  const [date, setDate] = useState(session?.meta.date ?? new Date().toISOString().slice(0, 10))
  const [vehicles, setVehicles] = useState(session?.meta.resources_active ?? 1)
  const [startTime, setStartTime] = useState(session?.meta.start_time ?? '08:00') // NOUVEAU: État pour l'heure de départ

  useEffect(() => {
    // Si la session n'existe pas, on l'initialise avec l'heure de départ par défaut.
    // Assure-toi que la fonction initSession accepte start_time si tu la mets à jour.
    if (!session) initSession({ date, resources_active: vehicles, start_time: startTime } as any)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour de handleMetaChange pour inclure start_time
  const handleMetaChange = (patch: { date?: string; resources_active?: number; start_time?: string }) => {
    const newDate = patch.date ?? date
    const newVehicles = patch.resources_active ?? vehicles
    const newStartTime = patch.start_time ?? startTime

    if (patch.date) setDate(newDate)
    if (patch.resources_active !== undefined) setVehicles(newVehicles)
    if (patch.start_time !== undefined) setStartTime(newStartTime)

    if (session) {
      useDeliveryStore.setState((s) => ({
        session: s.session ? { 
            ...s.session, 
            meta: { 
                ...s.session.meta,
                date: newDate, 
                resources_active: newVehicles,
                start_time: newStartTime // Sauvegarde dans Zustand
            }, 
            updatedAt: new Date() 
        } : null,
        isDirty: true,
      }))
    } else {
      initSession({ date: newDate, resources_active: newVehicles, start_time: newStartTime } as any)
    }
  }

  const handleSelectOrigin = useCallback((address: string) => {
    saveFavorite(address)
    setOriginNode({ address })
  }, [setOriginNode])

  const handleSelectEnd = useCallback((address: string) => {
    saveFavorite(address)
    setEndNode({ address })
  }, [setEndNode])

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-xl font-bold text-opti-blue font-display mb-6">Paramètres de la tournée</h3>

      {/* J'ai passé les colonnes de 2 à 3 pour intégrer le nouveau champ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="space-y-1.5">
          <label htmlFor="tour-date" className="block text-sm font-bold text-opti-blue">Date de la tournée</label>
          <input
            id="tour-date"
            aria-label="Date de la tournée"
            type="date"
            value={date}
            onChange={(e) => handleMetaChange({ date: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
          />
        </div>

        {/* NOUVEAU: Champ pour l'heure de départ */}
        <div className="space-y-1.5">
          <label htmlFor="start-time" className="block text-sm font-bold text-opti-blue">Heure de départ (Dépôt)</label>
          <input
            id="start-time"
            aria-label="Heure de départ de la tournée"
            type="time"
            value={startTime}
            onChange={(e) => handleMetaChange({ start_time: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="vehicles-count" className="block text-sm font-bold text-opti-blue">Nombre de véhicules actifs</label>
          <input
            id="vehicles-count"
            aria-label="Nombre de véhicules actifs"
            type="number"
            min={1}
            value={vehicles}
            onChange={(e) => handleMetaChange({ resources_active: Math.max(1, Math.round(Number(e.target.value))) })}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AddressField
          id="origin-address"
          label="Adresse de départ (dépôt)"
          value={originAddress}
          onChange={(v) => { setOriginAddress(v); setOriginNode({ address: v }) }}
          onSelect={handleSelectOrigin}
        />
        <AddressField
          id="end-address"
          label="Adresse de retour (dépôt)"
          value={endAddress}
          onChange={(v) => { setEndAddress(v); setEndNode({ address: v }) }}
          onSelect={handleSelectEnd}
        />
      </div>
    </div>
  )
}