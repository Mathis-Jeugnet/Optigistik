'use client'

import { useState, useEffect, useCallback } from 'react'
import { geocodeAddress } from '@/services/geocoding'
import { addGlobalIncident, getIncidentsForDate, removeGlobalIncident, TrafficIncident } from '@/services/incidents'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete' // NOUVEL IMPORT
import { AlertTriangle, Trash2, Plus, ShieldAlert, Radio, Loader2, Calendar, Clock, MapPin, CheckCircle } from 'lucide-react'

export default function TrafficIncidentsPanel() {
  // --- ÉTATS INCIDENTS ---
  const [addressInput, setAddressInput] = useState('')
  const [type, setType] = useState<'BLOCKAGE' | 'SLOWDOWN'>('BLOCKAGE')
  const [radius, setRadius] = useState<number>(100)
  
  const todayStr = new Date().toISOString().split('T')[0]
  const startTimeStr = new Date().toTimeString().slice(0, 5)
  const endTimeDefault = new Date(Date.now() + 2 * 3600 * 1000).toTimeString().slice(0, 5) 
  
  const [incidentDate, setIncidentDate] = useState(todayStr)
  const [incidentTime, setIncidentTime] = useState(startTimeStr)
  const [incidentEndTime, setIncidentEndTime] = useState(endTimeDefault)
  
  const [isSearching, setIsSearching] = useState(false)
  const [resolvedGeo, setResolvedGeo] = useState<{lat: number, lng: number} | null>(null)
  
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [activeIncidents, setActiveIncidents] = useState<TrafficIncident[]>([])

  // --- ÉTATS AUTOCOMPLÉTION ---
  const [activeIndex, setActiveIndex] = useState(-1)
  const { suggestions, isLoading: isAutocompleteLoading, search, clearSuggestions } = useAddressAutocomplete()

  // --- CHARGEMENT DES INCIDENTS ---
  const loadIncidents = async (dateStr: string) => {
    setIsLoadingList(true)
    try {
      const data = await getIncidentsForDate(dateStr)
      setActiveIncidents(data)
    } catch (error) {
      console.error("Erreur de chargement :", error)
    } finally {
      setIsLoadingList(false)
    }
  }

  useEffect(() => {
    loadIncidents(incidentDate)
  }, [incidentDate])

  // --- GESTION DE L'AUTOCOMPLÉTION ---
  const handleSelectSuggestion = useCallback((address: string) => {
    setAddressInput(address)
    setResolvedGeo(null) // On force la re-vérification
    clearSuggestions()
    setActiveIndex(-1)
  }, [clearSuggestions])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)) 
    }
    else if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setActiveIndex((i) => Math.max(i - 1, 0)) 
    }
    else if (e.key === 'Enter') {
      if (suggestions.length > 0) {
        e.preventDefault()
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelectSuggestion(suggestions[activeIndex])
        } else {
          // Si l'utilisateur fait entrée sans naviguer, on prend le premier résultat
          handleSelectSuggestion(suggestions[0])
        }
      }
    } 
    else if (e.key === 'Escape') { 
      clearSuggestions(); 
      setActiveIndex(-1) 
    }
  }

  // --- ACTIONS INCIDENTS ---
  const handleVerifyAddress = async () => {
    if (!addressInput.trim()) return;
    setIsSearching(true);
    setResolvedGeo(null);
    clearSuggestions(); // On nettoie les suggestions si on force la vérification

    try {
      const geo = await geocodeAddress(addressInput);
      if (!geo) {
        alert("Impossible de localiser. Essayez d'être plus précis (ex: ajouter la ville).");
      } else {
        setResolvedGeo({ lat: geo.lat, lng: geo.lng });
      }
    } catch (err) {
      alert("Erreur de géocodage.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddIncident = async () => {
    if (!resolvedGeo || !incidentDate || !incidentTime || !incidentEndTime) return

    try {
      await addGlobalIncident({
        address: addressInput,
        lat: resolvedGeo.lat,
        lng: resolvedGeo.lng,
        radiusInMeters: radius,
        type,
        date: incidentDate,
        time: incidentTime,
        endTime: incidentEndTime
      })

      setAddressInput('')
      setResolvedGeo(null)
      await loadIncidents(incidentDate)
    } catch (err) {
      alert("Une erreur est survenue lors de la création de l'incident.")
    }
  }

  const handleDelete = async (id: string) => {
    await removeGlobalIncident(id)
    setActiveIncidents(prev => prev.filter(inc => inc.id !== id))
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
      <div className="flex items-center gap-2.5 pb-4 border-b border-gray-50">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-opti-blue font-display">Centre de Contrôle</h2>
          <p className="text-xs text-gray-500 mt-0.5">Déclarez les incidents pour adapter les tournées.</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* CHAMP ADRESSE AVEC AUTOCOMPLÉTION */}
        <div>
          <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">Zone impactée</label>
          <div className="flex gap-2 relative">
            <div className="relative flex-1">
              <input
                type="text"
                value={addressInput}
                onChange={(e) => { 
                  setAddressInput(e.target.value); 
                  setResolvedGeo(null); 
                  search(e.target.value); // On déclenche la recherche
                }}
                onKeyDown={handleKeyDown}
                onBlur={() => setTimeout(() => {
                  clearSuggestions()
                  setActiveIndex(-1)
                }, 150)}
                disabled={isSearching}
                placeholder="Ex: Pont de la Guillotière, Lyon"
                className="w-full px-4 py-3 text-sm text-opti-blue border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red"
              />
              
              {/* Spinner de l'autocomplétion */}
              {isAutocompleteLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
              )}

              {/* Menu déroulant des suggestions */}
              {suggestions.length > 0 && (
                <ul role="listbox" className="absolute z-50 mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 max-h-48 overflow-auto text-sm py-1">
                  {suggestions.map((s, i) => (
                    <li
                      key={s}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseDown={() => handleSelectSuggestion(s)}
                      className={`cursor-pointer px-4 py-2.5 transition-colors truncate ${i === activeIndex ? 'bg-opti-blue text-white' : 'text-opti-blue hover:bg-gray-50'}`}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Bouton Vérifier */}
            {!resolvedGeo && (
              <button
                type="button"
                onClick={handleVerifyAddress}
                disabled={isSearching || !addressInput.trim()}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-opti-blue font-bold rounded-2xl transition-colors disabled:opacity-50 shrink-0"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {resolvedGeo && (
          <div className="bg-emerald-50 text-emerald-700 text-xs font-bold p-3 rounded-xl border border-emerald-100 flex items-center gap-2 animate-in fade-in duration-300">
            <CheckCircle className="w-4 h-4" /> Localisation confirmée !
          </div>
        )}

        {/* Date et Heures */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date</label>
            <input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Début</label>
            <input type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Fin est.</label>
            <input type="time" value={incidentEndTime} onChange={(e) => setIncidentEndTime(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none" />
          </div>
        </div>

        {/* Nature et Rayon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">Nature</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType('BLOCKAGE')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${type === 'BLOCKAGE' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-gray-200 hover:bg-slate-50'}`}>Barrée</button>
              <button type="button" onClick={() => setType('SLOWDOWN')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${type === 'SLOWDOWN' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-gray-200 hover:bg-slate-50'}`}>Bouchon</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center justify-between"><span>Rayon</span> <span className="bg-slate-100 text-opti-blue px-2 rounded-md">{radius}m</span></label>
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full px-3 py-2.5 text-xs border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none">
              <option value={50}>Intersection (50m)</option>
              <option value={100}>Avenue/Pont (100m)</option>
              <option value={300}>Quartier (300m)</option>
              <option value={600}>Gros Bouchon (600m)</option>
            </select>
          </div>
        </div>

        <button type="button" onClick={handleAddIncident} disabled={!resolvedGeo} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white bg-opti-blue hover:bg-slate-800 transition-colors disabled:opacity-50">
          <Plus className="w-4 h-4" /> Déclarer la perturbation
        </button>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-xs font-bold text-opti-blue uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>Incidents du {incidentDate.split('-').reverse().join('/')}</span> 
          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">{activeIncidents.length}</span>
        </h3>
        
        {isLoadingList ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-opti-blue" /></div>
        ) : activeIncidents.length === 0 ? (
          <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">Aucun incident enregistré à cette date.</p>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
            {activeIncidents.map((inc) => (
              <div key={inc.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs shadow-sm bg-white transition-colors ${inc.type === 'BLOCKAGE' ? 'border-red-100 hover:border-red-200' : 'border-amber-100 hover:border-amber-200'}`}>
                <div className="flex items-start gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${inc.type === 'BLOCKAGE' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-opti-blue truncate" title={inc.address}>{inc.address}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5"><Clock className="w-3 h-3 inline mr-1" /> {inc.time} à {inc.endTime} • {inc.radiusInMeters}m</p>
                  </div>
                </div>
                <button type="button" onClick={() => handleDelete(inc.id)} className="p-1.5 text-slate-400 hover:text-opti-red hover:bg-red-50 rounded-lg shrink-0 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}