'use client'

import { useState, useEffect, useCallback } from 'react'
import { geocodeAddress } from '@/services/geocoding'
import { addGlobalIncident, getIncidentsForDate, removeGlobalIncident, updateGlobalIncident, TrafficIncident } from '@/services/incidents'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'
// AJOUT DES IMPORTS MANQUANTS :
import { getAffectedSessions } from '@/services/autoOptimizer'
import { runOptimization } from '@/services/optimizationEngine'

import { AlertTriangle, Trash2, Plus, ShieldAlert, Radio, Loader2, Calendar, Clock, CheckCircle, Pencil, X, Repeat } from 'lucide-react'

const DAYS_OF_WEEK = [
  { label: 'L', value: 1 }, { label: 'M', value: 2 }, { label: 'M', value: 3 },
  { label: 'J', value: 4 }, { label: 'V', value: 5 }, { label: 'S', value: 6 }, { label: 'D', value: 0 }
]

function formatDays(days: number[]) {
  const map: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam', 0: 'Dim' };
  return [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(d => map[d]).join(', ');
}

export default function TrafficIncidentsPanel() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addressInput, setAddressInput] = useState('')
  const [type, setType] = useState<'BLOCKAGE' | 'SLOWDOWN'>('BLOCKAGE')
  const [radius, setRadius] = useState<number>(300)
  
  const todayStr = new Date().toISOString().split('T')[0]
  const startTimeStr = new Date().toTimeString().slice(0, 5)
  const endTimeDefault = new Date(Date.now() + 2 * 3600 * 1000).toTimeString().slice(0, 5) 
  
  const [incidentDate, setIncidentDate] = useState(todayStr)
  const [incidentTime, setIncidentTime] = useState(startTimeStr)
  const [incidentEndTime, setIncidentEndTime] = useState(endTimeDefault)
  
  const [recurrenceType, setRecurrenceType] = useState<'NONE' | 'DAILY' | 'WEEKLY'>('NONE')
  const [incidentEndDate, setIncidentEndDate] = useState(todayStr)
  const [selectedDays, setSelectedDays] = useState<number[]>([]) 

  const [isSearching, setIsSearching] = useState(false)
  const [resolvedGeo, setResolvedGeo] = useState<{lat: number, lng: number} | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [activeIncidents, setActiveIncidents] = useState<TrafficIncident[]>([])

  const [activeIndex, setActiveIndex] = useState(-1)
  const { suggestions, isLoading: isAutocompleteLoading, search, clearSuggestions } = useAddressAutocomplete()

  const loadIncidents = async (dateStr: string) => {
    setIsLoadingList(true)
    try {
      setActiveIncidents(await getIncidentsForDate(dateStr))
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoadingList(false)
    }
  }

  useEffect(() => { loadIncidents(incidentDate) }, [incidentDate])

  const handleSelectSuggestion = async (address: string) => {
    setAddressInput(address)
    clearSuggestions()
    setActiveIndex(-1)
    
    setIsSearching(true)
    setResolvedGeo(null)
    try {
      const geo = await geocodeAddress(address)
      if (geo) setResolvedGeo({ lat: geo.lat, lng: geo.lng })
      else alert("Impossible de localiser cette adresse.")
    } catch (err) {
      alert("Erreur lors de la localisation.")
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0) handleSelectSuggestion(activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0])
    } 
    else if (e.key === 'Escape') { clearSuggestions(); setActiveIndex(-1) }
  }

  const handleSubmitIncident = async () => {
    if (!resolvedGeo || !incidentDate || !incidentTime || !incidentEndTime) return
    
    if (recurrenceType !== 'NONE' && incidentEndDate < incidentDate) {
      alert("La date de fin doit être ultérieure à la date de début."); return;
    }
    if (recurrenceType === 'WEEKLY' && selectedDays.length === 0) {
      alert("Veuillez sélectionner au moins un jour de la semaine."); return;
    }

    setIsSearching(true);
    try {
      const payload: any = {
        address: addressInput,
        lat: resolvedGeo.lat,
        lng: resolvedGeo.lng,
        radiusInMeters: radius,
        type,
        date: incidentDate,
        time: incidentTime,
        endTime: incidentEndTime,
        recurrenceType
      };

      if (recurrenceType !== 'NONE') {
        payload.endDate = incidentEndDate;
      }
      if (recurrenceType === 'WEEKLY') {
        payload.daysOfWeek = selectedDays;
      }

      if (editingId) {
        await updateGlobalIncident(editingId, payload); 
        setEditingId(null);
      } else {
        await addGlobalIncident(payload);
      }

      const affectedSessions = await getAffectedSessions(incidentDate, incidentTime, incidentEndTime);

      if (affectedSessions.length > 0) {
        alert(`Attention: ${affectedSessions.length} tournée(s) impactée(s) détectée(s). Recalcul automatique en cours...`);
        for (const session of affectedSessions) {
           await runOptimization(session);
        }
      }

      setAddressInput(''); setResolvedGeo(null); setRecurrenceType('NONE'); setSelectedDays([]);
      await loadIncidents(incidentDate)
      
    } catch (err) {
      console.error("Erreur Firebase:", err); 
      alert("Erreur lors de l'enregistrement de l'incident.");
    } finally {
      setIsSearching(false);
    }
  }

  const handleEditClick = (inc: TrafficIncident) => {
    setEditingId(inc.id)
    setAddressInput(inc.address)
    setResolvedGeo({ lat: inc.lat, lng: inc.lng })
    setRadius(inc.radiusInMeters)
    setType(inc.type)
    setIncidentDate(inc.date)
    setIncidentTime(inc.time)
    setIncidentEndTime(inc.endTime)
    setRecurrenceType(inc.recurrenceType || 'NONE')
    if (inc.endDate) setIncidentEndDate(inc.endDate)
    setSelectedDays(inc.daysOfWeek || [])
    clearSuggestions() 
  }

  const handleCancelEdit = () => {
    setEditingId(null); setAddressInput(''); setResolvedGeo(null); 
    setRecurrenceType('NONE'); setSelectedDays([]);
  }

  const handleDelete = async (id: string) => {
    await removeGlobalIncident(id)
    if (editingId === id) handleCancelEdit()
    setActiveIncidents(prev => prev.filter(inc => inc.id !== id))
  }

  const toggleDay = (val: number) => {
    setSelectedDays(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val])
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
      <div className="flex items-center gap-2.5 pb-4 border-b border-gray-50">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0"><AlertTriangle className="w-5 h-5" /></div>
        <div>
          <h2 className="text-lg font-bold text-opti-blue font-display">Centre de Contrôle</h2>
          <p className="text-xs text-gray-500 mt-0.5">Déclarez les incidents pour adapter les tournées.</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* ADRESSE */}
        <div>
          <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex justify-between items-center">
            <span>Zone impactée</span>{isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin text-opti-red" />}
          </label>
          <div className="relative">
            <input type="text" value={addressInput} onChange={(e) => { setAddressInput(e.target.value); setResolvedGeo(null); search(e.target.value); }} onKeyDown={handleKeyDown} onBlur={() => setTimeout(() => { clearSuggestions(); setActiveIndex(-1) }, 150)} disabled={isSearching} placeholder="Ex: Pont de la Guillotière, Lyon" className={`w-full px-4 py-3 text-sm text-opti-blue border rounded-2xl focus:outline-none focus:ring-2 focus:ring-opti-red/20 transition-colors ${resolvedGeo ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 focus:border-opti-red'}`} />
            {isAutocompleteLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></span>}
            {resolvedGeo && !isSearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"><CheckCircle className="w-5 h-5" /></span>}
            {suggestions.length > 0 && (
              <ul role="listbox" className="absolute z-50 mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 max-h-48 overflow-auto text-sm py-1">
                {suggestions.map((s, i) => (<li key={s} role="option" aria-selected={i === activeIndex} onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }} className={`cursor-pointer px-4 py-2.5 transition-colors truncate ${i === activeIndex ? 'bg-opti-blue text-white' : 'text-opti-blue hover:bg-gray-50'}`}>{s}</li>))}
              </ul>
            )}
          </div>
        </div>

        {/* NATURE & RAYON */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">Nature</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType('BLOCKAGE')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${type === 'BLOCKAGE' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-gray-200 hover:bg-slate-50'}`}>Barrée</button>
              <button type="button" onClick={() => setType('SLOWDOWN')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${type === 'SLOWDOWN' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-gray-200 hover:bg-slate-50'}`}>Bouchon</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">Périmètre impacté</label>
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full px-3 py-2.5 text-xs border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none">
              <option value={50}>Très localisé (50m)</option>
              <option value={100}>Zone restreinte (100m)</option>
              <option value={300}>Zone large (300m) - Recommandé</option>
              <option value={600}>Zone étendue (600m)</option>
            </select>
          </div>
        </div>

        {/* DATE & HEURES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-50">
          <div><label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date init.</label><input type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none" /></div>
          <div><label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> De</label><input type="time" value={incidentTime} onChange={(e) => setIncidentTime(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none" /></div>
          <div><label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> À</label><input type="time" value={incidentEndTime} onChange={(e) => setIncidentEndTime(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none" /></div>
        </div>

        {/* RÉCURRENCE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /> Répétition</label>
            <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as any)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none">
              <option value="NONE">Une seule fois</option>
              <option value="DAILY">Tous les jours</option>
              <option value="WEEKLY">Certains jours</option>
            </select>
          </div>
          {recurrenceType !== 'NONE' && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300">
              <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">Jusqu'au</label>
              <input type="date" value={incidentEndDate} onChange={(e) => setIncidentEndDate(e.target.value)} min={incidentDate} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:border-opti-red focus:outline-none" />
            </div>
          )}
        </div>

        {/* JOURS DE LA SEMAINE (Si WEEKLY) */}
        {recurrenceType === 'WEEKLY' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">Jours d'activation</label>
            <div className="flex gap-2 justify-between">
              {DAYS_OF_WEEK.map(day => {
                const isSelected = selectedDays.includes(day.value);
                return (
                  <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${isSelected ? 'bg-opti-blue text-white shadow-md' : 'bg-white text-slate-400 border border-gray-200 hover:bg-slate-100'}`}>
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* BOUTONS ACTIONS */}
        <div className="flex gap-2 pt-2">
          {editingId && <button type="button" onClick={handleCancelEdit} className="px-4 py-3 rounded-2xl text-sm font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"><X className="w-4 h-4" /></button>}
          <button type="button" onClick={handleSubmitIncident} disabled={!resolvedGeo || isSearching} className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white transition-colors disabled:opacity-50 ${editingId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-opti-blue hover:bg-slate-800'}`}>
            {editingId ? <><Pencil className="w-4 h-4" /> Mettre à jour l'incident</> : <><Plus className="w-4 h-4" /> Déclarer la perturbation</>}
          </button>
        </div>
      </div>

      {/* LISTE DES INCIDENTS */}
      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-xs font-bold text-opti-blue uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>Incidents actifs le {incidentDate.split('-').reverse().join('/')}</span> 
          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">{activeIncidents.length}</span>
        </h3>
        
        {isLoadingList ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-opti-blue" /></div> : activeIncidents.length === 0 ? <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">Aucun incident n'affecte cette date.</p> : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
            {activeIncidents.map((inc) => (
              <div key={inc.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs shadow-sm bg-white transition-colors ${inc.type === 'BLOCKAGE' ? 'border-red-100 hover:border-red-200' : 'border-amber-100 hover:border-amber-200'} ${editingId === inc.id ? 'ring-2 ring-opti-red/20' : ''}`}>
                <div className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => handleEditClick(inc)}>
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${inc.type === 'BLOCKAGE' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-opti-blue truncate" title={inc.address}>{inc.address}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      <Clock className="w-3 h-3 inline mr-1" /> {inc.time} à {inc.endTime} 
                      {inc.recurrenceType === 'DAILY' && <span className="ml-1 text-opti-red font-bold">(Tous les jours)</span>}
                      {inc.recurrenceType === 'WEEKLY' && <span className="ml-1 text-opti-red font-bold">(Chaque {formatDays(inc.daysOfWeek || [])})</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => handleEditClick(inc)} className="p-1.5 text-slate-400 hover:text-opti-blue hover:bg-blue-50 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => handleDelete(inc.id)} className="p-1.5 text-slate-400 hover:text-opti-red hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}