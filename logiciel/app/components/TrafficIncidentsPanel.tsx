'use client'

import { useState, useEffect } from 'react'
import { geocodeAddress } from '@/services/geocoding'
import { addGlobalIncident, getIncidentsForDate, removeGlobalIncident, TrafficIncident } from '@/services/incidents'
import { AlertTriangle, Trash2, Plus, ShieldAlert, Radio, Loader2, Calendar, Clock } from 'lucide-react'

export default function TrafficIncidentsPanel() {
  const [addressInput, setAddressInput] = useState('')
  const [type, setType] = useState<'BLOCKAGE' | 'SLOWDOWN'>('BLOCKAGE')
  const [radius, setRadius] = useState<number>(100)
  
  // Date et heure par défaut (Aujourd'hui, Maintenant)
  const todayStr = new Date().toISOString().split('T')[0]
  const timeStr = new Date().toTimeString().slice(0, 5)
  
  const [incidentDate, setIncidentDate] = useState(todayStr)
  const [incidentTime, setIncidentTime] = useState(timeStr)
  
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [activeIncidents, setActiveIncidents] = useState<TrafficIncident[]>([])

  // Charger les incidents de la date sélectionnée
  const loadIncidents = async (dateStr: string) => {
    setIsLoadingList(true)
    try {
      const data = await getIncidentsForDate(dateStr)
      setActiveIncidents(data)
    } catch (error) {
      console.error("Erreur de chargement des incidents :", error)
    } finally {
      setIsLoadingList(false)
    }
  }

  useEffect(() => {
    loadIncidents(incidentDate)
  }, [incidentDate])

  const handleAddIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addressInput.trim() || !incidentDate || !incidentTime) return

    setIsSearching(true)
    try {
      const geo = await geocodeAddress(addressInput)
      if (!geo) {
        alert("Impossible de localiser cette adresse. Veuillez vérifier la saisie.")
        return
      }

      // Enregistrement en base de données globale
      await addGlobalIncident({
        address: addressInput,
        lat: geo.lat,
        lng: geo.lng,
        radiusInMeters: radius,
        type,
        date: incidentDate,
        time: incidentTime
      })

      setAddressInput('')
      await loadIncidents(incidentDate) // Rafraîchir la liste
      
      // TODO: Ici, nous pourrons déclencher un appel backend pour vérifier si cet incident
      // impacte des tournées existantes (Ré-optimisation rétroactive).

    } catch (err) {
      console.error(err)
      alert("Une erreur est survenue lors de la création de l'incident.")
    } finally {
      setIsSearching(false)
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
          <h2 className="text-lg font-bold text-opti-blue font-display">Centre de Contrôle du Trafic</h2>
          <p className="text-xs text-gray-500 mt-0.5">Déclarez les incidents planifiés ou en temps réel pour adapter les tournées.</p>
        </div>
      </div>

      <form onSubmit={handleAddIncident} className="space-y-4">
        {/* Adresse */}
        <div>
          <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">
            Zone impactée
          </label>
          <input
            type="text"
            required
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            disabled={isSearching}
            placeholder="Ex: 45 avenue Victor Hugo, Lyon"
            className="w-full px-4 py-3 text-sm text-opti-blue border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red disabled:bg-slate-50 transition-colors"
          />
        </div>

        {/* Date et Heure */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Date
            </label>
            <input
              type="date"
              required
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-opti-blue border border-gray-200 rounded-xl focus:outline-none focus:border-opti-red bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Heure de début
            </label>
            <input
              type="time"
              required
              value={incidentTime}
              onChange={(e) => setIncidentTime(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-opti-blue border border-gray-200 rounded-xl focus:outline-none focus:border-opti-red bg-white"
            />
          </div>
        </div>

        {/* Nature et Rayon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2">
              Nature
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('BLOCKAGE')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  type === 'BLOCKAGE' ? 'bg-red-50 text-red-700 border-red-200 shadow-sm' : 'bg-white text-slate-500 border-gray-200 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Barrée
              </button>
              <button
                type="button"
                onClick={() => setType('SLOWDOWN')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  type === 'SLOWDOWN' ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-slate-500 border-gray-200 hover:bg-slate-50'
                }`}
              >
                <Radio className="w-4 h-4" />
                Bouchon
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-opti-blue uppercase tracking-wide mb-2 flex items-center justify-between">
              <span>Rayon</span>
              <span className="text-opti-blue font-bold normal-case text-xs bg-slate-100 px-2 py-0.5 rounded-md">{radius}m</span>
            </label>
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-xs text-opti-blue border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-opti-red"
            >
              <option value={50}>Intersection (50m)</option>
              <option value={100}>Avenue (100m)</option>
              <option value={300}>Quartier bloqué (300m)</option>
              <option value={600}>Gros Bouchon (600m)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSearching || !addressInput.trim()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white bg-opti-blue hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isSearching ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</> : <><Plus className="w-4 h-4" /> Déclarer l'incident</>}
        </button>
      </form>

      {/* Liste filtrée par date */}
      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-xs font-bold text-opti-blue uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>Incidents du {incidentDate.split('-').reverse().join('/')}</span>
          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">{activeIncidents.length}</span>
        </h3>

        {isLoadingList ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : activeIncidents.length === 0 ? (
          <p className="text-xs text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center">
            Aucun incident signalé à cette date.
          </p>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {activeIncidents.map((inc) => (
              <div
                key={inc.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs shadow-sm bg-white transition-all ${
                  inc.type === 'BLOCKAGE' ? 'border-red-100' : 'border-amber-100'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${inc.type === 'BLOCKAGE' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <p className="font-bold text-opti-blue truncate" title={inc.address}>{inc.address}</p>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> À partir de {inc.time} • {inc.radiusInMeters}m
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(inc.id)}
                  className="p-1.5 text-slate-400 hover:text-opti-red hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}