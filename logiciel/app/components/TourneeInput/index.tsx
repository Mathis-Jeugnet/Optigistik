'use client'

import { useState } from 'react'
import { useDeliverySession } from '@/hooks/useDeliverySession'
import { useDeliveryStore } from '@/stores/deliveryStore'
import PivotPointsForm from './PivotPointsForm'
import ImportPanel from './ImportPanel'
import DeliveryTable from './DeliveryTable'
import GenerateTourneeButton from './GenerateTourneeButton'

export default function TourneeInput() {
  const { save, isSaving } = useDeliverySession()
  const session = useDeliveryStore((s) => s.session)
  const isDirty = useDeliveryStore((s) => s.isDirty)
  const updateSessionName = useDeliveryStore((s) => s.updateSessionName)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const currentName = session?.meta.name ?? ''

  const commitName = () => {
    updateSessionName(nameDraft.trim())
    setEditingName(false)
  }

  const startEditing = () => {
    setNameDraft(currentName)
    setEditingName(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
              placeholder="Nom de la tournée (optionnel)"
              className="text-2xl font-bold text-opti-blue font-display bg-transparent border-b-2 border-opti-red outline-none w-full"
            />
          ) : (
            <button
              onClick={startEditing}
              aria-label="Modifier le nom de la tournée"
              className="group flex items-center gap-2 text-left"
            >
              <h1 className="text-2xl font-bold text-opti-blue font-display truncate">
                {currentName || 'Saisie des tournées'}
              </h1>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-300 group-hover:text-opti-blue transition-colors shrink-0" aria-hidden>
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <p className="text-sm text-slate-500 mt-1">
            Préparez vos points de livraison pour l'optimisation OR-Tools.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          <button
            aria-label="Sauvegarder la session manuellement"
            onClick={save}
            disabled={isSaving || !isDirty}
            className="flex items-center gap-1.5 text-sm font-bold transition-colors disabled:cursor-default"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
              isSaving ? 'bg-amber-400 animate-pulse' :
              isDirty  ? 'bg-amber-400' :
                         'bg-green-500'
            }`} />
            <span className={
              isSaving ? 'text-slate-400' :
              isDirty  ? 'text-opti-blue hover:underline decoration-dotted' :
                         'text-slate-400'
            }>
              {isSaving ? 'Sauvegarde…' : isDirty ? 'Sauvegarder' : 'Sauvegardé'}
            </span>
          </button>
          <GenerateTourneeButton />
        </div>
      </div>

      <PivotPointsForm />
      <ImportPanel />
      <DeliveryTable />
    </div>
  )
}
