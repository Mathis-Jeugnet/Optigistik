'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import AppShell from '@/app/components/AppShell'
import RoleGuard from '@/app/components/RoleGuard'
import { listSessions, deleteSession } from '@/services/firestoreSession'
import { useDeliveryStore } from '@/stores/deliveryStore'
import type { DeliverySession } from '@/types/logistics'

function formatDate(d: Date | string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 shrink-0" aria-hidden>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

export default function TourneesPage() {
  const router = useRouter()
  const resetSession = useDeliveryStore((s) => s.resetSession)
  const [sessions, setSessions] = useState<DeliverySession[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  
  // Onglet actif
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      listSessions()
        .then(setSessions)
        .catch(console.error)
        .finally(() => setLoading(false))
    })
    return () => unsubscribe()
  }, [])

  const { active, history } = useMemo(() => {
    const q = search.toLowerCase().trim()
    
    const filtered = sessions.filter((s) => {
      const matchesSearch = !q ||
        (s.meta.name ?? '').toLowerCase().includes(q) ||
        (s.origin_node?.address || '').toLowerCase().includes(q) ||
        (s.end_node?.address || '').toLowerCase().includes(q) ||
        (s.meta.date || '').includes(q)
      const matchesDate = !dateFilter || s.meta.date === dateFilter
      return matchesSearch && matchesDate
    })

    filtered.sort((a, b) => {
      const dateA = new Date(a.meta.date || 0).getTime()
      const dateB = new Date(b.meta.date || 0).getTime()
      return dateB - dateA
    })

    const todayStr = new Date().toISOString().split('T')[0]
    const activeList: DeliverySession[] = []
    const historyList: DeliverySession[] = []

    filtered.forEach((s) => {
      if (s.meta.date && s.meta.date < todayStr) {
        historyList.push(s)
      } else {
        activeList.push(s)
      }
    })

    return { active: activeList, history: historyList }
  }, [sessions, search, dateFilter])

  const handleNew = () => {
    resetSession()
    router.push('/tournees/saisie')
  }

  const handleOpen = (session: DeliverySession) => {
    useDeliveryStore.setState({ session, isDirty: false })
    router.push('/tournees/saisie')
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const hasFilters = search !== '' || dateFilter !== ''
  const currentList = activeTab === 'active' ? active : history

  const renderSessionCard = (session: DeliverySession) => {
    const name = session.meta.name || `Tournée du ${formatDate(session.meta.date)}`
    const isConfirming = confirmDeleteId === session.id
    const isDeleting = deletingId === session.id

    return (
      <div
        key={session.id}
        className="bg-white rounded-2xl px-4 sm:px-6 py-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-shadow hover:shadow-md"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-opti-blue truncate">{name}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {session.origin_node?.address || 'Dépôt non défini'}
            {' · '}
            {session.delivery_points?.length || 0} point{(session.delivery_points?.length || 0) > 1 ? 's' : ''}
            {' · '}
            Modifié le {formatDate(session.updatedAt)}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:shrink-0">
          {isConfirming ? (
            <>
              <span className="text-xs text-slate-500 mr-1">Supprimer ?</span>
              <button
                onClick={() => handleDelete(session.id)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-40"
              >
                {isDeleting ? '…' : 'Oui'}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-opti-blue hover:bg-gray-50 transition-colors"
              >
                Non
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDeleteId(session.id)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-slate-400 hover:text-opti-red hover:border-red-100 hover:bg-red-50 transition-colors"
              >
                Supprimer
              </button>
              <button
                onClick={() => handleOpen(session)}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors shadow-sm"
              >
                Ouvrir
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <AppShell>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur", "Chauffeur"]}>
      {/* 
        Alignement sur la structure w-full space-y-6 
        utilisée dans votre FleetSection
      */}
      <div className="w-full space-y-6">
        
        {/* Header simple */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-opti-blue font-display">Mes tournées</h1>
            <p className="text-sm text-slate-500 mt-1">Retrouvez et continuez vos saisies en cours.</p>
          </div>
          <button
            onClick={handleNew}
            className="py-2 px-5 bg-opti-red text-white hover:bg-opti-red-dark rounded-xl transition-all font-bold text-sm shadow-sm"
          >
            + Nouvelle tournée
          </button>
        </div>

        {/* Navigation Tabs Dynamiques - Style aligné sur FleetSection */}
        {!loading && sessions.length > 0 && (
          <div className="flex items-center border-b border-gray-200 gap-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-2 px-1 transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'active'
                  ? "text-opti-blue border-b-2 border-opti-blue font-bold"
                  : "text-gray-500 hover:text-opti-blue font-medium"
              }`}
            >
              À venir & En cours
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'active' ? 'bg-blue-50 text-opti-blue' : 'bg-gray-100 text-gray-500'}`}>
                {active.length}
              </span>
            </button>
            
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'history'
                  ? "text-opti-blue border-b-2 border-opti-blue font-bold"
                  : "text-gray-500 hover:text-opti-blue font-medium"
              }`}
            >
              Historique
              <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'history' ? 'bg-blue-50 text-opti-blue' : 'bg-gray-100 text-gray-500'}`}>
                {history.length}
              </span>
            </button>
          </div>
        )}

        {/* Contenu avec animation fade-in comme dans FleetSection */}
        <div className="animate-in fade-in duration-500 space-y-6">
          
          {/* Barre de recherche */}
          {!loading && sessions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom, adresse dépôt…"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-opti-blue placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white shadow-sm"
                />
                {hasFilters && (
                  <button
                    onClick={() => { setSearch(''); setDateFilter('') }}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-400 hover:text-opti-blue hover:bg-gray-50 transition-colors shadow-sm bg-white"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex h-[200px] items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-opti-red"></div>
            </div>
          )}

          {/* Empty global */}
          {!loading && sessions.length === 0 && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center gap-4 min-h-[300px]">
              <p className="text-gray-500">Aucune tournée sauvegardée pour le moment.</p>
              <button
                onClick={handleNew}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors shadow-sm"
              >
                Créer ma première tournée
              </button>
            </div>
          )}

          {/* No results (Filtre ou Onglet vide) */}
          {!loading && sessions.length > 0 && currentList.length === 0 && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center text-sm text-gray-500">
              {hasFilters 
                ? "Aucune tournée ne correspond à votre recherche dans cet onglet."
                : activeTab === 'active' 
                  ? "Vous n'avez aucune tournée à venir." 
                  : "Votre historique est vide."}
            </div>
          )}

          {/* Liste des cartes */}
          {!loading && currentList.length > 0 && (
            <div className="space-y-3">
              {currentList.map(renderSessionCard)}
            </div>
          )}
        </div>
      </div>
      </RoleGuard>
    </AppShell>
  )
}